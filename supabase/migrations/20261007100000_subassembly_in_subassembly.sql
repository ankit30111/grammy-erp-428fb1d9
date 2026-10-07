-- A sub-assembly can be built from other sub-assemblies (as well as purchased
-- parts). That was always allowed; what was missing is the guard against a
-- loop: SA-A inside SA-B inside SA-A would make an endless BOM. Both the
-- production BOM and R&D's versioned BOM refuse it now.

CREATE OR REPLACE FUNCTION public.bom_no_cycle()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_parent text; v_child text;
BEGIN
  IF NEW.child_part_id = NEW.parent_part_id OR EXISTS (
    WITH RECURSIVE down(id) AS (
      SELECT b.child_part_id FROM public.bom b WHERE b.parent_part_id = NEW.child_part_id AND b.is_active
      UNION
      SELECT b.child_part_id FROM public.bom b JOIN down d ON b.parent_part_id = d.id WHERE b.is_active)
    SELECT 1 FROM down WHERE id = NEW.parent_part_id) THEN
    SELECT part_code INTO v_parent FROM public.parts WHERE id = NEW.parent_part_id;
    SELECT part_code INTO v_child FROM public.parts WHERE id = NEW.child_part_id;
    RAISE EXCEPTION '% already contains %, so % cannot go inside it', v_child, v_parent, v_child;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bom_no_cycle ON public.bom;
CREATE TRIGGER trg_bom_no_cycle BEFORE INSERT OR UPDATE OF parent_part_id, child_part_id, is_active ON public.bom
  FOR EACH ROW WHEN (NEW.is_active) EXECUTE FUNCTION public.bom_no_cycle();

-- R&D: a line that uses a sub-assembly's version must not lead back to the item
-- the line is in. Named to run after trg_version_lines_rules, which sets
-- child_version_id.
CREATE OR REPLACE FUNCTION public.version_lines_no_cycle()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_item uuid; v_code text; v_child text;
BEGIN
  IF NEW.child_version_id IS NULL THEN RETURN NEW; END IF;
  SELECT item_id INTO v_item FROM public.item_versions WHERE id = NEW.version_id;
  IF EXISTS (
    WITH RECURSIVE v(id) AS (
      SELECT NEW.child_version_id
      UNION
      SELECT vl.child_version_id FROM public.version_lines vl JOIN v ON vl.version_id = v.id WHERE vl.child_version_id IS NOT NULL)
    SELECT 1 FROM v JOIN public.item_versions iv ON iv.id = v.id WHERE iv.item_id = v_item) THEN
    SELECT part_code INTO v_code FROM public.parts WHERE id = v_item;
    SELECT part_code INTO v_child FROM public.parts WHERE id = NEW.part_id;
    RAISE EXCEPTION '% already contains %, so % cannot go inside it', v_child, v_code, v_child;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_version_lines_zz_no_cycle ON public.version_lines;
CREATE TRIGGER trg_version_lines_zz_no_cycle BEFORE INSERT OR UPDATE OF part_id, child_version_id ON public.version_lines
  FOR EACH ROW EXECUTE FUNCTION public.version_lines_no_cycle();
