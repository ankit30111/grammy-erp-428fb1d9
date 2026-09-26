-- Sub-assemblies can be scheduled without a customer projection.
--
-- A finished good is built because a customer asked for it, so its schedule
-- hangs off a projection. A sub-assembly (battery pack, LED assembly) is often
-- built ahead, for stock. Its schedule and voucher now stand on their own:
-- projection_id may be empty, but only when the part being built is not a
-- finished good.
ALTER TABLE public.production_schedules ALTER COLUMN projection_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.schedule_projection_rule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE st public.part_source_type; v_code text;
BEGIN
  IF NEW.projection_id IS NULL THEN
    SELECT source_type, part_code INTO st, v_code FROM public.parts WHERE id = NEW.part_id;
    IF st = 'FINISHED_GOOD' THEN
      RAISE EXCEPTION '% is a finished good: schedule it from a customer projection', v_code;
    END IF;
    IF st IS DISTINCT FROM 'ASSEMBLED_STOCKED' THEN
      RAISE EXCEPTION '% is not built here, so it cannot be scheduled', v_code;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_schedule_projection_rule ON public.production_schedules;
CREATE TRIGGER trg_schedule_projection_rule BEFORE INSERT OR UPDATE OF projection_id, part_id
  ON public.production_schedules FOR EACH ROW EXECUTE FUNCTION public.schedule_projection_rule();
