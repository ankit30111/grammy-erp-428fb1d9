-- Brand codes are two letters. With one letter the brand at the end of a
-- finished-good code reads like another category letter (JP-001P); two letters
-- are unambiguous (JP-001PH). No brands or branded parts existed when this ran.
ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_letter_check;
ALTER TABLE public.brands ADD CONSTRAINT brands_letter_check CHECK (letter ~ '^[A-Z]{2}$');

CREATE OR REPLACE FUNCTION public.next_part_code(p_prefix text, p_brand text DEFAULT NULL::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_tier text; v_seq int; v_base text; v_brand text := upper(nullif(btrim(p_brand), ''));
BEGIN
  SELECT tier, next_sequence INTO v_tier, v_seq FROM public.part_categories
   WHERE prefix = upper(p_prefix) AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active part category with prefix "%"', upper(p_prefix); END IF;

  IF v_tier = 'FINISHED' THEN
    IF v_brand IS NULL THEN RAISE EXCEPTION 'A finished good needs a brand code'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.brands WHERE letter = v_brand AND is_active) THEN
      RAISE EXCEPTION 'No active brand with code "%"', v_brand; END IF;
  ELSE
    v_brand := NULL;
  END IF;

  LOOP
    v_base := upper(p_prefix) || '-' || lpad(v_seq::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.parts WHERE part_code ~ ('^' || v_base || '[A-Z]{0,2}$'));
    v_seq := v_seq + 1;
  END LOOP;

  UPDATE public.part_categories SET next_sequence = v_seq + 1, updated_at = now()
   WHERE prefix = upper(p_prefix);
  RETURN v_base || coalesce(v_brand, '');
END; $function$;

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
    IF NEW.part_code !~ ('^' || NEW.category || '-[A-Z0-9][A-Z0-9-]*$') THEN
      RAISE EXCEPTION 'Part code "%" must start with "%-"', NEW.part_code, NEW.category;
    END IF;
    IF v_tier = 'FINISHED' AND NOT EXISTS (SELECT 1 FROM public.brands WHERE letter = NEW.brand) THEN
      RAISE EXCEPTION 'Part code "%" must end in a registered two-letter brand code ("%" is not one).', NEW.part_code, NEW.brand;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
