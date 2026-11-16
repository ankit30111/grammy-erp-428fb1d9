-- Shortages worked out in the database, on one rule, for everyone.
--
--   Still to issue (per open voucher, per part)
--       = required - (issued - returned), never below zero
--   Shortage  = still to issue + demand not yet on a voucher - in store - waiting for IQC
--   To order  = shortage - already on order
--
-- Before this, the sum ran in each user's browser, a kit sent short dropped the
-- voucher's whole hold, and purchase orders already placed were not counted.

-- 1. Import containers may carry more than was ordered -------------------------
CREATE OR REPLACE FUNCTION public.container_line_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v record;
BEGIN
  IF NEW.purchase_order_item_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT i.part_id, po.is_import, po.status, po.po_number INTO v
  FROM public.purchase_order_items i
  JOIN public.purchase_orders po ON po.id = i.purchase_order_id
  WHERE i.id = NEW.purchase_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That PO line does not exist';
  END IF;
  IF NOT v.is_import THEN
    RAISE EXCEPTION '% is not an import PO', v.po_number;
  END IF;
  IF v.status NOT IN ('APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED') THEN
    RAISE EXCEPTION '% is not approved yet', v.po_number;
  END IF;
  NEW.part_id := v.part_id;
  RETURN NEW;
END $$;

-- 2. A voucher holds what the store still has to issue --------------------------
CREATE OR REPLACE FUNCTION public.voucher_net_issued(p_order uuid, p_part uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(sum(ki.issued_quantity - ki.returned_quantity), 0)
  FROM public.kit_preparation kp
  JOIN public.kit_items ki ON ki.kit_preparation_id = kp.id
  WHERE kp.production_order_id = p_order AND ki.part_id = p_part
$$;

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
  x       record;
BEGIN
  SELECT * INTO o FROM public.production_orders WHERE id = p_production_order_id;
  IF o.id IS NULL THEN RETURN 0; END IF;

  -- A voucher that is finished, failed or cancelled holds nothing.
  IF o.status IN ('COMPLETED', 'OQC_PASSED', 'OQC_FAILED', 'CANCELLED') THEN
    UPDATE public.stock_holds
       SET status = 'RELEASED', released_at = now(), updated_at = now()
     WHERE production_order_id = p_production_order_id AND status = 'ACTIVE';
    RETURN 0;
  END IF;

  SELECT id INTO v_main FROM public.stock_locations
   WHERE plant_id = o.plant_id AND code = 'MAIN' AND is_active;
  IF v_main IS NULL THEN RETURN 0; END IF;

  -- What is still owed to this voucher: the BOM requirement, less what linked
  -- sub-assembly vouchers bring, less what the store has already issued (net of
  -- anything the line returned). A kit sent short therefore keeps the balance
  -- on hold until it is issued.
  v_count := 0;
  FOR x IN
    SELECT b.child_part_id AS part_id,
           coalesce(b.quantity, 0) * o.quantity - public.linked_cover(o.id, b.child_part_id)
             - public.voucher_net_issued(o.id, b.child_part_id) AS qty
      FROM public.bom b
     WHERE b.parent_part_id = o.part_id AND b.is_active
  LOOP
    IF x.qty > 0 THEN
      UPDATE public.stock_holds
         SET quantity = x.qty, needed_on = o.planned_date, updated_at = now()
       WHERE production_order_id = o.id AND part_id = x.part_id AND status = 'ACTIVE'
         AND (quantity <> x.qty OR needed_on <> o.planned_date);
      IF NOT EXISTS (SELECT 1 FROM public.stock_holds
                      WHERE production_order_id = o.id AND part_id = x.part_id AND status = 'ACTIVE') THEN
        INSERT INTO public.stock_holds (
          plant_id, location_id, part_id, quantity, needed_on, source,
          production_order_id, reference_type, reference_id, status, created_by)
        VALUES (o.plant_id, v_main, x.part_id, x.qty, o.planned_date, 'VOUCHER',
                o.id, 'PRODUCTION_ORDER', o.id, 'ACTIVE', o.created_by);
      END IF;
      v_count := v_count + 1;
    ELSE
      -- Fully issued: nothing left to hold for this part.
      UPDATE public.stock_holds
         SET status = 'ISSUED', released_at = now(), updated_at = now()
       WHERE production_order_id = o.id AND part_id = x.part_id AND status = 'ACTIVE';
    END IF;
  END LOOP;

  -- Parts no longer on the BOM hold nothing.
  UPDATE public.stock_holds h
     SET status = 'RELEASED', released_at = now(), updated_at = now()
   WHERE h.production_order_id = o.id AND h.status = 'ACTIVE'
     AND NOT EXISTS (SELECT 1 FROM public.bom b
                      WHERE b.parent_part_id = o.part_id AND b.child_part_id = h.part_id AND b.is_active);

  RETURN v_count;
END;
$function$;

-- A kit going out no longer ends the whole hold; the hold follows what was issued.
CREATE OR REPLACE FUNCTION public.release_holds_on_kit_sent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.sync_voucher_holds(NEW.production_order_id);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_kit_item_holds()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_kit uuid := coalesce(NEW.kit_preparation_id, OLD.kit_preparation_id);
  v_order uuid;
BEGIN
  SELECT production_order_id INTO v_order FROM public.kit_preparation WHERE id = v_kit;
  IF v_order IS NOT NULL THEN
    PERFORM public.sync_voucher_holds(v_order);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_kit_item_holds ON public.kit_items;
CREATE TRIGGER trg_kit_item_holds
  AFTER INSERT OR DELETE OR UPDATE OF issued_quantity, returned_quantity, part_id ON public.kit_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_kit_item_holds();

-- 3. System Check: the hold must equal what is still to issue ------------------
CREATE OR REPLACE FUNCTION public.system_health_check()
 RETURNS TABLE(area text, rule text, status text, records integer, detail text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
          + (SELECT count(*) FROM public.bom_brand_lines x WHERE x.parent_part_id = bp.id AND x.brand = v.brand)
        AND NOT EXISTS (
          SELECT 1 FROM (SELECT child_part_id, quantity FROM public.bom WHERE parent_part_id = bp.id AND is_active
                         UNION ALL SELECT child_part_id, quantity FROM public.bom_brand_lines WHERE parent_part_id = bp.id AND brand = v.brand) x
           WHERE true
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
  area := 'Production'; rule := 'A sub-assembly built for a voucher goes to its line, not the store';
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
  area := 'Production'; rule := 'A linked sub-assembly does not exceed what its voucher needs';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'WARN' END; records := n; detail := d; RETURN NEXT;

  SELECT count(*), string_agg(DISTINCT po.voucher_number, ', ') INTO n, d
    FROM public.stock_holds h
    JOIN public.production_orders po ON po.id = h.production_order_id
    JOIN public.bom b ON b.parent_part_id = po.part_id AND b.child_part_id = h.part_id AND b.is_active
   WHERE h.status = 'ACTIVE'
     AND h.quantity <> coalesce(b.quantity, 0) * po.quantity - public.linked_cover(po.id, h.part_id)
                         - public.voucher_net_issued(po.id, h.part_id);
  area := 'Production'; rule := 'Vouchers hold only what the store still has to issue';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'ERROR' END; records := n; detail := d; RETURN NEXT;



  -- A brand code's BOM is its model version's lines for its brand (R&D's BOM).
  SELECT count(*), string_agg(x.part_code, ', ') INTO n, d FROM (
    SELECT fg.part_code FROM public.parts fg
      JOIN public.item_versions iv ON iv.item_id = fg.model_id AND iv.version = fg.model_version
     WHERE fg.source_type = 'FINISHED_GOOD' AND fg.is_active
       AND EXISTS (
         (SELECT l.part_id, l.quantity FROM public.version_lines l
           WHERE l.version_id = iv.id AND (l.brands IS NULL OR fg.brand = ANY (l.brands))
          EXCEPT SELECT coalesce(c.branded_from, c.id), b.quantity FROM public.bom b JOIN public.parts c ON c.id = b.child_part_id
           WHERE b.parent_part_id = fg.id AND b.is_active)
         UNION ALL
         (SELECT coalesce(c.branded_from, c.id), b.quantity FROM public.bom b JOIN public.parts c ON c.id = b.child_part_id
           WHERE b.parent_part_id = fg.id AND b.is_active
          EXCEPT SELECT l.part_id, l.quantity FROM public.version_lines l
           WHERE l.version_id = iv.id AND (l.brands IS NULL OR fg.brand = ANY (l.brands))))) x;
  area := 'BOM'; rule := 'Brand codes are built as R&D''s version says';
  status := CASE WHEN n = 0 THEN 'OK' ELSE 'WARN' END; records := n; detail := d; RETURN NEXT;

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
END $function$
;

-- 4. The shortage list ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shortage_lines(p_plant uuid DEFAULT NULL)
RETURNS TABLE (
  part_id uuid, part_code text, name text, category text, uom text,
  for_vouchers numeric, for_projections numeric,
  in_store numeric, at_iqc numeric, on_order numeric,
  shortage numeric, to_order numeric, needed_on date,
  vendor_id uuid, vendor_name text, unit_price numeric, currency text,
  sources jsonb, pending_pos jsonb)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  d jsonb := '{}'::jsonb;   -- gross demand per part, filled level by level
  r record;
  c record;
  g numeric;
  v_free numeric;
  v_net numeric;
BEGIN
  IF NOT public.has_role(NULL) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  -- Demand that is not on a voucher yet: what each projection still has to build.
  FOR r IN
    SELECT pr.part_id AS pid, sum(pr.quantity - greatest(pr.vouchered_quantity, pr.produced_quantity)) AS q
    FROM public.projections pr
    WHERE pr.quantity - greatest(pr.vouchered_quantity, pr.produced_quantity) > 0
    GROUP BY pr.part_id
  LOOP
    d := jsonb_set(d, ARRAY[r.pid::text], to_jsonb(r.q));
  END LOOP;

  -- Walk the BOM from the top down, parents always before their children.
  FOR r IN
    WITH RECURSIVE lv AS (
      SELECT p.id AS pid, 0 AS lvl
      FROM public.parts p
      WHERE EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = p.id AND b.is_active)
        AND NOT EXISTS (SELECT 1 FROM public.bom b WHERE b.child_part_id = p.id AND b.is_active)
      UNION ALL
      SELECT b.child_part_id, lv.lvl + 1
      FROM lv JOIN public.bom b ON b.parent_part_id = lv.pid AND b.is_active
      WHERE lv.lvl < 12
    )
    SELECT lv.pid, p.source_type::text AS st, max(lv.lvl) AS lvl
    FROM lv JOIN public.parts p ON p.id = lv.pid
    WHERE p.source_type <> 'PURCHASED'
    GROUP BY lv.pid, p.source_type
    ORDER BY max(lv.lvl)
  LOOP
    g := coalesce((d ->> r.pid::text)::numeric, 0);
    IF r.st = 'ASSEMBLED_STOCKED' THEN
      -- A stocked sub-assembly: use what is free first. Free = in store + being
      -- built for stock - held by open vouchers. A negative figure is held
      -- beyond what exists, so it still has to be built.
      SELECT coalesce((SELECT sum(sb.quantity) FROM public.stock_balance sb JOIN public.stock_locations sl ON sl.id = sb.location_id
                        WHERE sb.part_id = r.pid AND sl.location_type = 'STORE' AND (p_plant IS NULL OR sb.plant_id = p_plant)), 0)
           + coalesce((SELECT sum(o.quantity) FROM public.production_orders o
                        WHERE o.part_id = r.pid AND o.parent_order_id IS NULL AND o.status NOT IN ('OQC_PASSED', 'OQC_FAILED', 'CANCELLED')
                          AND (p_plant IS NULL OR o.plant_id = p_plant)), 0)
           - coalesce((SELECT sum(h.quantity) FROM public.stock_holds h
                        WHERE h.part_id = r.pid AND h.status = 'ACTIVE' AND (p_plant IS NULL OR h.plant_id = p_plant)), 0)
        INTO v_free;
      v_net := CASE WHEN v_free >= 0 THEN greatest(g - v_free, 0) ELSE g - v_free END;
    ELSE
      v_net := g;
    END IF;
    IF v_net > 0 THEN
      FOR c IN SELECT b.child_part_id AS cid, coalesce(b.quantity, 0) AS q FROM public.bom b WHERE b.parent_part_id = r.pid AND b.is_active LOOP
        d := jsonb_set(d, ARRAY[c.cid::text], to_jsonb(coalesce((d ->> c.cid::text)::numeric, 0) + v_net * c.q));
      END LOOP;
    END IF;
  END LOOP;

  RETURN QUERY
  WITH RECURSIVE
  hold AS (
    SELECT h.part_id AS pid, sum(h.quantity) AS q, min(h.needed_on) AS needed,
           jsonb_agg(jsonb_build_object('label', coalesce(o.voucher_number || ' ' || fp.part_code, h.source::text), 'customer', 'Voucher', 'quantity', h.quantity, 'needed_on', h.needed_on)
                     ORDER BY h.needed_on) AS src
    FROM public.stock_holds h
    LEFT JOIN public.production_orders o ON o.id = h.production_order_id
    LEFT JOIN public.parts fp ON fp.id = o.part_id
    WHERE h.status = 'ACTIVE' AND (p_plant IS NULL OR h.plant_id = p_plant)
    GROUP BY h.part_id
  ),
  -- Which projection needs which part (before sub-assembly stock is used up).
  ex AS (
    SELECT pr.id AS proj, b.child_part_id AS pid,
           (pr.quantity - greatest(pr.vouchered_quantity, pr.produced_quantity)) * coalesce(b.quantity, 0) AS q, 1 AS depth
    FROM public.projections pr
    JOIN public.bom b ON b.parent_part_id = pr.part_id AND b.is_active
    WHERE pr.quantity - greatest(pr.vouchered_quantity, pr.produced_quantity) > 0
    UNION ALL
    SELECT ex.proj, b.child_part_id, ex.q * coalesce(b.quantity, 0), ex.depth + 1
    FROM ex JOIN public.bom b ON b.parent_part_id = ex.pid AND b.is_active
    WHERE ex.depth < 12
  ),
  proj AS (
    SELECT x.pid, min(pr.month) AS needed,
           jsonb_agg(jsonb_build_object('label', fp.part_code || ' ' || fp.name, 'customer', cu.name, 'quantity', x.q, 'needed_on', pr.month) ORDER BY pr.month) AS src
    FROM (SELECT ex.proj, ex.pid, sum(ex.q) AS q FROM ex GROUP BY ex.proj, ex.pid) x
    JOIN public.projections pr ON pr.id = x.proj
    JOIN public.parts fp ON fp.id = pr.part_id
    LEFT JOIN public.customers cu ON cu.id = pr.customer_id
    GROUP BY x.pid
  ),
  stock AS (
    SELECT sb.part_id AS pid,
           sum(sb.quantity) FILTER (WHERE sl.location_type = 'STORE') AS store,
           sum(sb.quantity) FILTER (WHERE sl.location_type = 'QUARANTINE') AS iqc
    FROM public.stock_balance sb
    JOIN public.stock_locations sl ON sl.id = sb.location_id
    WHERE p_plant IS NULL OR sb.plant_id = p_plant
    GROUP BY sb.part_id
  ),
  po AS (
    SELECT i.part_id AS pid,
           sum(greatest(i.quantity - i.received_quantity, 0)) FILTER (WHERE o.status IN ('APPROVED', 'PARTIALLY_RECEIVED')) AS q,
           jsonb_agg(jsonb_build_object(
             'po_number', o.po_number, 'status', o.status, 'vendor', v.name, 'is_import', o.is_import,
             'pending', greatest(i.quantity - i.received_quantity, 0),
             'expected', o.promised_delivery_date,
             'on_the_way', (SELECT coalesce(sum(m.quantity), 0) FROM public.container_materials m
                             JOIN public.import_containers ic ON ic.id = m.container_id
                            WHERE m.purchase_order_item_id = i.id AND ic.current_status <> 'AT_FACTORY'))
             ORDER BY o.po_date) AS list
    FROM public.purchase_order_items i
    JOIN public.purchase_orders o ON o.id = i.purchase_order_id
    JOIN public.vendors v ON v.id = o.vendor_id
    WHERE o.status IN ('PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED')
      AND i.quantity > i.received_quantity
      AND (p_plant IS NULL OR o.plant_id = p_plant)
    GROUP BY i.part_id
  ),
  base AS (
    SELECT p.id AS pid,
           coalesce(hold.q, 0) AS fv,
           coalesce((d ->> p.id::text)::numeric, 0) AS fp,
           coalesce(stock.store, 0) AS st,
           coalesce(stock.iqc, 0) AS iq,
           coalesce(po.q, 0) AS oo
    FROM public.parts p
    LEFT JOIN hold ON hold.pid = p.id
    LEFT JOIN stock ON stock.pid = p.id
    LEFT JOIN po ON po.pid = p.id
    WHERE p.source_type = 'PURCHASED'
      AND (coalesce(hold.q, 0) > 0 OR coalesce((d ->> p.id::text)::numeric, 0) > 0)
  )
  SELECT p.id, p.part_code, p.name, p.category, coalesce(p.uom, 'PCS'),
         b.fv, b.fp, b.st, b.iq, b.oo,
         greatest(b.fv + b.fp - b.st - b.iq, 0),
         greatest(b.fv + b.fp - b.st - b.iq - b.oo, 0),
         least(hold.needed, proj.needed),
         pv.vendor_id, pv.vendor_name, p.unit_price, p.currency,
         coalesce(hold.src, '[]'::jsonb) || coalesce(proj.src, '[]'::jsonb),
         coalesce(po.list, '[]'::jsonb)
  FROM base b
  JOIN public.parts p ON p.id = b.pid
  LEFT JOIN hold ON hold.pid = p.id
  LEFT JOIN proj ON proj.pid = p.id
  LEFT JOIN po ON po.pid = p.id
  LEFT JOIN LATERAL (
    SELECT x.vendor_id, v.name AS vendor_name
    FROM public.part_vendors x JOIN public.vendors v ON v.id = x.vendor_id
    WHERE x.part_id = p.id
    ORDER BY x.is_primary DESC, x.created_at
    LIMIT 1
  ) pv ON true
  ORDER BY greatest(b.fv + b.fp - b.st - b.iq, 0) DESC, p.part_code;
END $$;

REVOKE ALL ON FUNCTION public.shortage_lines(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shortage_lines(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.voucher_net_issued(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.voucher_net_issued(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_kit_item_holds() FROM PUBLIC, anon;

COMMENT ON FUNCTION public.shortage_lines(uuid) IS 'The shortage list: per purchased part, what open vouchers and unvouchered projections still need, against store stock, stock waiting for IQC and purchase orders already placed.';

-- How many parts are short: one number for dashboard tiles.
CREATE OR REPLACE FUNCTION public.shortage_count(p_plant uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::integer FROM public.shortage_lines(p_plant) s WHERE s.shortage > 0
$$;
REVOKE ALL ON FUNCTION public.shortage_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shortage_count(uuid) TO authenticated, service_role;
