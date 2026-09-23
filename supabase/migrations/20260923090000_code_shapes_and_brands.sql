-- Part code shapes by tier, and a brand letter on every finished good.
--
--   Purchase part      one letter      P-472        (unchanged, as it has always been)
--   Semi-finished      two letters     SB-001
--   Sub-assembled      two letters     AM-001
--   Finished good      two letters + brand letter   JP-001P
--
-- The letter count now says which side of the factory door a part came from, and
-- the last letter of a finished good says who it is built for. Both are checked
-- by the database, so a screen or an import cannot issue a code of the wrong shape.
--
-- The number is unique per prefix across brands: JP-001P and JP-001C cannot both
-- exist. The same model built for two brands is two finished goods, and two
-- products sharing a number is exactly the ambiguity part codes exist to remove.

-- HR: an employee without an email is normal on a shop floor.
ALTER TABLE public.employees ALTER COLUMN email DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.brands (
  letter     text PRIMARY KEY CHECK (letter ~ '^[A-Z]$'),
  name       text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brands_read ON public.brands;
CREATE POLICY brands_read ON public.brands FOR SELECT TO authenticated USING (public.has_role(NULL));
DROP POLICY IF EXISTS brands_write ON public.brands;
CREATE POLICY brands_write ON public.brands FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT, INSERT, UPDATE ON public.brands TO authenticated;

ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS brand text REFERENCES public.brands(letter);

-- J was seeded as a one-letter finished-good category. Made-here prefixes are two
-- letters now, and nothing uses J since the data was cleared, so it goes rather
-- than being grandfathered into a rule it breaks.
DELETE FROM public.part_categories
 WHERE tier <> 'PURCHASE' AND length(prefix) <> 2
   AND NOT EXISTS (SELECT 1 FROM public.parts p WHERE p.category = part_categories.prefix);

ALTER TABLE public.part_categories DROP CONSTRAINT IF EXISTS part_categories_prefix_length;
ALTER TABLE public.part_categories ADD CONSTRAINT part_categories_prefix_length CHECK (
  (tier = 'PURCHASE' AND prefix ~ '^[A-Z]$') OR (tier <> 'PURCHASE' AND prefix ~ '^[A-Z]{2}$'));

DROP FUNCTION IF EXISTS public.next_part_code(text);
CREATE OR REPLACE FUNCTION public.next_part_code(p_prefix text, p_brand text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tier text; v_seq int; v_base text; v_brand text := upper(nullif(btrim(p_brand), ''));
BEGIN
  SELECT tier, next_sequence INTO v_tier, v_seq FROM public.part_categories
   WHERE prefix = upper(p_prefix) AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active part category with prefix "%"', upper(p_prefix); END IF;

  IF v_tier = 'FINISHED' THEN
    IF v_brand IS NULL THEN RAISE EXCEPTION 'A finished good needs a brand letter'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.brands WHERE letter = v_brand AND is_active) THEN
      RAISE EXCEPTION 'No active brand with letter "%"', v_brand; END IF;
  ELSE
    v_brand := NULL;
  END IF;

  LOOP
    v_base := upper(p_prefix) || '-' || lpad(v_seq::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.parts WHERE part_code ~ ('^' || v_base || '[A-Z]?$'));
    v_seq := v_seq + 1;
  END LOOP;

  UPDATE public.part_categories SET next_sequence = v_seq + 1, updated_at = now()
   WHERE prefix = upper(p_prefix);
  RETURN v_base || coalesce(v_brand, '');
END; $$;
REVOKE ALL ON FUNCTION public.next_part_code(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_part_code(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.parts_enforce_category()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_kind public.part_source_type; v_tier text; v_ok boolean;
BEGIN
  SELECT kind, tier INTO v_kind, v_tier FROM public.part_categories WHERE prefix = NEW.category;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part category "%" is not in the part code registry. Add the category first, so its letter is reserved.', NEW.category;
  END IF;
  NEW.source_type := v_kind;

  IF v_tier = 'FINISHED' THEN
    NEW.brand := right(NEW.part_code, 1);
  ELSE
    NEW.brand := NULL;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.part_code IS DISTINCT FROM OLD.part_code THEN
    v_ok := CASE v_tier
      WHEN 'PURCHASE' THEN NEW.part_code ~ ('^' || NEW.category || '-[0-9]{3,}$')
      WHEN 'FINISHED' THEN NEW.part_code ~ ('^' || NEW.category || '-[0-9]{3,}[A-Z]$')
      ELSE NEW.part_code ~ ('^' || NEW.category || '-[0-9]{3,}$') END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'Part code "%" does not fit its category "%" (%): purchase parts are X-001, made-here parts XX-001, finished goods XX-001 plus a brand letter.',
        NEW.part_code, NEW.category, v_tier;
    END IF;
    IF v_tier = 'FINISHED' AND NOT EXISTS (SELECT 1 FROM public.brands WHERE letter = NEW.brand) THEN
      RAISE EXCEPTION 'Brand letter "%" on % is not a registered brand', NEW.brand, NEW.part_code;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
