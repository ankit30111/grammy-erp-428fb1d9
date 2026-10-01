-- Units: one unit per part, used everywhere; other units are converted into it.
--
-- Problem: a BOM line kept its own copy of the unit. D-060 (tape) is stocked in
-- METER, but its lines in O-059 / O-073 / O-076 / O-081 said MM, and D-038 /
-- D-039 lines said PCS. The quantities (0.08, 0.2 ...) are metres; only the
-- copied label was wrong, so the BOM view showed "0.08 MM".
--
-- Rules from now on:
--   * parts.uom is the part's stock unit. Stock, BOM quantities, kits and issues
--     are all in it. bom.uom is always the part's unit (kept by trigger).
--   * A part may be bought in another unit: purchase_uom, with
--     purchase_factor = how many stock units one purchase unit is
--     (1 KG = 250 PCS, 1 ROLL = 22000 MM). A GRN can be entered in either unit;
--     stock is always posted in the stock unit. The bill's own figure is kept on
--     the GRN line (received_in_uom, received_uom).
--   * If a part's unit is changed between related units (MM <-> METER,
--     GRAM <-> KG), its BOM quantities and purchase factor are converted.
--     A part that has stock cannot change unit: its stock would be misread.

-- 1. Related units -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unit_factor(p_from text, p_to text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  -- How many p_to make one p_from (MM -> METER = 0.001). NULL if unrelated.
  WITH u(code, family, base) AS (VALUES
    ('MM', 'length', 1::numeric), ('METER', 'length', 1000),
    ('GRAM', 'mass', 1), ('KG', 'mass', 1000))
  SELECT CASE WHEN upper(p_from) = upper(p_to) THEN 1
              ELSE (SELECT f.base / t.base FROM u f JOIN u t ON t.family = f.family
                     WHERE f.code = upper(p_from) AND t.code = upper(p_to)) END
$function$;
GRANT EXECUTE ON FUNCTION public.unit_factor(text, text) TO authenticated;

-- 2. A BOM line's unit is its part's unit ---------------------------------------------
CREATE OR REPLACE FUNCTION public.bom_unit_is_part_unit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  SELECT coalesce(uom, 'PCS') INTO NEW.uom FROM public.parts WHERE id = NEW.child_part_id;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_bom_unit_is_part_unit ON public.bom;
CREATE TRIGGER trg_bom_unit_is_part_unit
  BEFORE INSERT OR UPDATE OF uom, child_part_id ON public.bom
  FOR EACH ROW EXECUTE FUNCTION public.bom_unit_is_part_unit();

-- 3. Changing a part's unit ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.part_unit_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE f numeric; v_stock numeric; v_was text;
BEGIN
  IF coalesce(OLD.uom, 'PCS') = coalesce(NEW.uom, 'PCS') THEN RETURN NEW; END IF;

  SELECT coalesce(sum(abs(quantity)), 0) INTO v_stock FROM public.stock_balance WHERE part_id = NEW.id;
  IF v_stock <> 0 THEN
    RAISE EXCEPTION '% has stock counted in %. Change its unit only when its stock is zero, or it would be misread as %.',
      NEW.part_code, coalesce(OLD.uom, 'PCS'), coalesce(NEW.uom, 'PCS');
  END IF;

  f := public.unit_factor(coalesce(OLD.uom, 'PCS'), coalesce(NEW.uom, 'PCS'));
  IF f IS NOT NULL AND f <> 1 THEN
    -- 198 MM -> 0.198 METER, in every BOM and in the purchase factor.
    NEW.purchase_factor := trim_scale(coalesce(OLD.purchase_factor, 1) * f);
    v_was := current_setting('app.brand_sync', true);
    PERFORM set_config('app.brand_sync', 'on', true);
    UPDATE public.bom SET quantity = trim_scale(quantity * f) WHERE child_part_id = NEW.id AND quantity IS NOT NULL;
    PERFORM set_config('app.brand_sync', coalesce(v_was, ''), true);
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_part_unit_change ON public.parts;
CREATE TRIGGER trg_part_unit_change
  BEFORE UPDATE OF uom ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.part_unit_change();

-- After the part row is saved, its BOM lines carry the new unit label.
CREATE OR REPLACE FUNCTION public.part_unit_relabel_bom()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_was text;
BEGIN
  IF coalesce(OLD.uom, '') = coalesce(NEW.uom, '') THEN RETURN NULL; END IF;
  v_was := current_setting('app.brand_sync', true);
  PERFORM set_config('app.brand_sync', 'on', true);
  UPDATE public.bom SET uom = NEW.uom WHERE child_part_id = NEW.id;
  PERFORM set_config('app.brand_sync', coalesce(v_was, ''), true);
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS trg_part_unit_relabel_bom ON public.parts;
CREATE TRIGGER trg_part_unit_relabel_bom
  AFTER UPDATE OF uom ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.part_unit_relabel_bom();

-- 4. GRN: what the bill said, as well as what went into stock ------------------------
ALTER TABLE public.grn_items
  ADD COLUMN IF NOT EXISTS received_uom text,
  ADD COLUMN IF NOT EXISTS received_in_uom numeric;
COMMENT ON COLUMN public.grn_items.received_quantity IS
  'Received, in the part''s stock unit (parts.uom). This is what is posted to stock.';
COMMENT ON COLUMN public.grn_items.received_in_uom IS
  'Received as written on the bill, in received_uom (e.g. 25 KG). NULL when entered in the stock unit.';

-- 5. Fix the lines whose label disagreed with the part (quantities are already in the part's unit)
SELECT set_config('app.brand_sync', 'on', true);
UPDATE public.bom b SET uom = p.uom
  FROM public.parts p
 WHERE p.id = b.child_part_id AND b.uom IS DISTINCT FROM p.uom;
SELECT set_config('app.brand_sync', '', true);
