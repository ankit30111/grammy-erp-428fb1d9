-- Sub-assemblies built FOR a finished-good voucher go to that voucher's line,
-- not into the store.
--
-- How the plant works:
--   * Stock build (a sub-assembly voucher with no parent): PQC -> OQC -> Main Store.
--     Later vouchers draw it from the store like any other part. Unchanged.
--   * Linked (production_orders.parent_order_id is set): PQC -> OQC -> handed to
--     the finished-good voucher it was built for. It never enters the store, so
--     there is no store receipt and no store issue for it.
--
-- What changes:
--   1. receive_finished_goods: a linked sub-assembly that passes OQC records
--      handed_over_quantity (= what the hourly reports say was made) on its own
--      voucher. No stock_ledger row. A stock build still posts SUBASSEMBLY_RECEIPT.
--   2. sync_voucher_holds: a finished-good voucher holds from the store only what
--      its linked sub-assembly vouchers do not cover:
--          hold = BOM qty x voucher qty - linked cover
--      linked cover = planned qty while the linked voucher is open,
--                     handed-over qty once it has passed OQC,
--                     0 if it failed OQC or was cancelled (then the store must supply it).
--   3. A linked voucher that is created, changed, passed, failed or cancelled
--      re-syncs its parent's holds.
--   4. system_health_check: two more rules for this.

ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS handed_over_quantity numeric,
  ADD COLUMN IF NOT EXISTS handed_over_at timestamptz;

COMMENT ON COLUMN public.production_orders.parent_order_id IS
  'Set on a sub-assembly voucher built for another voucher. Its output goes to that voucher''s line after OQC, not to the store.';
COMMENT ON COLUMN public.production_orders.handed_over_quantity IS
  'Linked sub-assembly vouchers only: quantity handed to the parent voucher after OQC passed.';

-- How much of a voucher's BOM line its linked sub-assembly vouchers supply.
CREATE OR REPLACE FUNCTION public.linked_cover(p_order_id uuid, p_part_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT coalesce(sum(CASE
           WHEN c.status = 'OQC_PASSED' THEN coalesce(c.handed_over_quantity, 0)
           WHEN c.status IN ('OQC_FAILED', 'CANCELLED') THEN 0
           ELSE c.quantity END), 0)
    FROM public.production_orders c
   WHERE c.parent_order_id = p_order_id AND c.part_id = p_part_id
$function$;
GRANT EXECUTE ON FUNCTION public.linked_cover(uuid, uuid) TO authenticated;

-- 1. OQC pass -------------------------------------------------------------------
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
  SELECT * INTO o FROM public.production_orders WHERE id = p_production_order_id FOR UPDATE;
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

  -- Linked sub-assembly: straight to the voucher it was built for.
  IF o.parent_order_id IS NOT NULL THEN
    IF o.handed_over_quantity IS NULL THEN
      UPDATE public.production_orders
         SET handed_over_quantity = v_qty, handed_over_at = now()
       WHERE id = o.id;
    END IF;
    RETURN o.id;
  END IF;

  IF v_st = 'ASSEMBLED_STOCKED' THEN
    -- Stock build. One voucher, one receipt: a second call returns the first entry.
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
      format('%s x %s built on %s for stock, PQC and OQC passed, received into Main Store', v_code, v_qty, o.voucher_number),
      auth.uid())
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- Finished goods: one order produces one finished-goods lot.
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

-- 2. Holds: only what the store has to supply ------------------------------------
CREATE OR REPLACE FUNCTION public.sync_voucher_holds(p_production_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  o       public.production_orders%ROWTYPE;
  v_main  uuid;
  v_count integer;
BEGIN
  SELECT * INTO o FROM public.production_orders WHERE id = p_production_order_id;
  IF o.id IS NULL THEN
    RETURN 0;
  END IF;

  -- A voucher that is finished, failed or cancelled holds nothing.
  IF o.status IN ('COMPLETED', 'OQC_PASSED', 'OQC_FAILED', 'CANCELLED') THEN
    UPDATE public.stock_holds
       SET status = 'RELEASED', released_at = now(), updated_at = now()
     WHERE production_order_id = p_production_order_id AND status = 'ACTIVE';
    RETURN 0;
  END IF;

  -- Once the kit has gone to the floor the material has physically left the main
  -- store. Those holds are ISSUED and must not be rebuilt.
  IF EXISTS (
    SELECT 1 FROM public.stock_holds
     WHERE production_order_id = p_production_order_id AND status = 'ISSUED'
  ) THEN
    RETURN 0;
  END IF;

  SELECT id INTO v_main
    FROM public.stock_locations
   WHERE plant_id = o.plant_id AND code = 'MAIN' AND is_active;
  IF v_main IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.stock_holds
   WHERE production_order_id = p_production_order_id AND status = 'ACTIVE';

  INSERT INTO public.stock_holds (
    plant_id, location_id, part_id, quantity, needed_on, source,
    production_order_id, reference_type, reference_id, status, created_by
  )
  SELECT o.plant_id, v_main, x.child_part_id, x.qty, o.planned_date,
         'VOUCHER', o.id, 'PRODUCTION_ORDER', o.id, 'ACTIVE', o.created_by
    FROM (
      SELECT b.child_part_id,
             b.quantity * o.quantity - public.linked_cover(o.id, b.child_part_id) AS qty
        FROM public.bom b
       WHERE b.parent_part_id = o.part_id AND b.is_active
    ) x
   WHERE x.qty > 0;   -- stock_holds requires quantity > 0

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- 3. A linked voucher changes -> its parent's holds follow ------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_parent_voucher_holds()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.parent_order_id IS NOT NULL THEN
    PERFORM public.sync_voucher_holds(OLD.parent_order_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.parent_order_id IS NOT NULL
     AND NEW.parent_order_id IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.parent_order_id END) THEN
    PERFORM public.sync_voucher_holds(NEW.parent_order_id);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_parent_holds_on_child ON public.production_orders;
CREATE TRIGGER trg_parent_holds_on_child
  AFTER INSERT OR DELETE OR UPDATE OF parent_order_id, part_id, quantity, status, handed_over_quantity
  ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_parent_voucher_holds();

-- Bring every open voucher's holds in line with the rule now.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.production_orders
            WHERE status NOT IN ('COMPLETED', 'OQC_PASSED', 'OQC_FAILED', 'CANCELLED') LOOP
    PERFORM public.sync_voucher_holds(r.id);
  END LOOP;
END $$;

-- 4. System check ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.system_health_check()
 RETURNS TABLE (area text, rule text, status text, records integer, detail text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE n integer; d text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can run the system check' USING ERRCODE = '42501';
  END IF;

  -- STOCK ------------------------------------------------------------------
  SELECT count(*), string_agg(x.part_code || ' @' || x.loc || ': balance ' || x.bal || ', ledger ' || x.led, '; ')
    INTO n, d FROM (
      SELECT p.part_code, l.code AS loc, coalesce(b.quantity, 0) AS bal, coalesce(g.s, 0) AS led
        FROM (SELECT plant_id, part_id, location_id, sum(qty_delta) s FROM public.stock_ledger GROUP BY 1, 2, 3) g
        FULL JOIN public.stock_balance b ON b.plant_id = g.plant_id AND b.part_id = g.part_id AND b.location_id = g.location_id
        JOIN public.parts p ON p.id = coalesce(g.part_id, b.part_id)
        JOIN public.stock_locations l ON l.id = coalesce(g.location_id, b.location_id)
       WHERE coalesce(b.quantity, 0) <> coalesce(g.s, 0) LIMIT 20) x;
  area := 'Stock'; rule := 'Stock balance equals the sum of its ledger';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(p.part_code || ' ' || b.quantity, ', ') INTO n, d
    FROM public.stock_balance b JOIN public.parts p ON p.id = b.part_id WHERE b.quantity < 0;
  area := 'Stock'; rule := 'No negative stock';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(DISTINCT o.voucher_number, ', ') INTO n, d
    FROM public.stock_holds h JOIN public.production_orders o ON o.id = h.production_order_id
   WHERE h.status = 'ACTIVE' AND o.status IN ('COMPLETED', 'OQC_PASSED', 'OQC_FAILED', 'CANCELLED');
  area := 'Stock'; rule := 'Finished or cancelled vouchers hold no stock';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  -- BOM ----------------------------------------------------------------------
  WITH RECURSIVE walk(root, part, path, cyc) AS (
    SELECT b.parent_part_id, b.child_part_id, ARRAY[b.parent_part_id, b.child_part_id], b.parent_part_id = b.child_part_id
      FROM public.bom b WHERE b.is_active
    UNION ALL
    SELECT w.root, b.child_part_id, w.path || b.child_part_id, b.child_part_id = ANY (w.path)
      FROM walk w JOIN public.bom b ON b.parent_part_id = w.part AND b.is_active
     WHERE NOT w.cyc AND array_length(w.path, 1) < 25
  )
  SELECT count(DISTINCT root), string_agg(DISTINCT p.part_code, ', ') INTO n, d
    FROM walk w JOIN public.parts p ON p.id = w.root WHERE w.cyc;
  area := 'BOM'; rule := 'No part contains itself (no loops)';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(pp.part_code || ' > ' || pc.part_code, ', ') INTO n, d
    FROM public.bom b JOIN public.parts pp ON pp.id = b.parent_part_id JOIN public.parts pc ON pc.id = b.child_part_id
   WHERE b.is_active AND ((b.issue_mode = 'PER_SET' AND coalesce(b.quantity, 0) <= 0)
                          OR (b.issue_mode = 'BULK' AND b.quantity IS NOT NULL));
  area := 'BOM'; rule := 'Every line has a quantity (or is marked bulk)';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(pp.part_code || ' > ' || pc.part_code, ', ') INTO n, d
    FROM (SELECT parent_part_id, child_part_id FROM public.bom WHERE is_active GROUP BY 1, 2 HAVING count(*) > 1) x
    JOIN public.parts pp ON pp.id = x.parent_part_id JOIN public.parts pc ON pc.id = x.child_part_id;
  area := 'BOM'; rule := 'A part appears once per BOM';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(pp.part_code, ', ') INTO n, d
    FROM (SELECT DISTINCT parent_part_id FROM public.bom WHERE is_active) x
    JOIN public.parts pp ON pp.id = x.parent_part_id WHERE pp.source_type = 'PURCHASED';
  area := 'BOM'; rule := 'Only made parts have a BOM';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(pp.part_code || ' > ' || pc.part_code, ', ') INTO n, d
    FROM public.bom b JOIN public.parts pp ON pp.id = b.parent_part_id JOIN public.parts pc ON pc.id = b.child_part_id
   WHERE b.is_active AND pp.is_active AND NOT pc.is_active;
  area := 'BOM'; rule := 'Active BOMs use only active parts';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'WARN' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(p.part_code, ', ') INTO n, d
    FROM public.parts p
   WHERE p.is_active AND p.source_type IN ('ASSEMBLED_STOCKED', 'FINISHED_GOOD')
     AND NOT EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = p.id AND b.is_active);
  area := 'BOM'; rule := 'Every sub-assembly and finished good has a BOM';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'WARN' END; records := n; detail := d; RETURN NEXT;

  -- BRANDING -----------------------------------------------------------------
  SELECT count(*), string_agg(message, ' | ') INTO n, d FROM public.brand_sync_issues;
  area := 'Branding'; rule := 'Branding has nothing left to line up';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'WARN' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(pp.part_code || ' > ' || pc.part_code, ', ') INTO n, d
    FROM public.bom b JOIN public.parts pp ON pp.id = b.parent_part_id JOIN public.parts pc ON pc.id = b.child_part_id
   WHERE b.is_active AND pc.brand IS NOT NULL AND (pc.branded_from IS NOT NULL OR pc.source_type = 'FINISHED_GOOD')
     AND pp.brand IS DISTINCT FROM pc.brand;
  area := 'Branding'; rule := 'A brand''s part goes only into the same brand';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  -- A brand version must have the same lines as its base, with printed parts
  -- swapped for the same brand (or be a print: base x 1).
  SELECT count(*), string_agg(v.part_code, ', ') INTO n, d
    FROM public.parts v JOIN public.parts bp ON bp.id = v.branded_from
   WHERE v.branded_from IS NOT NULL AND v.is_active
     AND NOT (
       (bp.branding_required AND (SELECT count(*) FROM public.bom x WHERE x.parent_part_id = v.id AND x.is_active) = 1
          AND EXISTS (SELECT 1 FROM public.bom x WHERE x.parent_part_id = v.id AND x.is_active AND x.child_part_id = bp.id AND x.quantity = 1))
       OR
       (NOT bp.branding_required AND
          (SELECT count(*) FROM public.bom x WHERE x.parent_part_id = v.id AND x.is_active)
        = (SELECT count(*) FROM public.bom x WHERE x.parent_part_id = bp.id AND x.is_active)
        AND NOT EXISTS (
          SELECT 1 FROM public.bom x WHERE x.parent_part_id = bp.id AND x.is_active
             AND NOT EXISTS (
               SELECT 1 FROM public.bom y JOIN public.parts yc ON yc.id = y.child_part_id
                WHERE y.parent_part_id = v.id AND y.is_active
                  AND (y.child_part_id = x.child_part_id OR (yc.branded_from = x.child_part_id AND yc.brand = v.brand))
                  AND y.quantity IS NOT DISTINCT FROM x.quantity))));
  area := 'Branding'; rule := 'Every brand version matches its base part''s BOM';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(v.part_code, ', ') INTO n, d
    FROM public.parts v WHERE v.branded_from IS NOT NULL
     AND v.part_code IS DISTINCT FROM (SELECT b.part_code || '-' || v.brand FROM public.parts b WHERE b.id = v.branded_from);
  area := 'Branding'; rule := 'Brand version codes are base code + brand';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  -- PRODUCTION ---------------------------------------------------------------
  SELECT count(*), string_agg(o.voucher_number, ', ') INTO n, d
    FROM public.production_orders o
   WHERE o.production_schedule_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.production_schedules s WHERE s.id = o.production_schedule_id);
  area := 'Production'; rule := 'Every voucher has its schedule';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(o.voucher_number || ' (' || o.quantity || ' vs ' || s.quantity || ')', ', ') INTO n, d
    FROM public.production_orders o JOIN public.production_schedules s ON s.id = o.production_schedule_id
   WHERE o.quantity <> s.quantity OR o.part_id <> s.part_id;
  area := 'Production'; rule := 'Voucher and schedule agree on part and quantity';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(pr.id::text, ', ') INTO n, d
    FROM public.projections pr
   WHERE pr.scheduled_quantity > pr.quantity;
  area := 'Production'; rule := 'No projection is scheduled beyond its quantity';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(o.voucher_number || ' ' || p.part_code, ', ') INTO n, d
    FROM public.stock_ledger l JOIN public.production_orders o ON o.id = l.reference_id
    JOIN public.parts p ON p.id = o.part_id
   WHERE l.reference_type = 'PRODUCTION_ORDER' AND l.movement_type = 'SUBASSEMBLY_RECEIPT'
     AND o.parent_order_id IS NOT NULL;
  area := 'Production'; rule := 'Sub-assemblies built for a voucher go to its line, not the store';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(x.voucher_number || ' ' || x.part_code || ' (needs ' || x.need || ', linked ' || x.cover || ')', ', ') INTO n, d
    FROM (
      SELECT po.voucher_number, pc.part_code, b.quantity * po.quantity AS need,
             public.linked_cover(po.id, b.child_part_id) AS cover
        FROM public.production_orders po
        JOIN public.bom b ON b.parent_part_id = po.part_id AND b.is_active
        JOIN public.parts pc ON pc.id = b.child_part_id
       WHERE po.status NOT IN ('OQC_FAILED', 'CANCELLED')
    ) x WHERE x.cover > x.need;
  area := 'Production'; rule := 'Linked sub-assemblies do not exceed what their voucher needs';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'WARN' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(DISTINCT po.voucher_number, ', ') INTO n, d
    FROM public.stock_holds h
    JOIN public.production_orders po ON po.id = h.production_order_id
    JOIN public.bom b ON b.parent_part_id = po.part_id AND b.child_part_id = h.part_id AND b.is_active
   WHERE h.status = 'ACTIVE'
     AND h.quantity <> b.quantity * po.quantity - public.linked_cover(po.id, h.part_id);
  area := 'Production'; rule := 'Vouchers hold only what the store has to supply';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  -- MASTERS ------------------------------------------------------------------
  SELECT count(*), string_agg(p.part_code, ', ') INTO n, d
    FROM public.parts p WHERE NOT EXISTS (SELECT 1 FROM public.part_categories c WHERE c.prefix = p.category);
  area := 'Masters'; rule := 'Every part''s category is in the code registry';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(part_code, ', ') INTO n, d FROM public.parts WHERE approval_status = 'PENDING';
  area := 'Masters'; rule := 'Parts waiting for approval';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'WARN' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(vendor_code, ', ') INTO n, d FROM public.vendors WHERE approval_status = 'PENDING' AND is_active;
  area := 'Masters'; rule := 'Vendors waiting for approval';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'WARN' END; records := n; detail := d; RETURN NEXT;
END $function$;

GRANT EXECUTE ON FUNCTION public.system_health_check() TO authenticated;
