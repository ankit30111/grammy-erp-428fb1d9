-- A new BOM line without a part code yet carries its own name, which R&D can
-- change. Once a part code is set, the line shows that part's name, which is
-- changed only in Parts.
CREATE OR REPLACE FUNCTION public.version_lines_name_rule() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    IF NEW.part_id IS NOT NULL AND OLD.part_id IS NOT NULL THEN
      RAISE EXCEPTION 'This line uses a part code; its name is changed in Parts';
    END IF;
    NEW.description := NULLIF(public.standard_terms(btrim(regexp_replace(COALESCE(NEW.description, ''), '\s+', ' ', 'g'))), '');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_version_lines_name_rule ON public.version_lines;
CREATE TRIGGER trg_version_lines_name_rule BEFORE UPDATE OF description ON public.version_lines
  FOR EACH ROW EXECUTE FUNCTION public.version_lines_name_rule();
