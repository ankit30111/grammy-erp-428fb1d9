-- Brand versions of an assembly follow the products that use it.
--
-- What went wrong (SA-001, 28 Sep):
--   P-429 (Croma mic ring) is ticked for CR only. It was added to SA-001, the
--   J6C top panel used by the PHILIPS product JA-06C-PH. The old rule gave an
--   assembly "every brand its printed parts are ticked for", so SA-001 got a
--   Croma version nobody uses, while the Philips product it really serves was
--   left without one (and blocked). Unticking SA-001's own box changed
--   nothing, because that box means something else (printed after assembly),
--   and versions could never be removed, only retired.
--
-- Now:
--   * A printed part's versions = the brands ticked on it (unchanged).
--   * An assembly's versions = the brands of the finished goods that use it
--     (directly or through other assemblies), for which every printed part
--     inside it is ticked. A brand a product needs but a printed part lacks is
--     reported against that product, naming the part and both ways to fix it.
--   * A version nothing needs is deleted if it was never used (no stock,
--     voucher, order...), otherwise retired.
--   * The tick box on an assembly that already contains printed parts is
--     refused: its versions come from what is inside it.

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
      JOIN public.bom b ON b.parent_part_id = ra.part_id AND b.is_active
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
        FROM public.bom b
        LEFT JOIN _relv rc ON rc.part_id = b.child_part_id
        LEFT JOIN public.parts cv ON rc.part_id IS NOT NULL AND cv.branded_from = b.child_part_id AND cv.brand = r.brand
       WHERE b.parent_part_id = r.base_id AND b.is_active;
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

-- The tick box: refused on an assembly whose versions come from its contents.
CREATE OR REPLACE FUNCTION public.set_part_branding(p_part_id uuid, p_required boolean, p_brands text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p public.parts; v_bad text; v_inside text; v_result jsonb;
BEGIN
  IF NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can change branding' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.parts WHERE id = p_part_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Part not found'; END IF;
  IF p.branded_from IS NOT NULL THEN
    RAISE EXCEPTION '% is already a brand version. Set branding on the base part.', p.part_code;
  END IF;
  IF p.source_type = 'FINISHED_GOOD' THEN
    RAISE EXCEPTION 'A finished good already carries its brand in its code';
  END IF;
  IF coalesce(p_required, false) THEN
    SELECT string_agg(c.part_code, ', ' ORDER BY c.part_code) INTO v_inside
      FROM public.bom b JOIN public.parts c ON c.id = b.child_part_id
     WHERE b.parent_part_id = p_part_id AND b.is_active AND (c.branding_required OR c.brand_relevant);
    IF v_inside IS NOT NULL THEN
      RAISE EXCEPTION '% contains printed parts (%). Its brand versions follow the products that use it, so it is not ticked itself.',
        p.part_code, v_inside;
    END IF;
  END IF;
  SELECT string_agg(x, ', ') INTO v_bad FROM unnest(coalesce(p_brands, '{}')) x
   WHERE NOT EXISTS (SELECT 1 FROM public.brands b WHERE b.letter = upper(x) AND b.is_active);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Not an active brand: %', v_bad; END IF;
  IF p_required AND coalesce(array_length(p_brands, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Pick at least one brand';
  END IF;

  PERFORM set_config('app.brand_sync', 'on', true);
  PERFORM set_config('app.approving', 'on', true);
  UPDATE public.parts SET branding_required = coalesce(p_required, false) WHERE id = p_part_id;
  DELETE FROM public.part_brands WHERE part_id = p_part_id
     AND (NOT coalesce(p_required, false) OR NOT (brand = ANY (SELECT upper(x) FROM unnest(p_brands) x)));
  IF p_required THEN
    INSERT INTO public.part_brands (part_id, brand)
    SELECT p_part_id, upper(x) FROM unnest(p_brands) x ON CONFLICT DO NOTHING;
  END IF;
  PERFORM set_config('app.approving', 'off', true);
  PERFORM set_config('app.brand_sync', 'off', true);

  v_result := public.sync_brand_variants();
  RETURN coalesce(v_result, '{}'::jsonb);
END $function$;

-- Bring the live data in line with the new rule.
SELECT public.sync_brand_variants();
