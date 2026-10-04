-- One table for every finished-good identity: an R&D product ID is always a
-- model number (JA-016), and the model row in parts is created with it - so it
-- shows on the Models page at once, and its brand codes go on it later. A
-- free-form ID (J16, SB22P) no longer gets past, because it would have no model.
CREATE OR REPLACE FUNCTION public.plm_product_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_cat text; v_cat_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage
     AND coalesce(current_setting('app.plm', true), '') <> 'on' THEN
    RAISE EXCEPTION 'The stage moves only when a gate is passed';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.stage <> 1 AND coalesce(current_setting('app.plm', true), '') <> 'on' THEN
    NEW.stage := 1;
  END IF;
  NEW.product_code := upper(btrim(NEW.product_code));

  v_cat := substring(NEW.product_code FROM '^([A-Z]{2})-[A-Z0-9]+$');
  SELECT name INTO v_cat_name FROM public.part_categories WHERE prefix = v_cat AND tier = 'FINISHED' AND is_active;
  IF v_cat_name IS NULL THEN
    RAISE EXCEPTION 'The product ID is the model number: category and number, e.g. JA-016 or SB-025. "%" is not one%.',
      NEW.product_code,
      CASE WHEN v_cat IS NOT NULL THEN ' (no finished-good category ' || v_cat || ' - add it under Parts first)' ELSE '' END;
  END IF;
  NEW.category := v_cat_name;   -- the category is the one in the number

  IF TG_OP = 'UPDATE' AND NEW.product_code IS DISTINCT FROM OLD.product_code AND EXISTS (
       SELECT 1 FROM public.parts m JOIN public.parts b ON b.model_id = m.id
        WHERE m.plm_product_id = NEW.id AND m.source_type = 'MODEL') THEN
    RAISE EXCEPTION 'Model % already has brand codes, so its number cannot change', OLD.product_code;
  END IF;

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

-- Creating the R&D product creates its model; renumbering it (before any brand
-- code exists) renumbers the same model rather than leaving a stray one.
CREATE OR REPLACE FUNCTION public.plm_product_model()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_cat text; v_model uuid; v_owner uuid;
BEGIN
  v_cat := substring(NEW.product_code FROM '^([A-Z]{2})-[A-Z0-9]+$');
  IF v_cat IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT id INTO v_model FROM public.parts WHERE plm_product_id = NEW.id AND source_type = 'MODEL' AND part_code = OLD.product_code;
    IF v_model IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = NEW.product_code) THEN
        RAISE EXCEPTION '% is already used', NEW.product_code;
      END IF;
      PERFORM set_config('app.approving', 'on', true);
      UPDATE public.parts SET part_code = NEW.product_code, category = v_cat WHERE id = v_model;
      PERFORM set_config('app.approving', 'off', true);
      RETURN NULL;
    END IF;
  END IF;

  SELECT id, plm_product_id INTO v_model, v_owner FROM public.parts WHERE part_code = NEW.product_code AND source_type = 'MODEL';
  IF v_model IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = NEW.product_code OR part_code LIKE NEW.product_code || '-%') THEN
      RAISE EXCEPTION '% is already used by a finished good', NEW.product_code;
    END IF;
    INSERT INTO public.parts (part_code, name, category, uom, plm_product_id)
    VALUES (NEW.product_code, NEW.name, v_cat, 'PCS', NEW.id) RETURNING id INTO v_model;
    INSERT INTO public.model_versions (model_id, major, minor, kind, reason) VALUES (v_model, 1, 0, 'INITIAL', 'First version');
  ELSIF v_owner IS NULL THEN
    PERFORM set_config('app.approving', 'on', true);
    UPDATE public.parts SET plm_product_id = NEW.id WHERE id = v_model;
    PERFORM set_config('app.approving', 'off', true);
  ELSIF v_owner <> NEW.id THEN
    RAISE EXCEPTION 'Model % belongs to another R&D product', NEW.product_code;
  END IF;
  RETURN NULL;
END $function$;
