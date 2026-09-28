-- BOM saves could come out different from what was sent.
--
-- apply_bom staged the new lines in a temp table (_bom_next) and then ran
-- three statements: delete lines no longer wanted, update changed lines,
-- insert new ones. After the DELETE statement, the brand-sync statement
-- trigger fired, and the sync rebuilt brand-version BOMs by calling apply_bom
-- itself - which cleared and refilled the same _bom_next with the brand
-- version's lines (e.g. P-429-CR = [P-429 x 1]). The outer save then carried
-- on with those lines: the changes and additions that were sent were lost and
-- the brand version's lines were written instead. Removing P-429 from SA-001
-- therefore "saved - 1 added, 1 removed" and P-429 was back.
--
-- Now:
--   * No shared state: every statement reads the lines straight from p_lines.
--   * The brand sync does not run half-way through a save; it runs once, after
--     all three statements, when the BOM is complete.
--   * The save checks its own result: if the BOM in the table is not exactly
--     the BOM that was sent, it raises and nothing is changed.

CREATE OR REPLACE FUNCTION public.trg_brand_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- A multi-statement BOM save runs the sync itself once it is complete.
  IF coalesce(current_setting('app.bom_batch', true), '') = 'on' THEN RETURN NULL; END IF;
  PERFORM public.sync_brand_variants();
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_bom(p_parent uuid, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_added int; v_changed int; v_removed int; v_diff text; v_code text;
  v_lines jsonb := coalesce(p_lines, '[]'::jsonb);
  -- Outermost save: not inside another save, not inside the brand sync.
  v_outer boolean := coalesce(current_setting('app.bom_batch', true), '') <> 'on'
                 AND coalesce(current_setting('app.brand_sync', true), '') <> 'on';
BEGIN
  IF jsonb_typeof(v_lines) <> 'array' THEN RAISE EXCEPTION 'BOM lines must be a list'; END IF;
  SELECT string_agg(p.part_code, ', ') INTO v_code
    FROM (SELECT (l->>'child_part_id')::uuid AS cid FROM jsonb_array_elements(v_lines) l
           GROUP BY 1 HAVING count(*) > 1) d JOIN public.parts p ON p.id = d.cid;
  IF v_code IS NOT NULL THEN RAISE EXCEPTION 'Listed twice in this BOM: %', v_code; END IF;

  IF v_outer THEN PERFORM set_config('app.bom_batch', 'on', true); END IF;

  -- 1. Lines no longer wanted.
  WITH n AS (SELECT (l->>'child_part_id')::uuid AS child_part_id FROM jsonb_array_elements(v_lines) l)
  DELETE FROM public.bom b WHERE b.parent_part_id = p_parent AND b.is_active
     AND NOT EXISTS (SELECT 1 FROM n WHERE n.child_part_id = b.child_part_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- 2. Lines that changed.
  WITH n AS (
    SELECT (l->>'child_part_id')::uuid AS child_part_id,
           CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN NULL ELSE (l->>'quantity')::numeric END AS quantity,
           coalesce(nullif(l->>'uom', ''), 'PCS') AS uom,
           coalesce((l->>'is_critical')::boolean, false) AS is_critical,
           CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN 'BULK' ELSE 'PER_SET' END AS issue_mode
      FROM jsonb_array_elements(v_lines) l)
  UPDATE public.bom b SET quantity = n.quantity, uom = n.uom, is_critical = n.is_critical, issue_mode = n.issue_mode
    FROM n
   WHERE b.parent_part_id = p_parent AND b.is_active AND b.child_part_id = n.child_part_id
     AND (b.quantity IS DISTINCT FROM n.quantity OR b.is_critical IS DISTINCT FROM n.is_critical
          OR b.uom IS DISTINCT FROM n.uom OR b.issue_mode IS DISTINCT FROM n.issue_mode);
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  -- 3. New lines.
  WITH n AS (
    SELECT (l->>'child_part_id')::uuid AS child_part_id,
           CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN NULL ELSE (l->>'quantity')::numeric END AS quantity,
           coalesce(nullif(l->>'uom', ''), 'PCS') AS uom,
           coalesce((l->>'is_critical')::boolean, false) AS is_critical,
           CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN 'BULK' ELSE 'PER_SET' END AS issue_mode
      FROM jsonb_array_elements(v_lines) l)
  INSERT INTO public.bom (parent_part_id, child_part_id, quantity, uom, is_critical, issue_mode, created_by)
  SELECT p_parent, n.child_part_id, n.quantity, n.uom, n.is_critical, n.issue_mode, auth.uid()
    FROM n
   WHERE NOT EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = p_parent AND b.is_active
                                                  AND b.child_part_id = n.child_part_id);
  GET DIAGNOSTICS v_added = ROW_COUNT;

  -- 4. The BOM must now be exactly what was sent.
  WITH want AS (
    SELECT (l->>'child_part_id')::uuid AS child_part_id,
           CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN NULL ELSE (l->>'quantity')::numeric END AS quantity,
           CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN 'BULK' ELSE 'PER_SET' END AS issue_mode
      FROM jsonb_array_elements(v_lines) l
  ), have AS (
    SELECT child_part_id, quantity, issue_mode FROM public.bom WHERE parent_part_id = p_parent AND is_active
  ), diff AS (
    (SELECT child_part_id, 'missing' AS what FROM (SELECT * FROM want EXCEPT SELECT * FROM have) x)
    UNION ALL
    (SELECT child_part_id, 'extra' FROM (SELECT * FROM have EXCEPT SELECT * FROM want) y)
  )
  SELECT string_agg(p.part_code || ' ' || d.what, ', ') INTO v_diff FROM diff d JOIN public.parts p ON p.id = d.child_part_id;
  IF v_diff IS NOT NULL THEN
    SELECT part_code INTO v_code FROM public.parts WHERE id = p_parent;
    RAISE EXCEPTION 'The bill of materials of % did not save as sent (%). Nothing was changed - please try again.', v_code, v_diff;
  END IF;

  -- 5. Only now, with the BOM complete, bring brand versions in line.
  IF v_outer THEN
    PERFORM set_config('app.bom_batch', 'off', true);
    PERFORM public.sync_brand_variants();
  END IF;

  RETURN jsonb_build_object('added', v_added, 'changed', v_changed, 'removed', v_removed);
END $function$;
