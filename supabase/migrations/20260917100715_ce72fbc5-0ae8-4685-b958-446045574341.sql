-- 1. Remove the duplicate/incrementing triggers on production_schedules
DROP TRIGGER IF EXISTS trigger_update_projection_scheduled_quantity ON public.production_schedules;
DROP TRIGGER IF EXISTS trg_projection_scheduled_qty_insert ON public.production_schedules;
DROP TRIGGER IF EXISTS trg_projection_scheduled_qty_update ON public.production_schedules;
DROP TRIGGER IF EXISTS trg_projection_scheduled_qty_delete ON public.production_schedules;

-- 2. Recompute-as-SUM maintainer
CREATE OR REPLACE FUNCTION public.recalc_projection_quantities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
BEGIN
  v_ids := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.projection_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.projection_id END
    ]) AS t(x) WHERE x IS NOT NULL
  );

  FOREACH v_id IN ARRAY v_ids LOOP
    UPDATE public.projections p
    SET scheduled_quantity = COALESCE(agg.total_qty, 0),
        vouchered_qty = COALESCE(agg.vouchered_qty, 0)
    FROM (
      SELECT
        COALESCE(SUM(s.quantity), 0) AS total_qty,
        COALESCE(SUM(CASE WHEN EXISTS (
          SELECT 1 FROM public.production_orders o
          WHERE o.production_schedule_id = s.id
        ) THEN s.quantity ELSE 0 END), 0) AS vouchered_qty
      FROM public.production_schedules s
      WHERE s.projection_id = v_id
    ) agg
    WHERE p.id = v_id;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalc_projection_quantities
AFTER INSERT OR UPDATE OF quantity, projection_id OR DELETE ON public.production_schedules
FOR EACH ROW EXECUTE FUNCTION public.recalc_projection_quantities();

-- Keep figures right when a voucher (production order) is added/removed for a schedule
CREATE OR REPLACE FUNCTION public.recalc_projection_quantities_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_sched uuid := COALESCE(NEW.production_schedule_id, OLD.production_schedule_id);
  v_proj uuid;
BEGIN
  IF v_sched IS NOT NULL THEN
    SELECT s.projection_id INTO v_proj FROM public.production_schedules s WHERE s.id = v_sched;
    IF v_proj IS NOT NULL THEN
      UPDATE public.projections p
      SET vouchered_qty = COALESCE(agg.vouchered_qty, 0)
      FROM (
        SELECT COALESCE(SUM(CASE WHEN EXISTS (
                 SELECT 1 FROM public.production_orders o
                 WHERE o.production_schedule_id = s.id
               ) THEN s.quantity ELSE 0 END), 0) AS vouchered_qty
        FROM public.production_schedules s
        WHERE s.projection_id = v_proj
      ) agg
      WHERE p.id = v_proj;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalc_projection_vouchered_from_order
AFTER INSERT OR DELETE ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.recalc_projection_quantities_from_order();

-- 3. Backfill every projection from its real schedules
UPDATE public.projections p
SET scheduled_quantity = agg.total_qty,
    vouchered_qty = agg.vouchered_qty
FROM (
  SELECT p2.id,
         COALESCE((SELECT SUM(s.quantity) FROM public.production_schedules s WHERE s.projection_id = p2.id), 0) AS total_qty,
         COALESCE((SELECT SUM(s.quantity) FROM public.production_schedules s
                   WHERE s.projection_id = p2.id
                     AND EXISTS (SELECT 1 FROM public.production_orders o WHERE o.production_schedule_id = s.id)), 0) AS vouchered_qty
  FROM public.projections p2
) agg
WHERE p.id = agg.id
  AND (COALESCE(p.scheduled_quantity,0) <> agg.total_qty OR COALESCE(p.vouchered_qty,0) <> agg.vouchered_qty);