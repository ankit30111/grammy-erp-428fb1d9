
-- Helper: returns NULL if schedule is free to modify, else human reason
CREATE OR REPLACE FUNCTION public.production_schedule_locked(p_schedule_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  r record;
BEGIN
  SELECT po.status, po.kit_status, po.voucher_number
    INTO r
    FROM public.production_orders po
   WHERE po.production_schedule_id = p_schedule_id
   ORDER BY po.created_at ASC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF r.status = 'COMPLETED' THEN
    RETURN 'Production already completed (voucher ' || COALESCE(r.voucher_number,'?') || ') — cannot modify.';
  ELSIF r.status IN ('IN_PROGRESS','PENDING_OQC') THEN
    RETURN 'Production already in progress (voucher ' || COALESCE(r.voucher_number,'?') || ') — cannot modify.';
  ELSIF r.status = 'MATERIALS_SENT'
        OR (r.kit_status IS NOT NULL AND r.kit_status NOT IN ('NOT_PREPARED','')) THEN
    RETURN 'Kit already sent from store to production (voucher ' || COALESCE(r.voucher_number,'?') || ') — cannot modify or delete.';
  END IF;

  RETURN NULL;
END;
$$;

-- Guard trigger for production_schedules UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.guard_production_schedule_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_reason text;
  v_id uuid;
BEGIN
  -- Bypass for admin or for the cascade RPC
  IF public.auth_is_admin() OR current_setting('app.cascade_delete', true) = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_id := COALESCE(NEW.id, OLD.id);
  v_reason := public.production_schedule_locked(v_id);
  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION '%', v_reason USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_production_schedule_update ON public.production_schedules;
CREATE TRIGGER trg_guard_production_schedule_update
BEFORE UPDATE ON public.production_schedules
FOR EACH ROW EXECUTE FUNCTION public.guard_production_schedule_changes();

DROP TRIGGER IF EXISTS trg_guard_production_schedule_delete ON public.production_schedules;
CREATE TRIGGER trg_guard_production_schedule_delete
BEFORE DELETE ON public.production_schedules
FOR EACH ROW EXECUTE FUNCTION public.guard_production_schedule_changes();

-- Guard trigger for production_orders UPDATE/DELETE (block delete unless cascade/admin; allow status updates through if not locked)
CREATE OR REPLACE FUNCTION public.guard_production_order_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_reason text;
BEGIN
  IF public.auth_is_admin() OR current_setting('app.cascade_delete', true) = '1' THEN
    RETURN OLD;
  END IF;

  v_reason := public.production_schedule_locked(OLD.production_schedule_id);
  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION '%', v_reason USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_production_order_delete ON public.production_orders;
CREATE TRIGGER trg_guard_production_order_delete
BEFORE DELETE ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_production_order_delete();

-- Cascade-delete RPC
CREATE OR REPLACE FUNCTION public.delete_production_schedule_cascade(p_schedule_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_reason text;
  v_is_admin boolean;
BEGIN
  v_is_admin := public.auth_is_admin();

  IF NOT v_is_admin THEN
    v_reason := public.production_schedule_locked(p_schedule_id);
    IF v_reason IS NOT NULL THEN
      RAISE EXCEPTION '%', v_reason USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Set transaction-local bypass flag so guard triggers allow the cascade
  PERFORM set_config('app.cascade_delete', '1', true);

  -- Delete dependent rows that don't cascade automatically
  DELETE FROM public.material_blocking WHERE production_schedule_id = p_schedule_id;

  DELETE FROM public.kit_preparation
   WHERE production_order_id IN (SELECT id FROM public.production_orders WHERE production_schedule_id = p_schedule_id);

  DELETE FROM public.material_requests
   WHERE production_order_id IN (SELECT id FROM public.production_orders WHERE production_schedule_id = p_schedule_id);

  DELETE FROM public.line_rejections
   WHERE production_order_id IN (SELECT id FROM public.production_orders WHERE production_schedule_id = p_schedule_id);

  DELETE FROM public.hourly_production
   WHERE production_order_id IN (SELECT id FROM public.production_orders WHERE production_schedule_id = p_schedule_id);

  DELETE FROM public.pqc_reports
   WHERE production_order_id IN (SELECT id FROM public.production_orders WHERE production_schedule_id = p_schedule_id);

  DELETE FROM public.production_capa
   WHERE production_order_id IN (SELECT id FROM public.production_orders WHERE production_schedule_id = p_schedule_id);

  DELETE FROM public.production_material_discrepancies
   WHERE production_order_id IN (SELECT id FROM public.production_orders WHERE production_schedule_id = p_schedule_id);

  DELETE FROM public.finished_goods_inventory
   WHERE production_order_id IN (SELECT id FROM public.production_orders WHERE production_schedule_id = p_schedule_id);

  -- Now delete orders and schedule
  DELETE FROM public.production_orders WHERE production_schedule_id = p_schedule_id;
  DELETE FROM public.production_schedules WHERE id = p_schedule_id;

  -- Reset flag (transaction-local resets at commit anyway)
  PERFORM set_config('app.cascade_delete', '0', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_production_schedule_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.production_schedule_locked(uuid) TO authenticated;

-- Broaden RLS so Planning users (not only Production) can modify/delete schedules
DROP POLICY IF EXISTS production_schedules_delete ON public.production_schedules;
CREATE POLICY production_schedules_delete ON public.production_schedules
  FOR DELETE TO authenticated
  USING (
    public.auth_is_admin()
    OR public.auth_user_can_access_module('planning')
    OR public.auth_user_can_access_module('production')
  );

DROP POLICY IF EXISTS production_schedules_update ON public.production_schedules;
CREATE POLICY production_schedules_update ON public.production_schedules
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_admin()
    OR public.auth_user_can_access_module('planning')
    OR public.auth_user_can_access_module('production')
  );

DROP POLICY IF EXISTS production_orders_delete ON public.production_orders;
CREATE POLICY production_orders_delete ON public.production_orders
  FOR DELETE TO authenticated
  USING (
    public.auth_is_admin()
    OR public.auth_user_can_access_module('planning')
    OR public.auth_user_can_access_module('production')
  );
