-- useDeleteProductionSchedule calls delete_production_schedule_cascade(), which
-- does not exist. Deleting a schedule therefore failed with "function does not
-- exist" every time.
--
-- Deleting a schedule has to take its production orders and line assignments with
-- it, or the orders are orphaned and the projection's scheduled/vouchered totals
-- stay inflated. The recompute triggers on projections do the arithmetic once the
-- rows are gone - this function only removes them, in dependency order.
--
-- It deliberately re-checks the lifecycle rule rather than relying on the trigger:
-- guard_schedule_lifecycle exempts admins, but nobody should be able to delete a
-- schedule whose material has already gone to the floor, admin or not. Deleting it
-- would leave a kit issued against a voucher that no longer exists.

CREATE OR REPLACE FUNCTION public.delete_production_schedule_cascade(p_schedule_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plant uuid;
  v_status public.schedule_status;
BEGIN
  SELECT plant_id, status INTO v_plant, v_status
  FROM public.production_schedules WHERE id = p_schedule_id;

  IF v_plant IS NULL THEN
    RAISE EXCEPTION 'Production schedule not found';
  END IF;

  -- SECURITY DEFINER bypasses RLS, so the caller's plant and role are checked here.
  IF NOT (public.in_plant(v_plant) AND public.has_role('production')) THEN
    RAISE EXCEPTION 'Not permitted to delete production schedules for this plant';
  END IF;

  IF v_status IN ('KIT_SENT', 'IN_PRODUCTION', 'COMPLETED', 'OQC_PASSED', 'OQC_FAILED') THEN
    RAISE EXCEPTION 'Material has already gone to production against this schedule; it can no longer be deleted';
  END IF;

  DELETE FROM public.production_order_lines
  WHERE production_order_id IN (
    SELECT id FROM public.production_orders WHERE production_schedule_id = p_schedule_id
  );

  DELETE FROM public.production_orders WHERE production_schedule_id = p_schedule_id;
  DELETE FROM public.production_schedules WHERE id = p_schedule_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_production_schedule_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_production_schedule_cascade(uuid) TO authenticated;
