-- R&D is a trial: nothing done in R&D may change the live ERP.
--
-- The one link left is a reference: an R&D product points at its model
-- (parts.plm_product_id on the model row, e.g. JA-006). Its brand codes are
-- reached through the model. R&D reads production data (BOMs, vouchers) but
-- writes only its own plm_* tables and, before a model's first release, the
-- model's v1.0 draft - which production does not use.
--
-- Switched off:
--   * the stage-6 freeze that turned Management's BOM saves into change requests
--   * pilot vouchers scheduled from R&D
--   * customer complaints raising R&D issues
--   * R&D publishing into production BOMs, or opening ECNs on released models
--   * R&D rules in the System Check

-- 1. BOM saves no longer look at R&D.
CREATE OR REPLACE FUNCTION public.save_bom(p_parent uuid, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_req uuid; v_result jsonb; v_frozen boolean;
BEGIN
  IF NOT public.can_edit_masters() THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can change a bill of materials' USING ERRCODE = '42501';
  END IF;
  IF (SELECT source_type FROM public.parts WHERE id = p_parent) = 'PURCHASED' THEN
    RAISE EXCEPTION 'A purchased part cannot have a bill of materials';
  END IF;
  IF (SELECT source_type FROM public.parts WHERE id = p_parent) = 'MODEL' THEN
    RAISE EXCEPTION 'A model''s BOM is kept per version. Change it on the Models page (an ECN once it is released).';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
              WHERE (l->>'child_part_id')::uuid = p_parent
                 OR (NOT coalesce((l->>'bulk')::boolean, false) AND coalesce((l->>'quantity')::numeric, 0) <= 0)) THEN
    RAISE EXCEPTION 'Every line needs a quantity above zero (or is marked bulk), and a part cannot be inside itself';
  END IF;

  v_frozen := false;   -- R&D stages never hold up a production BOM

  IF public.can_approve() AND NOT v_frozen THEN
    v_result := public.apply_bom(p_parent, p_lines);
    RETURN v_result || jsonb_build_object('applied', true);
  END IF;

  UPDATE public.bom_change_requests
     SET lines = p_lines, submitted_by = auth.uid(), submitted_at = now()
   WHERE parent_part_id = p_parent AND status = 'PENDING'
  RETURNING id INTO v_req;
  IF v_req IS NULL THEN
    INSERT INTO public.bom_change_requests (parent_part_id, lines) VALUES (p_parent, p_lines)
    RETURNING id INTO v_req;
  END IF;
  RETURN jsonb_build_object('applied', false, 'request_id', v_req, 'frozen', v_frozen);
END $function$;

-- 2. Scheduling no longer looks at R&D; pilot vouchers from R&D are off.
CREATE OR REPLACE FUNCTION public.schedule_projection_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p record; v_msg text; v_versions text;
BEGIN
  SELECT source_type, part_code, is_active, brand_relevant, branded_from INTO p
    FROM public.parts WHERE id = NEW.part_id;
  IF NOT p.is_active THEN
    RAISE EXCEPTION '% is no longer active, so it cannot be scheduled', p.part_code;
  END IF;
  IF NEW.is_pilot THEN
    RAISE EXCEPTION 'Pilot builds from R&D are switched off while R&D is a trial. Schedule it as a normal voucher.';
  END IF;
  IF NEW.projection_id IS NULL AND NOT NEW.is_pilot THEN
    IF p.source_type = 'FINISHED_GOOD' THEN
      RAISE EXCEPTION '% is a finished good: schedule it from a customer projection', p.part_code;
    END IF;
    IF p.source_type IS DISTINCT FROM 'ASSEMBLED_STOCKED' THEN
      RAISE EXCEPTION '% is not built here, so it cannot be scheduled', p.part_code;
    END IF;
  END IF;
  IF p.brand_relevant AND p.branded_from IS NULL THEN
    SELECT string_agg(part_code, ', ' ORDER BY part_code) INTO v_versions
      FROM public.parts WHERE branded_from = NEW.part_id AND is_active;
    RAISE EXCEPTION '% is printed per brand (or has a printed part inside), so it is built per brand. Schedule %.',
      p.part_code, coalesce(v_versions, 'its brand version - tick the brand under Branding first');
  END IF;
  IF p.source_type = 'ASSEMBLED_STOCKED' AND NOT EXISTS (
    SELECT 1 FROM public.bom b WHERE b.parent_part_id = NEW.part_id AND b.is_active
  ) THEN
    RAISE EXCEPTION '% has no BOM yet. Add its bill of materials before scheduling it', p.part_code;
  END IF;
  IF p.source_type = 'FINISHED_GOOD' THEN
    SELECT string_agg(message, ' ') INTO v_msg FROM public.brand_sync_issues
     WHERE part_id = NEW.part_id AND kind = 'GAP';
    IF v_msg IS NULL AND EXISTS (
      SELECT 1 FROM public.bom b JOIN public.parts c ON c.id = b.child_part_id
       WHERE b.parent_part_id = NEW.part_id AND b.is_active AND c.brand_relevant AND c.branded_from IS NULL
    ) THEN
      v_msg := p.part_code || ' uses a part that is printed per brand, and its brand version is missing. Check Branding on its parts.';
    END IF;
    IF v_msg IS NOT NULL THEN
      RAISE EXCEPTION '%', v_msg;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.plm_schedule_pilot(p_plant_id uuid, p_part_id uuid, p_quantity numeric, p_date date, p_line_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Pilot builds from R&D are switched off while R&D is a trial. Schedule it from Planning as a normal voucher.';
END $function$;

-- 3. Complaints stay in Quality; R&D raises its own issues.
DROP TRIGGER IF EXISTS trg_plm_complaint_to_issue ON public.customer_complaints;

-- 4. The System Check covers the live ERP only.
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

-- 5. The R&D product links to a model; brand codes come through the model.
UPDATE public.parts SET plm_product_id = NULL WHERE source_type <> 'MODEL' AND plm_product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.plm_product_codes(p_product uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT b.id FROM public.parts m JOIN public.parts b ON b.model_id = m.id
   WHERE m.plm_product_id = p_product AND m.source_type = 'MODEL' AND b.is_active
$function$;
REVOKE ALL ON FUNCTION public.plm_product_codes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plm_product_codes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.plm_link_part(p_product uuid, p_part uuid, p_link boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_type public.part_source_type; v_other uuid; v_code text;
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can link a model' USING ERRCODE = '42501'; END IF;
  SELECT source_type, plm_product_id, part_code INTO v_type, v_other, v_code FROM public.parts WHERE id = p_part;
  IF v_type IS DISTINCT FROM 'MODEL' THEN RAISE EXCEPTION 'An R&D product is linked to a model (e.g. JA-006), not to a brand code'; END IF;
  IF p_link AND v_other IS NOT NULL AND v_other <> p_product THEN
    RAISE EXCEPTION '% already belongs to R&D product %', v_code, (SELECT product_code FROM public.plm_products WHERE id = v_other);
  END IF;
  IF p_link AND EXISTS (SELECT 1 FROM public.parts WHERE plm_product_id = p_product AND source_type = 'MODEL' AND id <> p_part) THEN
    RAISE EXCEPTION 'This R&D product is already linked to a model. Unlink it first.';
  END IF;
  PERFORM set_config('app.approving', 'on', true);
  UPDATE public.parts SET plm_product_id = CASE WHEN p_link THEN p_product END WHERE id = p_part;
  PERFORM set_config('app.approving', 'off', true);
  PERFORM public.plm_refresh(p_product);
END $function$;

CREATE OR REPLACE FUNCTION public.plm_metrics(p_product uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v jsonb; v_fgs uuid[]; v_dev jsonb;
  n_lines int; n_done int; n_purch int; n_spec int; n_foreign int;
  evt_t int; evt_p int; svt_t int; svt_p int; svt_open int; open_iss int; v_cost jsonb; v_del jsonb; v_pp jsonb;
BEGIN
  SELECT array_agg(id) INTO v_fgs FROM public.plm_product_codes(p_product) id;

  WITH RECURSIVE tree(part_id, depth) AS (
    SELECT b.child_part_id, 1 FROM public.bom b WHERE b.parent_part_id = ANY (coalesce(v_fgs, '{}')) AND b.is_active
    UNION
    SELECT b.child_part_id, t.depth + 1 FROM tree t JOIN public.bom b ON b.parent_part_id = t.part_id AND b.is_active WHERE t.depth < 12
  ), lines AS (
    SELECT DISTINCT p.id, p.source_type, p.approval_status, coalesce(p.branded_from, p.id) AS holder
      FROM tree t JOIN public.parts p ON p.id = t.part_id
  ), judged AS (
    SELECT l.*,
      CASE WHEN l.source_type = 'PURCHASED' THEN
             l.approval_status = 'APPROVED'
             AND EXISTS (SELECT 1 FROM public.part_vendors pv WHERE pv.part_id = l.holder AND pv.is_primary)
             AND coalesce(h.unit_price, 0) > 0
             AND (h.specification_sheet_url IS NOT NULL OR h.iqc_checklist_url IS NOT NULL)
           ELSE l.approval_status = 'APPROVED' AND EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = l.id AND b.is_active)
      END AS done,
      (l.source_type = 'PURCHASED') AS purch,
      (h.specification_sheet_url IS NOT NULL) AS spec
      FROM lines l JOIN public.parts h ON h.id = l.holder
  )
  SELECT count(*), count(*) FILTER (WHERE done), count(*) FILTER (WHERE purch), count(*) FILTER (WHERE purch AND spec)
    INTO n_lines, n_done, n_purch, n_spec FROM judged;

  -- Cost per finished good: QPS multiplied down the tree x price of purchased parts.
  WITH RECURSIVE ex(fg, part_id, qty, depth) AS (
    SELECT b.parent_part_id, b.child_part_id, coalesce(b.quantity, 0), 1
      FROM public.bom b WHERE b.parent_part_id = ANY (coalesce(v_fgs, '{}')) AND b.is_active
    UNION ALL
    SELECT e.fg, b.child_part_id, e.qty * coalesce(b.quantity, 0), e.depth + 1
      FROM ex e JOIN public.bom b ON b.parent_part_id = e.part_id AND b.is_active WHERE e.depth < 12
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('part_id', x.fg, 'part_code', fp.part_code, 'cost', round(x.cost, 2),
                                               'unpriced', x.unpriced, 'foreign', x.foreign) ORDER BY fp.part_code), '[]'::jsonb)
    INTO v_cost
    FROM (SELECT e.fg,
                 sum(e.qty * coalesce(h.unit_price, 0)) FILTER (WHERE upper(coalesce(h.currency, 'INR')) = 'INR') AS cost,
                 count(*) FILTER (WHERE coalesce(h.unit_price, 0) = 0) AS unpriced,
                 count(*) FILTER (WHERE upper(coalesce(h.currency, 'INR')) <> 'INR') AS foreign
            FROM ex e JOIN public.parts p ON p.id = e.part_id AND p.source_type = 'PURCHASED'
            JOIN public.parts h ON h.id = coalesce(p.branded_from, p.id)
           GROUP BY e.fg) x
    JOIN public.parts fp ON fp.id = x.fg;

  SELECT count(*) FILTER (WHERE phase = 'EVT'), count(*) FILTER (WHERE phase = 'EVT' AND result = 'PASS'),
         count(*) FILTER (WHERE phase = 'SVT'), count(*) FILTER (WHERE phase = 'SVT' AND result = 'PASS'),
         count(*) FILTER (WHERE phase = 'SVT' AND result <> 'PASS')
    INTO evt_t, evt_p, svt_t, svt_p, svt_open FROM public.plm_tests WHERE product_id = p_product;
  SELECT count(*) INTO open_iss FROM public.plm_issues WHERE product_id = p_product AND status = 'OPEN';

  SELECT jsonb_object_agg(s.stage, jsonb_build_object('total', s.total, 'done', s.done, 'open', s.open_keys))
    INTO v_del
    FROM (SELECT t.stage, count(*) AS total, count(*) FILTER (WHERE d.status IN ('CLOSED', 'NA')) AS done,
                 coalesce(jsonb_agg(t.label ORDER BY t.sort) FILTER (WHERE d.status NOT IN ('CLOSED', 'NA')), '[]'::jsonb) AS open_keys
            FROM public.plm_deliverables d JOIN public.plm_deliverable_template t ON t.key = d.key
           WHERE d.product_id = p_product GROUP BY t.stage) s;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'voucher_number', o.voucher_number, 'part_code', p.part_code,
            'quantity', o.quantity, 'produced', o.produced_quantity, 'status', o.status, 'planned_date', o.planned_date)
            ORDER BY o.planned_date), '[]'::jsonb)
    INTO v_pp
    FROM public.production_orders o JOIN public.parts p ON p.id = o.part_id
   WHERE o.is_pilot AND p.id IN (SELECT public.plm_product_codes(p_product));

  -- The development BOM: each line Design / Sample / Approval / Release, 25% each.
  SELECT jsonb_build_object(
      'lines', count(*),
      'pct', coalesce(round(avg((design_done::int + sample_done::int + approval_done::int + release_done::int) * 25.0), 1), 0),
      'design', count(*) FILTER (WHERE design_done), 'sample', count(*) FILTER (WHERE sample_done),
      'approval', count(*) FILTER (WHERE approval_done), 'release', count(*) FILTER (WHERE release_done),
      'complete', count(*) FILTER (WHERE release_done),
      'no_code', count(*) FILTER (WHERE l.part_id IS NULL),
      'no_qty', count(*) FILTER (WHERE NOT l.bulk AND coalesce(l.quantity, 0) <= 0),
      'cost', round(coalesce(sum(CASE WHEN l.bulk THEN 0 ELSE l.quantity END
                * coalesce(nullif(h.unit_price, 0), l.quoted_price, 0)), 0), 2),
      'unpriced', count(*) FILTER (WHERE NOT l.bulk AND coalesce(nullif(h.unit_price, 0), l.quoted_price, 0) = 0))
    INTO v_dev
    FROM public.plm_bom_lines l
    LEFT JOIN public.parts p ON p.id = l.part_id
    LEFT JOIN public.parts h ON h.id = coalesce(p.branded_from, p.id)
   WHERE l.product_id = p_product;

  RETURN jsonb_build_object(
    'dev_bom', v_dev,
    'bom_pct', (v_dev->>'pct')::numeric,
    'fg_count', coalesce(array_length(v_fgs, 1), 0),
    -- Part master data of the production BOM (code approved, vendor, price, spec).
    'master_lines', n_lines, 'master_done', n_done,
    'master_pct', CASE WHEN n_lines > 0 THEN round(100.0 * n_done / n_lines, 1) ELSE 0 END,
    'spec_pct', CASE WHEN n_purch > 0 THEN round(100.0 * n_spec / n_purch, 1) ELSE 0 END,
    'cost', v_cost,
    'evt_total', evt_t, 'evt_pass', evt_p, 'svt_total', svt_t, 'svt_pass', svt_p, 'svt_not_passed', svt_open,
    'open_issues', open_iss,
    'deliverables', coalesce(v_del, '{}'::jsonb),
    'pilot_vouchers', v_pp);
END $function$;

CREATE OR REPLACE FUNCTION public.plm_bom_from_production(p_product uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE n int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D can change the BOM' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.plm_bom_lines WHERE product_id = p_product) THEN
    RAISE EXCEPTION 'This product already has a BOM';
  END IF;
  INSERT INTO public.plm_bom_lines (product_id, part_id, quantity, bulk, is_critical, change_type, sort)
  SELECT p_product, coalesce(c.branded_from, c.id), max(b.quantity), bool_or(b.issue_mode = 'BULK'), bool_or(b.is_critical),
         'CARRY_OVER', row_number() OVER (ORDER BY min(c.part_code))
    FROM public.parts fg JOIN public.bom b ON b.parent_part_id = fg.id AND b.is_active
    JOIN public.parts c ON c.id = b.child_part_id
   WHERE fg.id IN (SELECT public.plm_product_codes(p_product))
   GROUP BY coalesce(c.branded_from, c.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.plm_products SET bom_published_at = now() WHERE id = p_product;
  RETURN n;
END $function$;

CREATE OR REPLACE VIEW public.plm_catch_up AS
 SELECT pr.id AS product_id, pr.product_code, pr.name, pr.stage,
        count(DISTINCT o.id) AS open_vouchers,
        string_agg(DISTINCT o.voucher_number, ', ') AS vouchers,
        string_agg(DISTINCT p.part_code, ', ') AS part_codes
   FROM public.plm_products pr
   JOIN public.parts m ON m.plm_product_id = pr.id AND m.source_type = 'MODEL'
   JOIN public.parts p ON p.model_id = m.id
   JOIN public.production_orders o ON o.part_id = p.id AND NOT o.is_pilot
  WHERE pr.stage < 6 AND pr.status <> 'DROPPED'
  GROUP BY pr.id;

-- New brand codes carry no R&D link of their own.
CREATE OR REPLACE FUNCTION public.model_add_brand(p_model uuid, p_brand text, p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE m record; v_id uuid; v_code text; v_res jsonb := '{}'::jsonb; v_ver text; v_lines jsonb;
BEGIN
  IF NOT (public.can_edit_masters() OR public.can_edit_plm()) THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can add a brand' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO m FROM public.parts WHERE id = p_model AND source_type = 'MODEL';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not a model'; END IF;
  v_code := m.part_code || '-' || upper(btrim(p_brand));
  IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = v_code) THEN RAISE EXCEPTION '% already exists', v_code; END IF;
  INSERT INTO public.parts (part_code, name, category, uom, plm_product_id)
  VALUES (v_code, coalesce(nullif(btrim(p_name), ''), m.name), m.category, 'PCS', NULL)
  RETURNING id INTO v_id;
  SELECT mv.version, mv.lines INTO v_ver, v_lines FROM public.model_versions mv, public.parts p
   WHERE p.id = v_id AND mv.model_id = p_model AND mv.version = p.model_version;
  IF coalesce(jsonb_array_length(v_lines), 0) > 0 THEN
    v_res := CASE WHEN public.can_approve() THEN public.apply_bom(v_id, v_lines) || jsonb_build_object('applied', true)
                  ELSE public.save_bom(v_id, v_lines) END;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'part_code', v_code, 'version', v_ver, 'bom', v_res);
END $function$;

-- 6. Publishing R&D's BOM writes only a model's unreleased v1.0 draft.
-- Production BOMs are never written from R&D; a released model changes by an
-- ECN raised on the Models page.
CREATE OR REPLACE FUNCTION public.plm_publish_bom(p_product uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_lines jsonb; v_missing text; v_model record; v_ver uuid;
BEGIN
  IF NOT public.can_edit_plm() AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Only R&D can publish the BOM' USING ERRCODE = '42501';
  END IF;
  SELECT string_agg(description, ', ') INTO v_missing FROM public.plm_bom_lines WHERE product_id = p_product AND part_id IS NULL;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'These lines have no part code yet: %', v_missing; END IF;
  SELECT jsonb_agg(jsonb_build_object('child_part_id', part_id, 'quantity', quantity, 'bulk', bulk, 'is_critical', is_critical))
    INTO v_lines FROM public.plm_bom_lines WHERE product_id = p_product;
  IF v_lines IS NULL THEN RAISE EXCEPTION 'The BOM is empty'; END IF;

  SELECT id, part_code INTO v_model FROM public.parts
   WHERE plm_product_id = p_product AND source_type = 'MODEL' AND is_active LIMIT 1;
  IF v_model.id IS NULL THEN RAISE EXCEPTION 'Link this product to its model first'; END IF;
  IF EXISTS (SELECT 1 FROM public.model_versions WHERE model_id = v_model.id AND status = 'RELEASED') THEN
    RAISE EXCEPTION '% is released. Its BOM changes by an ECN on the Models page, not from R&D.', v_model.part_code;
  END IF;
  SELECT id INTO v_ver FROM public.model_versions WHERE model_id = v_model.id AND status = 'DRAFT';
  IF v_ver IS NULL THEN
    INSERT INTO public.model_versions (model_id, major, minor, kind, reason) VALUES (v_model.id, 1, 0, 'INITIAL', 'First version')
    RETURNING id INTO v_ver;
  END IF;
  UPDATE public.model_versions SET lines = public.model_clean_lines(v_model.id, v_lines), updated_at = now() WHERE id = v_ver;
  UPDATE public.plm_products SET bom_published_at = now() WHERE id = p_product;
  RETURN jsonb_build_array(jsonb_build_object('part_code', v_model.part_code,
    'result', jsonb_build_object('applied', true, 'version', (SELECT version FROM public.model_versions WHERE id = v_ver))));
END $function$;

-- Gate 4 publishes only into an unreleased model, and never fails the gate.
CREATE OR REPLACE FUNCTION public.plm_gate4_publish()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NEW.gate = 4 AND NEW.how IN ('AUTO', 'RECORDED', 'MANAGEMENT')
     AND EXISTS (SELECT 1 FROM public.parts m WHERE m.plm_product_id = NEW.product_id AND m.source_type = 'MODEL' AND m.is_active
                    AND NOT EXISTS (SELECT 1 FROM public.model_versions v WHERE v.model_id = m.id AND v.status = 'RELEASED'))
     AND NOT EXISTS (SELECT 1 FROM public.plm_bom_lines WHERE product_id = NEW.product_id AND part_id IS NULL)
     AND EXISTS (SELECT 1 FROM public.plm_bom_lines WHERE product_id = NEW.product_id) THEN
    BEGIN
      PERFORM public.plm_publish_bom(NEW.product_id);
    EXCEPTION WHEN others THEN NULL;   -- R&D's own step; it never blocks the gate
    END;
  END IF;
  RETURN NULL;
END $function$;
