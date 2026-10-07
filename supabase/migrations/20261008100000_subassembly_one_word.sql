-- One word for one thing: "Sub-assembly". Not "Sub Assembly", "Sub-Assembly",
-- "Subassembly", "sub assy", and no plural label.

-- The SA category's name.
UPDATE public.part_categories SET name = 'Sub-assembly' WHERE prefix = 'SA' AND name IS DISTINCT FROM 'Sub-assembly';

-- Part names: any spelling of the word is written the standard way, now and on
-- every save (a name in capitals keeps capitals).
CREATE OR REPLACE FUNCTION public.standard_terms(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p IS NULL THEN NULL
              WHEN p = upper(p) AND p ~ '[A-Z]'
                THEN regexp_replace(p, '\mSUB[[:space:]_-]*(ASSEMBL(Y|IES)|ASSY)\M', 'SUB-ASSEMBLY', 'g')
              ELSE regexp_replace(p, '\msub[[:space:]_-]*(assembl(y|ies)|assy)\M', 'Sub-assembly', 'gi') END
$$;

CREATE OR REPLACE FUNCTION public.parts_standard_terms()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.name := public.standard_terms(NEW.name);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_parts_standard_terms ON public.parts;
CREATE TRIGGER trg_parts_standard_terms BEFORE INSERT OR UPDATE OF name ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.parts_standard_terms();

DO $$ BEGIN
  PERFORM set_config('app.brand_sync', 'on', true);
  UPDATE public.parts SET name = public.standard_terms(name)
   WHERE name IS DISTINCT FROM public.standard_terms(name);
  PERFORM set_config('app.brand_sync', 'off', true);
END $$;

-- System Check wording.
DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.system_health_check'::regproc) INTO d;
  d := replace(d, 'Sub-assemblies built for a voucher go to its line, not the store',
                  'A sub-assembly built for a voucher goes to its line, not the store');
  d := replace(d, 'Linked sub-assemblies do not exceed what their voucher needs',
                  'A linked sub-assembly does not exceed what its voucher needs');
  EXECUTE d;
END $$;
