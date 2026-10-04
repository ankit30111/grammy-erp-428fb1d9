-- The R&D product's BOM tab shows its model's BOM.
--   * An R&D BOM that is still empty starts from the model's BOM as soon as the
--     model has one (today's four in-production models get theirs now).
--   * For a product in mass production (stage 6), releasing a new version (an
--     ECN) brings the R&D BOM in line with it: lines kept by part, so their
--     tests stay; dropped parts go, new ones come in as carry-over.
-- The model's version stays the master; the R&D BOM is its working copy.
CREATE OR REPLACE FUNCTION public.plm_sync_bom_from_model(p_product uuid, p_lines jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE n int := 0; k int;
BEGIN
  WITH t AS (SELECT (l->>'child_part_id')::uuid AS part_id,
                    CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN NULL ELSE (l->>'quantity')::numeric END AS quantity,
                    coalesce((l->>'bulk')::boolean, false) AS bulk, coalesce((l->>'is_critical')::boolean, false) AS crit
               FROM jsonb_array_elements(p_lines) l)
  DELETE FROM public.plm_bom_lines b
   WHERE b.product_id = p_product AND b.part_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM t WHERE t.part_id = b.part_id);
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  WITH t AS (SELECT (l->>'child_part_id')::uuid AS part_id,
                    CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN NULL ELSE (l->>'quantity')::numeric END AS quantity,
                    coalesce((l->>'bulk')::boolean, false) AS bulk, coalesce((l->>'is_critical')::boolean, false) AS crit
               FROM jsonb_array_elements(p_lines) l)
  UPDATE public.plm_bom_lines b SET quantity = t.quantity, bulk = t.bulk, is_critical = t.crit
    FROM t WHERE b.product_id = p_product AND b.part_id = t.part_id
     AND (b.quantity IS DISTINCT FROM t.quantity OR b.bulk <> t.bulk OR b.is_critical <> t.crit);
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  INSERT INTO public.plm_bom_lines (product_id, part_id, quantity, bulk, is_critical, change_type, sort)
  SELECT p_product, t.part_id, t.quantity, t.bulk, t.crit, 'CARRY_OVER',
         coalesce((SELECT max(sort) FROM public.plm_bom_lines WHERE product_id = p_product), 0)
           + row_number() OVER (ORDER BY p.part_code)
    FROM (SELECT (l->>'child_part_id')::uuid AS part_id,
                 CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN NULL ELSE (l->>'quantity')::numeric END AS quantity,
                 coalesce((l->>'bulk')::boolean, false) AS bulk, coalesce((l->>'is_critical')::boolean, false) AS crit
            FROM jsonb_array_elements(p_lines) l) t
    JOIN public.parts p ON p.id = t.part_id
   WHERE NOT EXISTS (SELECT 1 FROM public.plm_bom_lines b WHERE b.product_id = p_product AND b.part_id = t.part_id);
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- The model already holds this BOM: nothing waiting to publish.
  UPDATE public.plm_products SET bom_published_at = now(), bom_changed_at = now() WHERE id = p_product;
  RETURN n;
END $function$;
REVOKE ALL ON FUNCTION public.plm_sync_bom_from_model(uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.model_version_to_rnd()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE pr record;
BEGIN
  IF jsonb_array_length(NEW.lines) = 0 THEN RETURN NULL; END IF;
  SELECT p.id, p.stage INTO pr FROM public.plm_products p JOIN public.parts m ON m.plm_product_id = p.id
   WHERE m.id = NEW.model_id;
  IF pr.id IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plm_bom_lines WHERE product_id = pr.id) THEN
    PERFORM public.plm_sync_bom_from_model(pr.id, NEW.lines);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'RELEASED' AND OLD.status <> 'RELEASED' AND pr.stage = 6 THEN
    PERFORM public.plm_sync_bom_from_model(pr.id, NEW.lines);
  END IF;
  RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS trg_model_version_to_rnd ON public.model_versions;
CREATE TRIGGER trg_model_version_to_rnd AFTER INSERT OR UPDATE OF lines, status ON public.model_versions
  FOR EACH ROW EXECUTE FUNCTION public.model_version_to_rnd();

-- The four products that are already in production.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (m.id) pr.id AS product_id, v.lines
      FROM public.plm_products pr JOIN public.parts m ON m.plm_product_id = pr.id
      JOIN public.model_versions v ON v.model_id = m.id AND jsonb_array_length(v.lines) > 0
     WHERE NOT EXISTS (SELECT 1 FROM public.plm_bom_lines b WHERE b.product_id = pr.id)
     ORDER BY m.id, (v.status = 'RELEASED') DESC, v.major DESC, v.minor DESC
  LOOP
    PERFORM public.plm_sync_bom_from_model(r.product_id, r.lines);
  END LOOP;
END $$;
