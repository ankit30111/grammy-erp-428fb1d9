-- R&D BOM steps carry a status: Open / WIP / Closed.
--
-- Each line's Design, Sample, Approval and Release is now OPEN, WIP or CLOSED.
-- A step counts its 25% only when CLOSED. Work can be in progress on several
-- steps at once, but a step closes only after the one before it is closed, and
-- re-opening a step puts any later closed step back to WIP.
-- The *_done columns stay, worked out from the status, so progress, gates and
-- reports read them unchanged.

ALTER TABLE public.plm_bom_lines
  ADD COLUMN design_status text NOT NULL DEFAULT 'OPEN' CHECK (design_status IN ('OPEN', 'WIP', 'CLOSED')),
  ADD COLUMN sample_status text NOT NULL DEFAULT 'OPEN' CHECK (sample_status IN ('OPEN', 'WIP', 'CLOSED')),
  ADD COLUMN approval_status text NOT NULL DEFAULT 'OPEN' CHECK (approval_status IN ('OPEN', 'WIP', 'CLOSED')),
  ADD COLUMN release_status text NOT NULL DEFAULT 'OPEN' CHECK (release_status IN ('OPEN', 'WIP', 'CLOSED'));

ALTER TABLE public.plm_bom_lines DISABLE TRIGGER USER;
UPDATE public.plm_bom_lines SET
  design_status = CASE WHEN design_done THEN 'CLOSED' ELSE 'OPEN' END,
  sample_status = CASE WHEN sample_done THEN 'CLOSED' ELSE 'OPEN' END,
  approval_status = CASE WHEN approval_done THEN 'CLOSED' ELSE 'OPEN' END,
  release_status = CASE WHEN release_done THEN 'CLOSED' ELSE 'OPEN' END;
ALTER TABLE public.plm_bom_lines ENABLE TRIGGER USER;

ALTER TABLE public.plm_bom_lines
  DROP COLUMN design_done, DROP COLUMN sample_done, DROP COLUMN approval_done, DROP COLUMN release_done;
ALTER TABLE public.plm_bom_lines
  ADD COLUMN design_done boolean GENERATED ALWAYS AS (design_status = 'CLOSED') STORED,
  ADD COLUMN sample_done boolean GENERATED ALWAYS AS (sample_status = 'CLOSED') STORED,
  ADD COLUMN approval_done boolean GENERATED ALWAYS AS (approval_status = 'CLOSED') STORED,
  ADD COLUMN release_done boolean GENERATED ALWAYS AS (release_status = 'CLOSED') STORED;

CREATE OR REPLACE FUNCTION public.plm_bom_line_rules()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
DECLARE v_open int; v_what text;
BEGIN
  IF NEW.change_type = 'CARRY_OVER' AND TG_OP = 'INSERT' THEN
    NEW.design_status := 'CLOSED'; NEW.sample_status := 'CLOSED'; NEW.approval_status := 'CLOSED'; NEW.release_status := 'CLOSED';
  END IF;
  v_what := coalesce((SELECT part_code FROM public.parts WHERE id = NEW.part_id), NEW.description);

  -- Re-opening a step sends later closed steps back to work in progress.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.design_status = 'CLOSED' AND NEW.design_status <> 'CLOSED' AND NEW.sample_status = 'CLOSED' THEN
      NEW.sample_status := 'WIP'; END IF;
    IF OLD.sample_status = 'CLOSED' AND NEW.sample_status <> 'CLOSED' AND NEW.approval_status = 'CLOSED' THEN
      NEW.approval_status := 'WIP'; END IF;
    IF OLD.approval_status = 'CLOSED' AND NEW.approval_status <> 'CLOSED' AND NEW.release_status = 'CLOSED' THEN
      NEW.release_status := 'WIP'; END IF;
  END IF;

  -- Closing needs the step before closed.
  IF NEW.sample_status = 'CLOSED' AND NEW.design_status <> 'CLOSED' THEN
    RAISE EXCEPTION '%: close Design before closing Sample', v_what; END IF;
  IF NEW.approval_status = 'CLOSED' AND NEW.sample_status <> 'CLOSED' THEN
    RAISE EXCEPTION '%: close Sample before closing Approval', v_what; END IF;
  IF NEW.release_status = 'CLOSED' AND NEW.approval_status <> 'CLOSED' THEN
    RAISE EXCEPTION '%: close Approval before closing Release', v_what; END IF;

  IF NEW.release_status = 'CLOSED' AND NEW.part_id IS NULL THEN
    RAISE EXCEPTION 'Give "%" its part code before closing Release', NEW.description;
  END IF;
  IF NEW.approval_status = 'CLOSED' AND (TG_OP = 'INSERT' OR OLD.approval_status <> 'CLOSED') THEN
    SELECT count(*) INTO v_open FROM public.plm_tests WHERE bom_line_id = NEW.id AND result <> 'PASS';
    IF v_open > 0 THEN
      RAISE EXCEPTION '% has % part test(s) not passed: Approval cannot close yet', v_what, v_open;
    END IF;
  END IF;

  NEW.design_at := CASE WHEN NEW.design_status = 'CLOSED' THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.design_at END, now()) END;
  NEW.sample_at := CASE WHEN NEW.sample_status = 'CLOSED' THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.sample_at END, now()) END;
  NEW.approval_at := CASE WHEN NEW.approval_status = 'CLOSED' THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.approval_at END, now()) END;
  NEW.release_at := CASE WHEN NEW.release_status = 'CLOSED' THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.release_at END, now()) END;
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;

-- A failed part test puts the line's Approval back to WIP.
CREATE OR REPLACE FUNCTION public.plm_test_failed()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_what text;
BEGIN
  IF NEW.result = 'FAIL' AND (TG_OP = 'INSERT' OR OLD.result IS DISTINCT FROM 'FAIL')
     AND NOT EXISTS (SELECT 1 FROM public.plm_issues WHERE test_id = NEW.id AND status = 'OPEN') THEN
    IF NEW.phase = 'PART' THEN
      SELECT coalesce(p.part_code || ' ' || p.name, l.description) INTO v_what
        FROM public.plm_bom_lines l LEFT JOIN public.parts p ON p.id = l.part_id WHERE l.id = NEW.bom_line_id;
      UPDATE public.plm_bom_lines SET approval_status = 'WIP' WHERE id = NEW.bom_line_id AND approval_status = 'CLOSED';
    END IF;
    INSERT INTO public.plm_issues (product_id, stage, description, severity, source, test_id, bom_line_id)
    VALUES (NEW.product_id,
            coalesce((SELECT stage FROM public.plm_products WHERE id = NEW.product_id), 1),
            CASE WHEN NEW.phase = 'PART' THEN 'Part test failed on ' || v_what || ': ' ELSE NEW.phase || ' test failed: ' END
              || NEW.name || coalesce(' - ' || nullif(btrim(NEW.note), ''), ''),
            'MEDIUM', 'TEST', NEW.id, NEW.bom_line_id);
  END IF;
  RETURN NULL;
END $$;
