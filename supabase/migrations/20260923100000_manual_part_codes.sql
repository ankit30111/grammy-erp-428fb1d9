-- A typed part code is accepted, as long as it starts with its category's letters.
--
-- Codes are issued automatically, but Grammy has running article lists to
-- continue, and some of them carry suffixes (E-002A). So the shape rule relaxes
-- from "letters, dash, three digits" to "the category's letters, a dash, then
-- letters and digits". What stays enforced: the prefix must be the category's,
-- a finished good must end in a registered brand letter, and part_code is unique,
-- so no typed code can take one that already exists. The issuer steps over any
-- number a typed code has used.
CREATE OR REPLACE FUNCTION public.parts_enforce_category()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_kind public.part_source_type; v_tier text;
BEGIN
  SELECT kind, tier INTO v_kind, v_tier FROM public.part_categories WHERE prefix = NEW.category;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part category "%" is not in the part code registry. Add the category first, so its letter is reserved.', NEW.category;
  END IF;
  NEW.source_type := v_kind;
  NEW.part_code := upper(btrim(NEW.part_code));
  NEW.brand := CASE WHEN v_tier = 'FINISHED' THEN right(NEW.part_code, 1) END;

  IF TG_OP = 'INSERT' OR NEW.part_code IS DISTINCT FROM OLD.part_code THEN
    IF NEW.part_code !~ ('^' || NEW.category || '-[A-Z0-9][A-Z0-9-]*$') THEN
      RAISE EXCEPTION 'Part code "%" must start with "%-" (its category), followed by letters and numbers.',
        NEW.part_code, NEW.category;
    END IF;
    IF v_tier = 'FINISHED' AND NOT EXISTS (SELECT 1 FROM public.brands WHERE letter = NEW.brand) THEN
      RAISE EXCEPTION 'A finished-good code ends in its brand letter; "%" is not a registered brand.', NEW.brand;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
