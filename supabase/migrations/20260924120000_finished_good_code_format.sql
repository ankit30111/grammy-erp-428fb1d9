-- A finished-good code is category - model - brand: JA-06C-PH is a party
-- speaker (JA), model 06C, built for Philips (PH). It is named, not numbered,
-- so it is checked here as that shape rather than issued from a counter.
CREATE OR REPLACE FUNCTION public.parts_enforce_category() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_kind public.part_source_type; v_tier text;
BEGIN
  SELECT kind, tier INTO v_kind, v_tier FROM public.part_categories WHERE prefix = NEW.category;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part category "%" is not in the part code registry. Add it under Parts first.', NEW.category;
  END IF;
  NEW.source_type := v_kind;
  NEW.part_code := upper(btrim(NEW.part_code));
  NEW.brand := CASE WHEN v_tier = 'FINISHED' THEN right(NEW.part_code, 2) END;
  IF TG_OP = 'INSERT' OR NEW.part_code IS DISTINCT FROM OLD.part_code THEN
    IF v_tier = 'FINISHED' THEN
      IF NEW.part_code !~ ('^' || NEW.category || '-[A-Z0-9]+-[A-Z]{2}$') THEN
        RAISE EXCEPTION 'A finished-good code is category-model-brand, e.g. %-06C-PH. "%" is not.',
          NEW.category, NEW.part_code;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.brands WHERE letter = NEW.brand) THEN
        RAISE EXCEPTION '"%" is not a registered brand. Add it on the create form first.', NEW.brand;
      END IF;
    ELSIF NEW.part_code !~ ('^' || NEW.category || '-[A-Z0-9][A-Z0-9-]*$') THEN
      RAISE EXCEPTION 'Part code "%" must start with "%-"', NEW.part_code, NEW.category;
    END IF;
  END IF;
  RETURN NEW;
END $$;
