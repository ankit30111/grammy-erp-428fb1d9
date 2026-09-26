-- Sub-assemblies as stock: built on their own voucher, received into the main
-- store after OQC, and issued to the finished-good voucher like any other part.
--
--   SA voucher kit issued     -> its raw parts leave the main store (unchanged)
--   SA voucher OQC passed     -> + SA quantity into the main store   (new)
--   FG voucher kit issued     -> - SA quantity out of the main store (unchanged,
--                                the SA is a single line on the FG BOM)
--
-- The cells are counted once (they left on the SA kit) and the pack is counted
-- once (it arrived after OQC). Nothing is added up twice.

-- 1. A sub-assembly voucher can be issued for a finished-good voucher.
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS parent_order_id uuid
    REFERENCES public.production_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS production_orders_parent_order_idx
  ON public.production_orders(parent_order_id) WHERE parent_order_id IS NOT NULL;

COMMENT ON COLUMN public.production_orders.parent_order_id IS
  'For a sub-assembly voucher: the finished-good voucher it was issued for. Null = stock build.';

-- 2. A sub-assembly is scheduled only once it has a BOM.
CREATE OR REPLACE FUNCTION public.schedule_projection_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE st public.part_source_type; v_code text;
BEGIN
  SELECT source_type, part_code INTO st, v_code FROM public.parts WHERE id = NEW.part_id;
  IF NEW.projection_id IS NULL THEN
    IF st = 'FINISHED_GOOD' THEN
      RAISE EXCEPTION '% is a finished good: schedule it from a customer projection', v_code;
    END IF;
    IF st IS DISTINCT FROM 'ASSEMBLED_STOCKED' THEN
      RAISE EXCEPTION '% is not built here, so it cannot be scheduled', v_code;
    END IF;
  END IF;
  IF st = 'ASSEMBLED_STOCKED' AND NOT EXISTS (
    SELECT 1 FROM public.bom b
     WHERE b.parent_part_id = NEW.part_id AND b.is_active
  ) THEN
    RAISE EXCEPTION '% has no BOM yet. Add its bill of materials before scheduling it', v_code;
  END IF;
  RETURN NEW;
END $function$;

-- 3. OQC pass books the output in: finished goods to the finished-goods store,
--    sub-assemblies to the main store through the stock ledger.
CREATE OR REPLACE FUNCTION public.receive_finished_goods(p_production_order_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  o      public.production_orders%ROWTYPE;
  v_st   public.part_source_type;
  v_code text;
  v_qty  numeric;
  v_id   uuid;
  v_main uuid;
  v_bal  numeric;
BEGIN
  SELECT * INTO o FROM public.production_orders WHERE id = p_production_order_id;
  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Production order not found';
  END IF;

  IF NOT (public.in_plant(o.plant_id) AND public.has_role('quality')) THEN
    RAISE EXCEPTION 'Only quality can book production output in';
  END IF;

  -- What was actually produced, not what was ordered, when hourly reports exist.
  v_qty := coalesce(nullif(o.produced_quantity, 0), o.quantity);
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'Nothing has been reported as produced against this voucher';
  END IF;

  SELECT source_type, part_code INTO v_st, v_code FROM public.parts WHERE id = o.part_id;

  IF v_st = 'ASSEMBLED_STOCKED' THEN
    -- One voucher, one receipt: a second call returns the first entry.
    SELECT id INTO v_id FROM public.stock_ledger
     WHERE reference_type = 'PRODUCTION_ORDER' AND reference_id = o.id
       AND movement_type = 'SUBASSEMBLY_RECEIPT';
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;

    SELECT id INTO v_main FROM public.stock_locations
     WHERE plant_id = o.plant_id AND code = 'MAIN' AND is_active;
    IF v_main IS NULL THEN
      RAISE EXCEPTION 'No main store is set up for this plant';
    END IF;

    SELECT coalesce(sum(qty_delta), 0) + v_qty INTO v_bal FROM public.stock_ledger
     WHERE plant_id = o.plant_id AND part_id = o.part_id AND location_id = v_main;

    INSERT INTO public.stock_ledger (plant_id, part_id, location_id, qty_delta, balance_after,
      movement_type, reason_code, reference_type, reference_id, reference_number, notes, created_by)
    VALUES (o.plant_id, o.part_id, v_main, v_qty, v_bal,
      'SUBASSEMBLY_RECEIPT', 'OQC_PASSED', 'PRODUCTION_ORDER', o.id, o.voucher_number,
      format('%s x %s built on %s, PQC and OQC passed, received into Main Store', v_code, v_qty, o.voucher_number),
      auth.uid())
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- Finished goods: unchanged. One order produces one finished-goods lot.
  SELECT id INTO v_id FROM public.finished_goods_inventory
   WHERE production_order_id = p_production_order_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.finished_goods_inventory (
    plant_id, production_order_id, part_id, quantity_in, lot_number
  ) VALUES (
    o.plant_id, o.id, o.part_id, v_qty, o.voucher_number
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- 4. Schedule a sub-assembly: one schedule, one voucher, optionally for a
--    finished-good voucher. Runs as the caller, so the usual planning and
--    production rights apply.
CREATE OR REPLACE FUNCTION public.schedule_subassembly(
  p_plant_id uuid, p_part_id uuid, p_quantity numeric, p_date date,
  p_line_id uuid DEFAULT NULL, p_parent_order_id uuid DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_sched uuid;
  v_order public.production_orders%ROWTYPE;
  v_parent text;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be more than zero';
  END IF;
  IF p_parent_order_id IS NOT NULL THEN
    SELECT voucher_number INTO v_parent FROM public.production_orders WHERE id = p_parent_order_id;
  END IF;

  INSERT INTO public.production_schedules (plant_id, projection_id, part_id, production_line_id,
    scheduled_date, quantity, status, notes, created_by)
  VALUES (p_plant_id, NULL, p_part_id, p_line_id, p_date, p_quantity, 'PLANNED',
    coalesce(p_notes, CASE WHEN v_parent IS NULL THEN 'Stock build' ELSE 'For ' || v_parent END),
    auth.uid())
  RETURNING id INTO v_sched;

  INSERT INTO public.production_orders (plant_id, production_schedule_id, part_id, quantity,
    planned_date, voucher_number, status, parent_order_id, created_by)
  VALUES (p_plant_id, v_sched, p_part_id, p_quantity, p_date, '', 'PLANNED', p_parent_order_id, auth.uid())
  RETURNING * INTO v_order;

  RETURN jsonb_build_object('schedule_id', v_sched, 'order_id', v_order.id,
                            'voucher_number', v_order.voucher_number);
END $function$;

-- 5. Schedule a finished good from its projection, together with any new
--    sub-assembly vouchers the planner chose to issue for it - all or nothing.
--    p_subassemblies: [{"part_id": uuid, "quantity": n, "date": "yyyy-mm-dd", "line_id": uuid|null}]
CREATE OR REPLACE FUNCTION public.schedule_finished_good(
  p_plant_id uuid, p_projection_id uuid, p_quantity numeric, p_date date,
  p_line_id uuid DEFAULT NULL, p_subassemblies jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  pr      public.projections%ROWTYPE;
  v_left  numeric;
  v_sched uuid;
  v_order public.production_orders%ROWTYPE;
  s       jsonb;
  v_subs  jsonb := '[]'::jsonb;
  v_code  text;
BEGIN
  SELECT * INTO pr FROM public.projections WHERE id = p_projection_id;
  IF pr.id IS NULL THEN
    RAISE EXCEPTION 'Projection not found';
  END IF;
  v_left := pr.quantity - coalesce(pr.scheduled_quantity, 0);
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be more than zero';
  END IF;
  IF p_quantity > v_left THEN
    RAISE EXCEPTION 'Only % left to schedule on this projection', v_left;
  END IF;

  INSERT INTO public.production_schedules (plant_id, projection_id, part_id, production_line_id,
    scheduled_date, quantity, status, created_by)
  VALUES (p_plant_id, pr.id, pr.part_id, p_line_id, p_date, p_quantity, 'PLANNED', auth.uid())
  RETURNING id INTO v_sched;

  INSERT INTO public.production_orders (plant_id, production_schedule_id, projection_id, part_id,
    quantity, planned_date, voucher_number, status, created_by)
  VALUES (p_plant_id, v_sched, pr.id, pr.part_id, p_quantity, p_date, '', 'PLANNED', auth.uid())
  RETURNING * INTO v_order;

  FOR s IN SELECT * FROM jsonb_array_elements(coalesce(p_subassemblies, '[]'::jsonb)) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.bom b
       WHERE b.parent_part_id = pr.part_id AND b.child_part_id = (s->>'part_id')::uuid AND b.is_active
    ) THEN
      SELECT part_code INTO v_code FROM public.parts WHERE id = (s->>'part_id')::uuid;
      RAISE EXCEPTION '% is not on this product''s BOM', coalesce(v_code, 'That sub-assembly');
    END IF;
    v_subs := v_subs || public.schedule_subassembly(
      p_plant_id, (s->>'part_id')::uuid, (s->>'quantity')::numeric,
      coalesce(nullif(s->>'date', '')::date, p_date),
      nullif(s->>'line_id', '')::uuid, v_order.id, NULL);
  END LOOP;

  RETURN jsonb_build_object('schedule_id', v_sched, 'order_id', v_order.id,
                            'voucher_number', v_order.voucher_number, 'subassemblies', v_subs);
END $function$;

GRANT EXECUTE ON FUNCTION public.schedule_subassembly(uuid, uuid, numeric, date, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_finished_good(uuid, uuid, numeric, date, uuid, jsonb) TO authenticated;
