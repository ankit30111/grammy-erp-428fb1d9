-- "Based on an existing product" can start from what the ERP already makes,
-- not only from another R&D project: a model (its master BOM) or a brand code
-- (its full production BOM, packaging included). R&D only reads it.
ALTER TABLE public.plm_products ADD COLUMN IF NOT EXISTS based_on_part_id uuid REFERENCES public.parts(id);
COMMENT ON COLUMN public.plm_products.based_on_part_id IS 'Variation started from an ERP model or brand code (read only). based_on_id is for an R&D product.';

CREATE OR REPLACE FUNCTION public.plm_product_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage
     AND coalesce(current_setting('app.plm', true), '') <> 'on' THEN
    RAISE EXCEPTION 'The stage moves only when a gate is passed';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.stage <> 1 AND coalesce(current_setting('app.plm', true), '') <> 'on' THEN
    NEW.stage := 1;
  END IF;
  NEW.product_code := upper(btrim(NEW.product_code));
  IF NEW.kind = 'NEW_MODEL' THEN NEW.based_on_id := NULL; NEW.based_on_part_id := NULL; END IF;
  IF NEW.based_on_part_id IS NOT NULL THEN NEW.based_on_id := NULL; END IF;
  IF NEW.based_on_part_id IS NOT NULL AND (SELECT source_type FROM public.parts WHERE id = NEW.based_on_part_id) NOT IN ('MODEL', 'FINISHED_GOOD') THEN
    RAISE EXCEPTION 'A product is based on a model or a finished good';
  END IF;
  IF NEW.customer_id IS NOT NULL THEN
    SELECT name INTO NEW.client FROM public.customers WHERE id = NEW.customer_id;
  END IF;
  NEW.ownership := CASE WHEN nullif(btrim(coalesce(NEW.client, '')), '') IS NULL THEN 'GRAMMY' ELSE NEW.ownership END;
  RETURN NEW;
END $function$;

-- The lines to start from: a model's latest version that has lines (released
-- first), else the BOMs of its brand codes; a brand code's own production BOM.
-- Brand versions of printed parts count as their base part.
CREATE OR REPLACE FUNCTION public.plm_part_base_lines(p_part uuid)
RETURNS TABLE (part_id uuid, quantity numeric, bulk boolean, is_critical boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_type public.part_source_type; v_lines jsonb;
BEGIN
  SELECT source_type INTO v_type FROM public.parts WHERE id = p_part;
  IF v_type = 'MODEL' THEN
    SELECT lines INTO v_lines FROM public.model_versions
     WHERE model_id = p_part AND jsonb_array_length(lines) > 0
     ORDER BY (status = 'RELEASED') DESC, major DESC, minor DESC LIMIT 1;
    IF v_lines IS NOT NULL THEN
      RETURN QUERY SELECT (l->>'child_part_id')::uuid, (l->>'quantity')::numeric,
                          coalesce((l->>'bulk')::boolean, false), coalesce((l->>'is_critical')::boolean, false)
                     FROM jsonb_array_elements(v_lines) l;
      RETURN;
    END IF;
  END IF;
  RETURN QUERY
  SELECT coalesce(c.branded_from, c.id), max(b.quantity), bool_or(b.issue_mode = 'BULK'), bool_or(b.is_critical)
    FROM public.bom b JOIN public.parts c ON c.id = b.child_part_id
   WHERE b.is_active AND (b.parent_part_id = p_part
         OR (v_type = 'MODEL' AND b.parent_part_id IN (SELECT id FROM public.parts WHERE model_id = p_part)))
   GROUP BY 1;
END $function$;
REVOKE ALL ON FUNCTION public.plm_part_base_lines(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plm_part_base_lines(uuid) TO authenticated;

-- Keep / Change / Remove, from an R&D product's lines or an ERP product's.
CREATE OR REPLACE FUNCTION public.plm_bom_from_base(p_product uuid, p_actions jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE a jsonb; n int := 0; v_desc text; v_part uuid;
  l record;
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D can change the BOM' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.plm_bom_lines WHERE product_id = p_product) THEN
    RAISE EXCEPTION 'This product already has a BOM';
  END IF;
  SELECT based_on_part_id INTO v_part FROM public.plm_products WHERE id = p_product;
  FOR a IN SELECT * FROM jsonb_array_elements(p_actions) LOOP
    IF v_part IS NOT NULL THEN
      SELECT b.part_id, NULL::text AS description, b.quantity, b.bulk, b.is_critical, NULL::text AS vendor_note, NULL::numeric AS quoted_price
        INTO l FROM public.plm_part_base_lines(v_part) b WHERE b.part_id = (a->>'line_id')::uuid;
    ELSE
      SELECT x.part_id, x.description, x.quantity, x.bulk, x.is_critical, x.vendor_note, x.quoted_price
        INTO l FROM public.plm_bom_lines x WHERE x.id = (a->>'line_id')::uuid;
    END IF;
    CONTINUE WHEN NOT FOUND OR a->>'action' = 'REMOVE';
    n := n + 1;
    IF a->>'action' = 'KEEP' THEN
      INSERT INTO public.plm_bom_lines (product_id, part_id, description, quantity, bulk, is_critical, change_type, sort,
                                        vendor_note, quoted_price)
      VALUES (p_product, l.part_id, l.description, l.quantity, l.bulk, l.is_critical, 'CARRY_OVER', n, l.vendor_note, l.quoted_price);
    ELSE
      SELECT 'New ' || coalesce(p.name, l.description) INTO v_desc FROM public.parts p WHERE p.id = l.part_id;
      INSERT INTO public.plm_bom_lines (product_id, part_id, description, quantity, bulk, is_critical, change_type,
                                        replaces_part_id, sort)
      VALUES (p_product, nullif(a->>'part_id', '')::uuid,
              coalesce(nullif(btrim(a->>'description'), ''), v_desc, 'Replacement for ' || coalesce(l.description, 'a part')),
              l.quantity, l.bulk, l.is_critical, 'CHANGED', l.part_id, n);
    END IF;
  END LOOP;
  RETURN n;
END $function$;
