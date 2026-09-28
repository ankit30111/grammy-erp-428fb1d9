-- One place to see whether the data still adds up.
--
-- system_health_check() runs every consistency rule the ERP depends on and
-- returns one row per rule: OK, or WARN / ERROR with how many records break it
-- and which ones. When something looks wrong on a screen, run this first:
-- it says which table and which records to look at.

DROP FUNCTION IF EXISTS public.system_health_check();
CREATE FUNCTION public.system_health_check()
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
