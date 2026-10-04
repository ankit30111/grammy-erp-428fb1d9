-- Brand versions of a sub-assembly take its per-brand lines too; System Check
-- compares brand codes with R&D's version.
CREATE OR REPLACE FUNCTION public.sync_brand_variants()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  r record; v_lines jsonb; v_n int; v_iter int := 0;
  v_created int := 0; v_off int := 0; v_deleted int := 0; v_fg int := 0;
  v_missing text; v_bname text; v_path text;
BEGIN
  IF coalesce(current_setting('app.brand_sync', true), '') = 'on' THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parts WHERE branding_required OR branded_from IS NOT NULL OR brand_relevant) THEN
    DELETE FROM public.brand_sync_issues WHERE true;
    RETURN jsonb_build_object('skipped', true);
  END IF;

  PERFORM set_config('app.brand_sync', 'on', true);
  PERFORM set_config('app.approving', 'on', true);

  CREATE TEMP TABLE IF NOT EXISTS _relv (part_id uuid PRIMARY KEY, kind text, brands text[]) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _dem (part_id uuid, brand text, PRIMARY KEY (part_id, brand)) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _want (base_id uuid, brand text, code text, name text, kind text,
                                         PRIMARY KEY (base_id, brand)) ON COMMIT DROP;
  DELETE FROM _relv WHERE true; DELETE FROM _dem WHERE true; DELETE FROM _want WHERE true;
  DELETE FROM public.brand_sync_issues WHERE true;

  -- 1. Printed parts, with the brands ticked on them.
  INSERT INTO _relv
  SELECT p.id, 'PRINT',
         coalesce((SELECT array_agg(pb.brand ORDER BY pb.brand)
                     FROM public.part_brands pb JOIN public.brands b ON b.letter = pb.brand AND b.is_active
                    WHERE pb.part_id = p.id), '{}')
    FROM public.parts p
   WHERE p.branding_required AND p.branded_from IS NULL AND p.is_active AND p.source_type <> 'FINISHED_GOOD';

  -- 1b. Assemblies with lines for some brands only (from their released version).
  INSERT INTO _relv (part_id, kind, brands)
  SELECT DISTINCT bl.parent_part_id, 'ASSEMBLY', '{}'::text[]
    FROM public.bom_brand_lines bl JOIN public.parts pp ON pp.id = bl.parent_part_id
   WHERE pp.branded_from IS NULL AND pp.is_active
  ON CONFLICT (part_id) DO NOTHING;

  -- 2. Assemblies with a printed part inside, at any depth.
  LOOP
    v_iter := v_iter + 1;
    INSERT INTO _relv (part_id, kind, brands)
    SELECT DISTINCT b.parent_part_id, 'ASSEMBLY', '{}'::text[]
      FROM public.bom b
      JOIN _relv rv ON rv.part_id = b.child_part_id
      JOIN public.parts pp ON pp.id = b.parent_part_id
     WHERE b.is_active AND pp.branded_from IS NULL AND pp.is_active
       AND pp.source_type = 'ASSEMBLED_STOCKED' AND NOT pp.branding_required
    ON CONFLICT (part_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXIT WHEN v_n = 0 OR v_iter > 20;
  END LOOP;

  -- 3. Which brands are asked for: every branded finished good that uses the
  --    part (the line may already hold its brand version), passed down through
  --    assemblies to what is inside them.
  INSERT INTO _dem (part_id, brand)
  SELECT DISTINCT rv.part_id, fg.brand
    FROM public.bom b
    JOIN public.parts fg ON fg.id = b.parent_part_id AND fg.source_type = 'FINISHED_GOOD'
                        AND fg.brand IS NOT NULL AND fg.is_active
    JOIN public.parts ch ON ch.id = b.child_part_id
    JOIN _relv rv ON rv.part_id = coalesce(ch.branded_from, ch.id)
   WHERE b.is_active
  ON CONFLICT DO NOTHING;
  v_iter := 0;
  LOOP
    v_iter := v_iter + 1;
    INSERT INTO _dem (part_id, brand)
    SELECT DISTINCT rc.part_id, d.brand
      FROM _dem d
      JOIN _relv ra ON ra.part_id = d.part_id AND ra.kind = 'ASSEMBLY'
      JOIN (SELECT parent_part_id, child_part_id, NULL::text AS brand FROM public.bom WHERE is_active
            UNION ALL SELECT parent_part_id, child_part_id, brand FROM public.bom_brand_lines) b
        ON b.parent_part_id = ra.part_id AND (b.brand IS NULL OR b.brand = d.brand)
      JOIN _relv rc ON rc.part_id = b.child_part_id
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXIT WHEN v_n = 0 OR v_iter > 20;
  END LOOP;

  -- 4. An assembly is made for the brands asked of it that every printed part
  --    inside it can give. Prune until stable.
  UPDATE _relv rv SET brands = coalesce(
      (SELECT array_agg(d.brand ORDER BY d.brand) FROM _dem d WHERE d.part_id = rv.part_id), '{}')
   WHERE rv.kind = 'ASSEMBLY';
  v_iter := 0;
  LOOP
    v_iter := v_iter + 1;
    WITH calc AS (
      SELECT ra.part_id,
             coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(ra.brands) x
                        WHERE NOT EXISTS (
                          SELECT 1 FROM public.bom b JOIN _relv rc ON rc.part_id = b.child_part_id
                           WHERE b.parent_part_id = ra.part_id AND b.is_active AND NOT (x = ANY (rc.brands)))), '{}') AS brands
        FROM _relv ra WHERE ra.kind = 'ASSEMBLY'
    )
    UPDATE _relv rv SET brands = calc.brands FROM calc
     WHERE rv.part_id = calc.part_id AND rv.brands IS DISTINCT FROM calc.brands;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXIT WHEN v_n = 0 OR v_iter > 20;
  END LOOP;

  -- An assembly printed after assembly that also has printed parts inside.
  INSERT INTO public.brand_sync_issues (part_id, part_code, kind, message)
  SELECT DISTINCT p.id, p.part_code, 'CONFLICT',
         format('%s is ticked as printed after assembly but also contains printed parts (%s). Untick Branding on %s: its brand versions come from the parts inside it.',
                p.part_code, string_agg(DISTINCT cp.part_code, ', '), p.part_code)
    FROM _relv rv JOIN public.parts p ON p.id = rv.part_id
    JOIN public.bom b ON b.parent_part_id = rv.part_id AND b.is_active
    JOIN _relv rc ON rc.part_id = b.child_part_id
    JOIN public.parts cp ON cp.id = rc.part_id
   WHERE rv.kind = 'PRINT'
   GROUP BY p.id, p.part_code;

  -- 5. The versions that should exist.
  INSERT INTO _want (base_id, brand, code, name, kind)
  SELECT p.id, x, p.part_code || '-' || x, p.name || ' · ' || br.name, rv.kind
    FROM _relv rv JOIN public.parts p ON p.id = rv.part_id, unnest(rv.brands) x
    JOIN public.brands br ON br.letter = x;

  FOR r IN
    SELECT w.*, v.id AS vid, bp.category, bp.uom, bp.pqc_checklist_url, bp.plant_id,
           (SELECT tier FROM public.part_categories c WHERE c.prefix = bp.category) AS tier
      FROM _want w
      JOIN public.parts bp ON bp.id = w.base_id
      LEFT JOIN public.parts v ON v.branded_from = w.base_id AND v.brand = w.brand
  LOOP
    IF r.vid IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = r.code) THEN
        INSERT INTO public.brand_sync_issues (part_id, part_code, kind, brand, message)
        VALUES (r.base_id, r.code, 'COLLISION', r.brand,
                format('%s already exists as a separate part, so the %s version of this part could not be created.', r.code, r.brand));
        DELETE FROM _want WHERE base_id = r.base_id AND brand = r.brand;
        CONTINUE;
      END IF;
      INSERT INTO public.parts (part_code, name, category, uom, made_in_house, branded_from, brand,
                                approval_status, is_active, pqc_checklist_url, plant_id, created_by)
      VALUES (r.code, r.name, r.category, r.uom, r.tier = 'PURCHASE', r.base_id, r.brand,
              'APPROVED', true, r.pqc_checklist_url, r.plant_id, auth.uid());
      v_created := v_created + 1;
    ELSE
      UPDATE public.parts SET name = r.name, uom = r.uom, is_active = true
       WHERE id = r.vid AND (name IS DISTINCT FROM r.name OR uom IS DISTINCT FROM r.uom OR NOT is_active);
    END IF;
  END LOOP;

  -- 6. Their BOMs.
  FOR r IN
    SELECT w.*, v.id AS vid, bp.uom AS base_uom
      FROM _want w
      JOIN public.parts v ON v.branded_from = w.base_id AND v.brand = w.brand
      JOIN public.parts bp ON bp.id = w.base_id
  LOOP
    IF r.kind = 'PRINT' THEN
      v_lines := jsonb_build_array(jsonb_build_object('child_part_id', r.base_id, 'quantity', 1,
                                                      'uom', coalesce(r.base_uom, 'PCS'), 'is_critical', true));
    ELSE
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'child_part_id', coalesce(cv.id, b.child_part_id),
               'quantity', b.quantity, 'uom', b.uom, 'is_critical', b.is_critical,
               'bulk', b.issue_mode = 'BULK')), '[]'::jsonb)
        INTO v_lines
        FROM (SELECT child_part_id, quantity, uom, is_critical, issue_mode FROM public.bom
               WHERE parent_part_id = r.base_id AND is_active
              UNION ALL
              SELECT bl.child_part_id, bl.quantity, coalesce(cp.uom, 'PCS'), bl.is_critical, bl.issue_mode
                FROM public.bom_brand_lines bl JOIN public.parts cp ON cp.id = bl.child_part_id
               WHERE bl.parent_part_id = r.base_id AND bl.brand = r.brand) b
        LEFT JOIN _relv rc ON rc.part_id = b.child_part_id
        LEFT JOIN public.parts cv ON rc.part_id IS NOT NULL AND cv.branded_from = b.child_part_id AND cv.brand = r.brand;
    END IF;
    PERFORM public.apply_bom(r.vid, v_lines);
  END LOOP;

  -- 7. Versions nothing needs: retire, and finished goods go back to the base part.
  UPDATE public.parts v SET is_active = false
   WHERE v.branded_from IS NOT NULL AND v.is_active
     AND NOT EXISTS (SELECT 1 FROM _want w WHERE w.base_id = v.branded_from AND w.brand = v.brand);
  GET DIAGNOSTICS v_off = ROW_COUNT;

  UPDATE public.bom b SET child_part_id = v.branded_from
    FROM public.parts v, public.parts fg
   WHERE b.child_part_id = v.id AND v.branded_from IS NOT NULL AND NOT v.is_active
     AND b.is_active AND fg.id = b.parent_part_id AND fg.source_type = 'FINISHED_GOOD'
     AND NOT EXISTS (SELECT 1 FROM public.bom x WHERE x.parent_part_id = b.parent_part_id
                        AND x.child_part_id = v.branded_from AND x.is_active);

  --    ...and a retired version that was never used is removed altogether.
  FOR r IN SELECT v.id FROM public.parts v WHERE v.branded_from IS NOT NULL AND NOT v.is_active LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.bom b JOIN public.parts pp ON pp.id = b.parent_part_id
       WHERE b.child_part_id = r.id AND NOT (pp.branded_from IS NOT NULL AND NOT pp.is_active));
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM unnest(public.part_usage(r.id)) u
       WHERE u NOT LIKE 'the BOM of%' AND u NOT LIKE 'brand sync issues%' AND u NOT LIKE 'part brands%');
    DELETE FROM public.bom WHERE parent_part_id = r.id;
    DELETE FROM public.bom WHERE child_part_id = r.id;
    DELETE FROM public.parts WHERE id = r.id;
    v_deleted := v_deleted + 1;
  END LOOP;

  -- 8. Finished goods: keep each printed / per-brand line on the product's own
  --    brand version, or say exactly why there is none.
  FOR r IN
    SELECT b.id AS bom_id, b.parent_part_id, fg.part_code AS fg_code, fg.brand, c.id AS cid, c.part_code AS child_code,
           v.id AS vid
      FROM public.bom b
      JOIN public.parts fg ON fg.id = b.parent_part_id AND fg.source_type = 'FINISHED_GOOD' AND fg.brand IS NOT NULL
      JOIN public.parts c ON c.id = b.child_part_id AND c.branded_from IS NULL
      JOIN _relv rc ON rc.part_id = c.id
      LEFT JOIN public.parts v ON v.branded_from = c.id AND v.brand = fg.brand AND v.is_active
     WHERE b.is_active
  LOOP
    IF r.vid IS NULL THEN
      -- The printed parts under this line that lack the brand, and where they sit.
      WITH RECURSIVE t(pid, parent_code) AS (
        SELECT r.cid, NULL::text
        UNION
        SELECT b2.child_part_id, pp.part_code FROM public.bom b2 JOIN t ON b2.parent_part_id = t.pid
          JOIN _relv r2 ON r2.part_id = b2.child_part_id
          JOIN public.parts pp ON pp.id = b2.parent_part_id
         WHERE b2.is_active
      )
      SELECT string_agg(DISTINCT p.part_code, ', '),
             string_agg(DISTINCT CASE WHEN t.parent_code IS NOT NULL THEN p.part_code || ' out of ' || t.parent_code END, ', ')
        INTO v_missing, v_path
        FROM t JOIN _relv rr ON rr.part_id = t.pid AND rr.kind = 'PRINT' AND NOT (r.brand = ANY (rr.brands))
        JOIN public.parts p ON p.id = t.pid;
      SELECT name INTO v_bname FROM public.brands WHERE letter = r.brand;
      INSERT INTO public.brand_sync_issues (part_id, part_code, kind, brand, message)
      VALUES (r.parent_part_id, r.fg_code, 'GAP', r.brand,
              CASE WHEN (SELECT kind FROM _relv WHERE part_id = r.cid) = 'PRINT' THEN
                format('%s (%s) uses %s, which is printed per brand but not ticked for %s. Tick %s under Branding on %s.',
                       r.fg_code, coalesce(v_bname, r.brand), r.child_code, coalesce(v_bname, r.brand), r.brand, r.child_code)
              ELSE
                format('%s (%s) uses %s, which has a part printed per brand inside it that is not ticked for %s. Tick %s under Branding on %s%s.',
                       r.fg_code, coalesce(v_bname, r.brand), r.child_code, coalesce(v_bname, r.brand), r.brand,
                       coalesce(v_missing, r.child_code),
                       CASE WHEN v_path IS NOT NULL THEN ', or take ' || v_path || ' if it does not belong there' ELSE '' END)
              END);
    ELSE
      IF EXISTS (SELECT 1 FROM public.bom x WHERE x.parent_part_id = r.parent_part_id AND x.child_part_id = r.vid AND x.is_active) THEN
        DELETE FROM public.bom WHERE id = r.bom_id;
      ELSE
        UPDATE public.bom SET child_part_id = r.vid WHERE id = r.bom_id;
      END IF;
      v_fg := v_fg + 1;
    END IF;
  END LOOP;

  -- 9. Which base parts are built per brand.
  UPDATE public.parts p SET brand_relevant = EXISTS (SELECT 1 FROM _relv rv WHERE rv.part_id = p.id)
   WHERE p.branded_from IS NULL
     AND p.brand_relevant IS DISTINCT FROM EXISTS (SELECT 1 FROM _relv rv WHERE rv.part_id = p.id);

  PERFORM set_config('app.approving', 'off', true);
  PERFORM set_config('app.brand_sync', 'off', true);
  RETURN jsonb_build_object('created', v_created, 'retired', v_off, 'deleted', v_deleted, 'product_lines', v_fg,
                            'issues', (SELECT count(*) FROM public.brand_sync_issues));
END $function$;

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
END $function$;
