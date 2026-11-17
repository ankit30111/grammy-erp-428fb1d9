-- 1. Material coming back from the line to the store
-- 2. "Waiting for you": the task list, taken from the records themselves
-- 3. The system map: every table, its links, and the checks that nothing leaks

-- ============================================================================
-- 1. RETURNS FROM PRODUCTION
-- ============================================================================
-- Production says what it is sending back and in what condition. The store
-- in-charge counts it; that count is final. Only the counted quantity returns
-- to stock (usable to the main store, faulty or damaged to the reject store).

ALTER TABLE public.kit_returns
  ADD COLUMN IF NOT EXISTS counted_quantity numeric CHECK (counted_quantity IS NULL OR counted_quantity >= 0),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

COMMENT ON COLUMN public.kit_returns.quantity IS 'What production said it sent back.';
COMMENT ON COLUMN public.kit_returns.counted_quantity IS 'What the store counted. Final. Empty until the store confirms.';

-- A kit line's returned quantity is what the store has counted, nothing else.
CREATE OR REPLACE FUNCTION public.recalc_kit_returned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE kid uuid := COALESCE(NEW.kit_item_id, OLD.kit_item_id);
BEGIN
  UPDATE public.kit_items k
  SET returned_quantity = COALESCE((SELECT SUM(r.counted_quantity) FROM public.kit_returns r
                                    WHERE r.kit_item_id = k.id AND r.verified_at IS NOT NULL), 0),
      updated_at = now()
  WHERE k.id = kid;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_recalc_kit_returned ON public.kit_returns;
CREATE TRIGGER trg_recalc_kit_returned
  AFTER INSERT OR UPDATE OR DELETE ON public.kit_returns
  FOR EACH ROW EXECUTE FUNCTION public.recalc_kit_returned();

-- What should come back for a voucher: issued - returned - (BOM x sets made).
CREATE OR REPLACE FUNCTION public.kit_return_lines(p_order uuid)
RETURNS TABLE (
  kit_item_id uuid, part_id uuid, part_code text, part_name text, uom text,
  issued numeric, returned numeric, waiting numeric, per_set numeric, produced numeric,
  rejected numeric, expected_back numeric)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT ki.id, ki.part_id, p.part_code, p.name, p.uom,
         ki.issued_quantity, ki.returned_quantity, coalesce(w.q, 0),
         b.quantity, o.produced_quantity, coalesce(r.q, 0),
         CASE WHEN b.quantity IS NULL THEN NULL
              ELSE greatest(ki.issued_quantity - ki.returned_quantity - coalesce(w.q, 0) - b.quantity * o.produced_quantity, 0) END
  FROM public.production_orders o
  JOIN public.kit_preparation kp ON kp.production_order_id = o.id
  JOIN public.kit_items ki ON ki.kit_preparation_id = kp.id
  JOIN public.parts p ON p.id = ki.part_id
  LEFT JOIN public.bom b ON b.parent_part_id = o.part_id AND b.child_part_id = ki.part_id AND b.is_active
  LEFT JOIN LATERAL (SELECT sum(kr.quantity) AS q FROM public.kit_returns kr
                     WHERE kr.kit_item_id = ki.id AND kr.verified_at IS NULL) w ON true
  LEFT JOIN LATERAL (SELECT sum(lr.quantity) AS q FROM public.line_rejections lr
                     WHERE lr.production_order_id = o.id AND lr.part_id = ki.part_id) r ON true
  WHERE o.id = p_order AND ki.issued_quantity > 0
  ORDER BY p.part_code
$$;

-- Production sends material back. p_lines = [{ kit_item_id, quantity, verdict, notes }]
CREATE OR REPLACE FUNCTION public.kit_return_raise(p_order uuid, p_lines jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.production_orders%ROWTYPE;
  l jsonb;
  k record;
  v_qty numeric;
  n integer := 0;
BEGIN
  SELECT * INTO o FROM public.production_orders WHERE id = p_order;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher not found';
  END IF;
  IF NOT (public.in_plant(o.plant_id) AND (public.has_role('production') OR public.has_role('store'))) THEN
    RAISE EXCEPTION 'Only Production or Store can send material back' USING ERRCODE = '42501';
  END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) LOOP
    v_qty := coalesce(nullif(l->>'quantity', '')::numeric, 0);
    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;
    SELECT ki.id, ki.issued_quantity, ki.returned_quantity, p.part_code,
           coalesce((SELECT sum(kr.quantity) FROM public.kit_returns kr WHERE kr.kit_item_id = ki.id AND kr.verified_at IS NULL), 0) AS waiting
      INTO k
    FROM public.kit_items ki
    JOIN public.kit_preparation kp ON kp.id = ki.kit_preparation_id
    JOIN public.parts p ON p.id = ki.part_id
    WHERE ki.id = (l->>'kit_item_id')::uuid AND kp.production_order_id = p_order;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That kit line does not belong to voucher %', o.voucher_number;
    END IF;
    IF v_qty > k.issued_quantity - k.returned_quantity - k.waiting THEN
      RAISE EXCEPTION '%: only % can still come back (issued %, already returned %, waiting at the store %)',
        k.part_code, k.issued_quantity - k.returned_quantity - k.waiting, k.issued_quantity, k.returned_quantity, k.waiting;
    END IF;
    INSERT INTO public.kit_returns (kit_item_id, plant_id, quantity, verdict, notes, returned_by)
    VALUES (k.id, o.plant_id, v_qty, coalesce(nullif(l->>'verdict', ''), 'USABLE')::public.rejection_verdict,
            nullif(btrim(l->>'notes'), ''), auth.uid());
    n := n + 1;
  END LOOP;

  IF n = 0 THEN
    RAISE EXCEPTION 'Enter a quantity for at least one part';
  END IF;
  RETURN n;
END $$;

-- The store counts what came back. That count is final.
CREATE OR REPLACE FUNCTION public.kit_return_confirm(p_return uuid, p_counted numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.kit_returns%ROWTYPE;
  k record;
  v_loc uuid;
BEGIN
  SELECT * INTO r FROM public.kit_returns WHERE id = p_return FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return not found';
  END IF;
  IF NOT (public.in_plant(r.plant_id) AND public.has_role('store')) THEN
    RAISE EXCEPTION 'Only Store can confirm a return' USING ERRCODE = '42501';
  END IF;
  IF r.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'This return has already been counted';
  END IF;
  IF p_counted IS NULL OR p_counted < 0 THEN
    RAISE EXCEPTION 'Enter the quantity counted';
  END IF;

  SELECT ki.part_id, ki.issued_quantity, ki.returned_quantity, o.voucher_number, p.part_code INTO k
  FROM public.kit_items ki
  JOIN public.kit_preparation kp ON kp.id = ki.kit_preparation_id
  JOIN public.production_orders o ON o.id = kp.production_order_id
  JOIN public.parts p ON p.id = ki.part_id
  WHERE ki.id = r.kit_item_id;
  IF p_counted > k.issued_quantity - k.returned_quantity THEN
    RAISE EXCEPTION '%: more than was issued. Issued %, already returned %', k.part_code, k.issued_quantity, k.returned_quantity;
  END IF;

  IF p_counted > 0 THEN
    SELECT id INTO v_loc FROM public.stock_locations
    WHERE plant_id = r.plant_id AND code = CASE WHEN r.verdict = 'USABLE' THEN 'MAIN' ELSE 'REJECT' END AND is_active;
    IF v_loc IS NULL THEN
      RAISE EXCEPTION 'This plant has no % store', CASE WHEN r.verdict = 'USABLE' THEN 'main' ELSE 'reject' END;
    END IF;
    PERFORM public.post_stock_movements(jsonb_build_array(jsonb_build_object(
      'plant_id', r.plant_id, 'part_id', k.part_id, 'location_id', v_loc, 'qty_delta', p_counted,
      'movement_type', 'KIT_RETURN', 'reason_code', 'LINE_RETURN_' || r.verdict::text,
      'reference_type', 'KIT_RETURN', 'reference_id', r.id, 'reference_number', k.voucher_number,
      'notes', format('Returned from the line, %s. Sent %s, counted %s', lower(r.verdict::text), r.quantity, p_counted))));
  END IF;

  UPDATE public.kit_returns
  SET counted_quantity = p_counted, verified_by = auth.uid(), verified_at = now()
  WHERE id = p_return;
  RETURN p_counted;
END $$;

REVOKE ALL ON FUNCTION public.kit_return_lines(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kit_return_raise(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kit_return_confirm(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kit_return_lines(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kit_return_raise(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kit_return_confirm(uuid, numeric) TO authenticated, service_role;

-- ============================================================================
-- 2. WAITING FOR YOU
-- ============================================================================
-- A task is not sent by anyone. It exists because the work exists, and it goes
-- away when the work is done. Each person sees the tasks of their departments.
CREATE OR REPLACE FUNCTION public.my_tasks()
RETURNS TABLE (key text, area text, title text, waiting integer, oldest date, link text)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  n integer;
  d date;
  today date := public.ist_today();
BEGIN
  IF NOT public.has_role(NULL) THEN
    RETURN;
  END IF;

  IF public.has_role('quality') THEN
    SELECT count(*), min(g.received_date) INTO n, d FROM public.grn_items gi JOIN public.grn g ON g.id = gi.grn_id WHERE gi.iqc_outcome = 'PENDING';
    IF n > 0 THEN RETURN QUERY SELECT 'iqc', 'Quality', 'Received lines waiting for incoming inspection', n, d, '/quality/iqc'; END IF;

    SELECT count(*), min(o.completed_at)::date INTO n, d FROM public.production_orders o WHERE o.status = 'COMPLETED';
    IF n > 0 THEN RETURN QUERY SELECT 'oqc', 'Quality', 'Vouchers waiting for final inspection', n, d, '/quality/oqc'; END IF;

    SELECT count(*), min(c.due_date) INTO n, d FROM public.capa c WHERE c.status = 'OPEN' AND c.due_date < today;
    IF n > 0 THEN RETURN QUERY SELECT 'capa-due', 'Quality', 'Corrective actions past their due date', n, d, '/quality/capa'; END IF;
  END IF;

  IF public.has_role('store') THEN
    SELECT count(*), min(o.planned_date) INTO n, d FROM public.production_orders o WHERE o.status = 'PLANNED';
    IF n > 0 THEN RETURN QUERY SELECT 'kits', 'Store', 'Vouchers waiting for a kit', n, d, '/store'; END IF;

    SELECT count(*), min(gi.iqc_at)::date INTO n, d FROM public.grn_items gi
    WHERE gi.iqc_outcome <> 'PENDING' AND gi.store_confirmed_at IS NULL AND coalesce(gi.iqc_accepted_quantity, 0) > 0;
    IF n > 0 THEN RETURN QUERY SELECT 'store-count', 'Store', 'Inspected lots to count into the store', n, d, '/store'; END IF;

    SELECT count(*), min(m.created_at)::date INTO n, d FROM public.material_requests m
    WHERE m.status NOT IN ('SENT', 'REJECTED', 'CANCELLED', 'CLOSED');
    IF n > 0 THEN RETURN QUERY SELECT 'requests', 'Store', 'Extra material requests to issue', n, d, '/store'; END IF;

    SELECT count(*), min(kr.created_at)::date INTO n, d FROM public.kit_returns kr WHERE kr.verified_at IS NULL;
    IF n > 0 THEN RETURN QUERY SELECT 'returns', 'Store', 'Returns from production to count', n, d, '/store?tab=returns'; END IF;

    SELECT count(DISTINCT c.id), min(coalesce(c.factory_arrival_date, c.arrived_date)) INTO n, d
    FROM public.import_containers c JOIN public.container_materials m ON m.container_id = c.id
    WHERE c.current_status IN ('ARRIVED', 'AT_FACTORY') AND m.grn_item_id IS NULL AND m.purchase_order_item_id IS NOT NULL;
    IF n > 0 THEN RETURN QUERY SELECT 'containers-in', 'Store', 'Containers to receive from their packing list', n, d, '/grn'; END IF;
  END IF;

  IF public.has_role('production') THEN
    SELECT count(*), min(k.sent_at)::date INTO n, d FROM public.kit_preparation k WHERE k.status = 'SENT';
    IF n > 0 THEN RETURN QUERY SELECT 'kit-receipt', 'Production', 'Kits sent to the line, waiting to be counted', n, d, '/production?tab=kit-receipt'; END IF;

    SELECT count(*), min(x.completed_at)::date INTO n, d FROM (
      SELECT o.id, o.completed_at FROM public.production_orders o
      WHERE o.status IN ('COMPLETED', 'OQC_PASSED', 'OQC_FAILED') AND o.completed_at > now() - interval '60 days'
        AND EXISTS (SELECT 1 FROM public.kit_return_lines(o.id) k WHERE k.expected_back > 0)) x;
    IF n > 0 THEN RETURN QUERY SELECT 'returns-due', 'Production', 'Finished vouchers with material still on the line', n, d, '/production?tab=completed'; END IF;
  END IF;

  IF public.has_role('purchase') THEN
    SELECT count(*), min(s.needed_on) INTO n, d FROM public.shortage_lines(NULL) s WHERE s.to_order > 0;
    IF n > 0 THEN RETURN QUERY SELECT 'to-order', 'Purchase', 'Parts to order', n, d, '/purchase?tab=create-po'; END IF;

    SELECT count(DISTINCT o.id), min(o.promised_delivery_date) INTO n, d FROM public.purchase_orders o JOIN public.purchase_order_items i ON i.purchase_order_id = o.id
    WHERE o.status IN ('APPROVED', 'PARTIALLY_RECEIVED') AND o.promised_delivery_date < today AND i.quantity > i.received_quantity;
    IF n > 0 THEN RETURN QUERY SELECT 'po-late', 'Purchase', 'Purchase orders past their promised date', n, d, '/purchase?tab=purchase-orders'; END IF;

    SELECT count(*), min(coalesce(c.eta, c.planned_factory)) INTO n, d FROM public.import_containers c
    WHERE c.current_status <> 'AT_FACTORY' AND coalesce(c.eta, c.planned_factory) < today;
    IF n > 0 THEN RETURN QUERY SELECT 'containers-late', 'Purchase', 'Containers later than expected', n, d, '/container-tracking?tab=containers'; END IF;
  END IF;

  IF public.has_role('planning') THEN
    SELECT count(*), min(p.month) INTO n, d FROM public.projections p WHERE p.quantity > p.scheduled_quantity;
    IF n > 0 THEN RETURN QUERY SELECT 'unscheduled', 'Planning', 'Projections not fully scheduled', n, d, '/planning'; END IF;
  END IF;

  IF public.has_role('rnd') THEN
    SELECT count(*), min(e.created_at)::date INTO n, d FROM public.ecns e WHERE e.status = 'DRAFT';
    IF n > 0 THEN RETURN QUERY SELECT 'rnd-ecn', 'R&D', 'Engineering changes being prepared or sent back', n, d, '/approvals'; END IF;

    SELECT count(*), min(s.created_at)::date INTO n, d FROM public.software_releases s WHERE s.status = 'TESTING';
    IF n > 0 THEN RETURN QUERY SELECT 'rnd-sw', 'R&D', 'Software waiting for the R&D check', n, d, '/approvals'; END IF;
  END IF;

  IF public.can_approve() THEN
    SELECT count(*), min(o.created_at)::date INTO n, d FROM public.purchase_orders o WHERE o.status = 'PENDING_APPROVAL';
    IF n > 0 THEN RETURN QUERY SELECT 'ap-po', 'Approvals', 'Purchase orders to approve', n, d, '/approvals'; END IF;

    SELECT (SELECT count(*) FROM public.parts WHERE approval_status = 'PENDING')
         + (SELECT count(*) FROM public.vendors WHERE approval_status = 'PENDING' AND is_active)
         + (SELECT count(*) FROM public.customers WHERE approval_status = 'PENDING') INTO n;
    IF n > 0 THEN RETURN QUERY SELECT 'ap-masters', 'Approvals', 'New parts, vendors and customers to approve', n, NULL::date, '/approvals'; END IF;

    SELECT count(*), min(e.submitted_at)::date INTO n, d FROM public.ecns e WHERE e.status = 'SUBMITTED';
    IF n > 0 THEN RETURN QUERY SELECT 'ap-ecn', 'Approvals', 'Engineering changes to approve', n, d, '/approvals'; END IF;

    SELECT count(*), min(s.rd_checked_at)::date INTO n, d FROM public.software_releases s WHERE s.status = 'RD_CHECKED';
    IF n > 0 THEN RETURN QUERY SELECT 'ap-sw', 'Approvals', 'Software releases to approve', n, d, '/approvals'; END IF;

    SELECT count(*) INTO n FROM public.bom_change_requests b WHERE b.status = 'PENDING';
    IF n > 0 THEN RETURN QUERY SELECT 'ap-bom', 'Approvals', 'BOM changes to approve', n, NULL::date, '/approvals'; END IF;

    SELECT count(*), min(c.updated_at)::date INTO n, d FROM public.capa c WHERE c.status = 'SUBMITTED';
    IF n > 0 THEN RETURN QUERY SELECT 'ap-capa', 'Approvals', 'Corrective actions to review', n, d, '/approvals'; END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.my_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_tasks() TO authenticated, service_role;

-- ============================================================================
-- 3. THE SYSTEM MAP
-- ============================================================================
-- Checks that follow a record from one table to the next: does every movement
-- still have its document, does every document have its movement.
CREATE OR REPLACE FUNCTION public.system_link_check()
RETURNS TABLE (area text, rule text, status text, records integer, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE n integer; d text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can run the system check' USING ERRCODE = '42501';
  END IF;

  SELECT count(*), string_agg(x.ref || ' (' || x.q || ')', ', ') INTO n, d FROM (
    SELECT coalesce(l.reference_number, '?') AS ref, sum(l.qty_delta) AS q
    FROM public.stock_ledger l
    WHERE l.reference_type = 'GRN_ITEM_RECEIPT' AND NOT EXISTS (SELECT 1 FROM public.grn_items gi WHERE gi.id = l.reference_id)
    GROUP BY 1 HAVING sum(l.qty_delta) <> 0 ORDER BY 1 LIMIT 20) x;
  area := 'Stock'; rule := 'Stock received on a GRN still has that GRN behind it';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'WARN' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(g.grn_number || ' ' || p.part_code, ', ') INTO n, d
  FROM public.grn_items gi JOIN public.grn g ON g.id = gi.grn_id JOIN public.parts p ON p.id = gi.part_id
  WHERE NOT EXISTS (SELECT 1 FROM public.stock_ledger l WHERE l.reference_id = gi.id AND l.reference_type = 'GRN_ITEM_RECEIPT');
  area := 'Stock'; rule := 'Every GRN line put its quantity into stock';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(o.po_number || ' ' || p.part_code, ', ') INTO n, d
  FROM public.purchase_order_items i JOIN public.purchase_orders o ON o.id = i.purchase_order_id JOIN public.parts p ON p.id = i.part_id
  WHERE i.received_quantity <> coalesce((SELECT sum(gi.received_quantity) FROM public.grn_items gi WHERE gi.purchase_order_item_id = i.id), 0);
  area := 'Purchase'; rule := 'Received quantity on a PO equals its GRN lines';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(o.voucher_number || ' ' || p.part_code, ', ') INTO n, d
  FROM public.kit_returns r JOIN public.kit_items ki ON ki.id = r.kit_item_id
  JOIN public.kit_preparation kp ON kp.id = ki.kit_preparation_id JOIN public.production_orders o ON o.id = kp.production_order_id
  JOIN public.parts p ON p.id = ki.part_id
  WHERE r.verified_at IS NOT NULL AND r.counted_quantity > 0
    AND NOT EXISTS (SELECT 1 FROM public.stock_ledger l WHERE l.reference_id = r.id AND l.reference_type = 'KIT_RETURN');
  area := 'Stock'; rule := 'Every counted return went back into stock';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;

  SELECT count(DISTINCT c.id), string_agg(DISTINCT c.container_number, ', ') INTO n, d
  FROM public.import_containers c JOIN public.container_materials m ON m.container_id = c.id
  WHERE c.current_status = 'AT_FACTORY' AND m.grn_item_id IS NULL AND m.purchase_order_item_id IS NOT NULL
    AND c.factory_arrival_date < public.ist_today() - 3;
  area := 'Purchase'; rule := 'Containers at the factory are received within three days';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'WARN' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(p.proname, ', ') INTO n, d
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND has_function_privilege('anon', p.oid, 'execute');
  area := 'Access'; rule := 'No backend action can be called without logging in';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := left(d, 300); RETURN NEXT;

  SELECT count(*), string_agg(c.relname, ', ') INTO n, d
  FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relkind = 'r'
    AND (NOT c.relrowsecurity OR NOT EXISTS (SELECT 1 FROM pg_policies po WHERE po.schemaname = 'public' AND po.tablename = c.relname));
  area := 'Access'; rule := 'Every table has access rules';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;
END $$;

-- Everything the map needs in one read: tables, rows, last change, links, checks.
CREATE OR REPLACE FUNCTION public.system_map()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record;
  v_tables jsonb := '[]'::jsonb;
  v_rows bigint;
  v_last timestamptz;
  v_col text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can open the system map' USING ERRCODE = '42501';
  END IF;

  FOR t IN
    SELECT c.relname::text AS name, obj_description(c.oid) AS about
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relkind = 'r' ORDER BY 1
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t.name) INTO v_rows;
    SELECT a.attname::text INTO v_col FROM pg_attribute a
    WHERE a.attrelid = ('public.' || quote_ident(t.name))::regclass AND a.attname IN ('updated_at', 'created_at') AND NOT a.attisdropped
    ORDER BY (a.attname = 'updated_at') DESC LIMIT 1;
    v_last := NULL;
    IF v_col IS NOT NULL AND v_rows > 0 THEN
      EXECUTE format('SELECT max(%I) FROM public.%I', v_col, t.name) INTO v_last;
    END IF;
    v_tables := v_tables || jsonb_build_object('name', t.name, 'rows', v_rows, 'last', v_last, 'about', t.about);
  END LOOP;

  RETURN jsonb_build_object(
    'read_at', now(),
    'tables', v_tables,
    'links', (SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('from', c.conrelid::regclass::text, 'to', c.confrelid::regclass::text)), '[]'::jsonb)
              FROM pg_constraint c
              WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace AND c.conrelid <> c.confrelid
                AND c.confrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)),
    'checks', (SELECT jsonb_agg(to_jsonb(x)) FROM (
                 SELECT * FROM public.system_health_check()
                 UNION ALL SELECT * FROM public.system_link_check()) x),
    'database_size', pg_size_pretty(pg_database_size(current_database())));
END $$;

REVOKE ALL ON FUNCTION public.system_link_check() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.system_map() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.system_link_check() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.system_map() TO authenticated, service_role;
