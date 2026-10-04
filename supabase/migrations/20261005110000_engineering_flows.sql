-- How versions move: new product, ECN, changing a sub-assembly, release.
--
--   New product      model v1.0 draft (no ECN) -> R&D builds the tree -> released
--                    by Management (gate 5, or Release on the BOM tab).
--   ECN              raised on a released model: opens v1.1 (or 2.0) as a draft
--                    copy. R&D edits it.
--   Change inside a sub-assembly, from the ECN:
--     this product   the sub-assembly is copied to a new code (SA-016) whose
--                    v1.0 is edited in the same ECN; other products keep the old.
--     all products   the sub-assembly gets its next version in the same ECN, and
--                    every product using it gets a new version too, so each
--                    brand's records show the change.
--   Release          Management releases the ECN: every draft in it at once.
--                    Sub-assemblies' production BOMs follow; brand codes move to
--                    the new version when Management ticks them (a brand can stay
--                    on 1.0 while another takes 1.1).

-- Helpers -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.version_copy_lines(p_from uuid, p_to uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE n int;
BEGIN
  INSERT INTO public.version_lines (version_id, sort, part_id, description, quantity, bulk, is_critical, brands,
                                    child_version_id, change_type, vendor_note, quoted_price, remarks)
  SELECT p_to, sort, part_id, description, quantity, bulk, is_critical, brands, child_version_id,
         'CARRY_OVER', vendor_note, quoted_price, remarks
    FROM public.version_lines WHERE version_id = p_from ORDER BY sort;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;

CREATE OR REPLACE FUNCTION public.item_latest_released(p_item uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT id FROM public.item_versions WHERE item_id = p_item AND status = 'RELEASED' ORDER BY major DESC, minor DESC LIMIT 1
$function$;

-- The draft of an item inside an ECN, opened if needed (next minor version).
CREATE OR REPLACE FUNCTION public.ecn_item_draft(p_ecn uuid, p_item uuid, p_major boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE d record; r record; v_id uuid; v_code text;
BEGIN
  SELECT part_code INTO v_code FROM public.parts WHERE id = p_item;
  SELECT iv.id, iv.ecn_id, e.ecn_no INTO d FROM public.item_versions iv LEFT JOIN public.ecns e ON e.id = iv.ecn_id
   WHERE iv.item_id = p_item AND iv.status = 'DRAFT';
  IF d.id IS NOT NULL THEN
    IF d.ecn_id IS DISTINCT FROM p_ecn THEN
      RAISE EXCEPTION '% is already being changed in %. Finish or cancel that first.', v_code, coalesce(d.ecn_no, 'its first-version draft');
    END IF;
    RETURN d.id;
  END IF;
  SELECT * INTO r FROM public.item_versions WHERE id = public.item_latest_released(p_item);
  IF r.id IS NULL THEN RAISE EXCEPTION '% has no released version to change', v_code; END IF;
  INSERT INTO public.item_versions (item_id, major, minor, kind, ecn_id, based_on, note)
  VALUES (p_item,
          CASE WHEN p_major THEN (SELECT max(major) + 1 FROM public.item_versions WHERE item_id = p_item) ELSE r.major END,
          CASE WHEN p_major THEN 0 ELSE (SELECT max(minor) + 1 FROM public.item_versions WHERE item_id = p_item AND major = r.major) END,
          CASE WHEN p_major THEN 'MAJOR' ELSE 'ECN' END, p_ecn, r.id,
          (SELECT title FROM public.ecns WHERE id = p_ecn))
  RETURNING id INTO v_id;
  PERFORM public.version_copy_lines(r.id, v_id);
  RETURN v_id;
END $function$;

-- Raise an ECN on a released model ------------------------------------------------
CREATE OR REPLACE FUNCTION public.ecn_raise(p_item uuid, p_title text, p_reason text DEFAULT NULL, p_major boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_ecn uuid;
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can raise an ECN' USING ERRCODE = '42501'; END IF;
  IF coalesce(btrim(p_title), '') = '' THEN RAISE EXCEPTION 'Say what changes'; END IF;
  INSERT INTO public.ecns (title, reason) VALUES (btrim(p_title), nullif(btrim(coalesce(p_reason, '')), '')) RETURNING id INTO v_ecn;
  PERFORM public.ecn_item_draft(v_ecn, p_item, p_major);
  RETURN v_ecn;
END $function$;

CREATE OR REPLACE FUNCTION public.ecn_update(p_ecn uuid, p_title text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can change an ECN' USING ERRCODE = '42501'; END IF;
  UPDATE public.ecns SET title = coalesce(nullif(btrim(p_title), ''), title), reason = nullif(btrim(coalesce(p_reason, '')), '')
   WHERE id = p_ecn AND status = 'DRAFT';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only an open ECN can change'; END IF;
  UPDATE public.item_versions SET note = (SELECT title FROM public.ecns WHERE id = p_ecn) WHERE ecn_id = p_ecn AND status = 'DRAFT';
END $function$;

-- Where an item is used, up to the products, as released today.
CREATE OR REPLACE FUNCTION public.ecn_where_used(p_item uuid)
RETURNS TABLE (item_id uuid, part_code text, name text, source_type text, version text, depth int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH RECURSIVE latest AS (
    SELECT DISTINCT ON (iv.item_id) iv.id, iv.item_id, iv.version
      FROM public.item_versions iv WHERE iv.status = 'RELEASED' ORDER BY iv.item_id, iv.major DESC, iv.minor DESC
  ), up(item_id, depth) AS (
    SELECT lt.item_id, 1 FROM latest lt JOIN public.version_lines l ON l.version_id = lt.id WHERE l.part_id = p_item
    UNION
    SELECT lt.item_id, u.depth + 1 FROM up u JOIN public.version_lines l ON l.part_id = u.item_id
      JOIN latest lt ON lt.id = l.version_id WHERE u.depth < 8
  )
  SELECT DISTINCT ON (u.item_id) u.item_id, p.part_code, p.name, p.source_type::text, lt.version, u.depth
    FROM up u JOIN public.parts p ON p.id = u.item_id JOIN latest lt ON lt.item_id = u.item_id
   ORDER BY u.item_id, u.depth
$function$;

-- Everything that uses p_item gets a draft in the ECN pointing at its new version.
CREATE OR REPLACE FUNCTION public.ecn_bump_users(p_ecn uuid, p_item uuid, p_new_version uuid, p_depth int DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE u record; v_draft uuid;
BEGIN
  IF p_depth > 8 THEN RETURN; END IF;
  FOR u IN
    SELECT DISTINCT iv.item_id FROM public.item_versions iv JOIN public.version_lines l ON l.version_id = iv.id
     WHERE iv.id = public.item_latest_released(iv.item_id) AND l.part_id = p_item
  LOOP
    v_draft := public.ecn_item_draft(p_ecn, u.item_id);
    UPDATE public.version_lines SET child_version_id = p_new_version, change_type = 'CHANGED'
     WHERE version_id = v_draft AND part_id = p_item AND child_version_id IS DISTINCT FROM p_new_version;
    IF (SELECT source_type FROM public.parts WHERE id = u.item_id) <> 'MODEL' THEN
      PERFORM public.ecn_bump_users(p_ecn, u.item_id, v_draft, p_depth + 1);
    END IF;
  END LOOP;
END $function$;

-- Change what is inside a sub-assembly line of a draft.
CREATE OR REPLACE FUNCTION public.ecn_change_subassembly(p_line uuid, p_scope text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE l record; v record; sa record; v_src uuid; v_new uuid; v_code text; v_nv uuid; v_ecn_no text;
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can change a BOM' USING ERRCODE = '42501'; END IF;
  SELECT * INTO l FROM public.version_lines WHERE id = p_line;
  SELECT iv.*, p.part_code AS item_code INTO v FROM public.item_versions iv JOIN public.parts p ON p.id = iv.item_id WHERE iv.id = l.version_id;
  IF v.status <> 'DRAFT' THEN RAISE EXCEPTION 'Raise an ECN first: v% of % is released', v.version, v.item_code; END IF;
  SELECT * INTO sa FROM public.parts WHERE id = l.part_id;
  IF NOT EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = sa.id) THEN
    RAISE EXCEPTION '% has no BOM of its own to change', sa.part_code;
  END IF;
  SELECT ecn_no INTO v_ecn_no FROM public.ecns WHERE id = v.ecn_id;

  IF upper(p_scope) = 'THIS' THEN
    v_src := coalesce(l.child_version_id, public.item_latest_released(sa.id));
    v_code := public.next_part_code(sa.category);
    PERFORM set_config('app.brand_sync', 'on', true);   -- an engineering copy: approved with its release
    INSERT INTO public.parts (part_code, name, category, uom, made_in_house, approval_status, plant_id, created_by)
    VALUES (v_code, sa.name || ' (' || coalesce((SELECT part_code FROM public.parts WHERE id = v.item_id), '') || ')',
            sa.category, sa.uom, sa.made_in_house, 'APPROVED', sa.plant_id, auth.uid())
    RETURNING id INTO v_new;
    PERFORM set_config('app.brand_sync', 'off', true);
    INSERT INTO public.item_versions (item_id, major, minor, kind, ecn_id, based_on, note)
    VALUES (v_new, 1, 0, 'INITIAL', v.ecn_id, v_src,
            'Made from ' || sa.part_code || ' for ' || v.item_code || coalesce(' (' || v_ecn_no || ')', ''))
    RETURNING id INTO v_nv;
    PERFORM public.version_copy_lines(v_src, v_nv);
    UPDATE public.version_lines SET part_id = v_new, child_version_id = v_nv, change_type = 'CHANGED', replaces_part_id = sa.id
     WHERE id = p_line;
    RETURN jsonb_build_object('scope', 'THIS', 'part_code', v_code, 'version_id', v_nv);
  ELSIF upper(p_scope) = 'ALL' THEN
    IF v.ecn_id IS NULL THEN
      RAISE EXCEPTION '% is not released yet, so it cannot change % for other products. Choose "only this product", or raise an ECN on a product that uses %.',
        v.item_code, sa.part_code, sa.part_code;
    END IF;
    v_nv := public.ecn_item_draft(v.ecn_id, sa.id);
    UPDATE public.version_lines SET child_version_id = v_nv, change_type = 'CHANGED' WHERE id = p_line;
    PERFORM public.ecn_bump_users(v.ecn_id, sa.id, v_nv);
    RETURN jsonb_build_object('scope', 'ALL', 'version_id', v_nv,
      'affected', (SELECT jsonb_agg(p.part_code ORDER BY p.part_code) FROM public.item_versions iv JOIN public.parts p ON p.id = iv.item_id
                    WHERE iv.ecn_id = v.ecn_id AND iv.status = 'DRAFT'));
  END IF;
  RAISE EXCEPTION 'Scope is THIS or ALL';
END $function$;

-- Cancel an open ECN: its drafts go; sub-assembly codes it made and nothing uses go too.
CREATE OR REPLACE FUNCTION public.ecn_cancel(p_ecn uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_made uuid[];
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can cancel an ECN' USING ERRCODE = '42501'; END IF;
  IF (SELECT status FROM public.ecns WHERE id = p_ecn) <> 'DRAFT' THEN RAISE EXCEPTION 'Only an open ECN can be cancelled'; END IF;
  SELECT array_agg(iv.item_id) INTO v_made FROM public.item_versions iv
   WHERE iv.ecn_id = p_ecn AND iv.kind = 'INITIAL' AND NOT EXISTS (SELECT 1 FROM public.item_versions o WHERE o.item_id = iv.item_id AND o.id <> iv.id);
  UPDATE public.version_lines SET child_version_id = NULL
   WHERE child_version_id IN (SELECT id FROM public.item_versions WHERE ecn_id = p_ecn);
  DELETE FROM public.item_versions WHERE ecn_id = p_ecn AND status = 'DRAFT';
  IF v_made IS NOT NULL THEN
    DELETE FROM public.parts p WHERE p.id = ANY (v_made)
       AND NOT EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = p.id OR b.child_part_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM public.version_lines l WHERE l.part_id = p.id);
  END IF;
  UPDATE public.ecns SET status = 'CANCELLED' WHERE id = p_ecn;
END $function$;

-- Production from versions ------------------------------------------------------------
-- A sub-assembly: its every-brand lines into bom, its per-brand lines into bom_brand_lines.
CREATE OR REPLACE FUNCTION public.item_apply_production(p_item uuid, p_version uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_lines jsonb; v_dup text;
BEGIN
  SELECT string_agg(DISTINCT p.part_code, ', ') INTO v_dup
    FROM public.version_lines a JOIN public.version_lines b ON b.version_id = a.version_id AND b.part_id = a.part_id AND b.id <> a.id
    JOIN public.parts p ON p.id = a.part_id
   WHERE a.version_id = p_version
     AND (a.brands IS NULL OR b.brands IS NULL OR a.brands && b.brands);
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION '% of % is listed more than once for the same brand', v_dup, (SELECT part_code FROM public.parts WHERE id = p_item);
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('child_part_id', l.part_id, 'quantity', l.quantity, 'bulk', l.bulk,
                                               'is_critical', l.is_critical, 'uom', coalesce(p.uom, 'PCS'))), '[]'::jsonb)
    INTO v_lines FROM public.version_lines l JOIN public.parts p ON p.id = l.part_id
   WHERE l.version_id = p_version AND l.brands IS NULL;
  PERFORM public.apply_bom(p_item, v_lines);
  DELETE FROM public.bom_brand_lines WHERE parent_part_id = p_item;
  INSERT INTO public.bom_brand_lines (parent_part_id, child_part_id, brand, quantity, issue_mode, is_critical)
  SELECT p_item, l.part_id, b, l.quantity, CASE WHEN l.bulk THEN 'BULK' ELSE 'PER_SET' END, l.is_critical
    FROM public.version_lines l, unnest(l.brands) b
   WHERE l.version_id = p_version AND l.brands IS NOT NULL;
END $function$;

-- A brand code: its model version's lines for that brand.
DROP FUNCTION IF EXISTS public.brand_apply_version(uuid, uuid);
-- p_partial: a draft before release (catch-up) - lines still without a part code are left out.
CREATE OR REPLACE FUNCTION public.brand_apply_version(p_brand uuid, p_version uuid, p_partial boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE br record; v record; v_lines jsonb; v_dup text; v_missing text;
BEGIN
  SELECT * INTO br FROM public.parts WHERE id = p_brand AND source_type = 'FINISHED_GOOD';
  SELECT * INTO v FROM public.item_versions WHERE id = p_version;
  IF br.id IS NULL OR v.item_id IS DISTINCT FROM br.model_id THEN RAISE EXCEPTION 'That version is not of this brand code''s model'; END IF;
  SELECT string_agg(coalesce(description, '?'), ', ') INTO v_missing FROM public.version_lines
   WHERE version_id = p_version AND part_id IS NULL AND (brands IS NULL OR br.brand = ANY (brands));
  IF v_missing IS NOT NULL AND NOT p_partial THEN RAISE EXCEPTION 'These lines have no part code yet: %', v_missing; END IF;
  SELECT string_agg(p.part_code, ', ') INTO v_dup FROM (
    SELECT part_id FROM public.version_lines WHERE version_id = p_version AND (brands IS NULL OR br.brand = ANY (brands))
     GROUP BY 1 HAVING count(*) > 1) d JOIN public.parts p ON p.id = d.part_id;
  IF v_dup IS NOT NULL THEN RAISE EXCEPTION '% is listed twice for brand % in v%', v_dup, br.brand, v.version; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('child_part_id', l.part_id, 'quantity', l.quantity, 'bulk', l.bulk,
                                               'is_critical', l.is_critical, 'uom', coalesce(p.uom, 'PCS'))), '[]'::jsonb)
    INTO v_lines FROM public.version_lines l JOIN public.parts p ON p.id = l.part_id
   WHERE l.version_id = p_version AND (l.brands IS NULL OR br.brand = ANY (l.brands));
  PERFORM public.apply_bom(p_brand, v_lines);
  PERFORM set_config('app.approving', 'on', true);
  UPDATE public.parts SET model_version = v.version WHERE id = p_brand;
  PERFORM set_config('app.approving', 'off', true);
END $function$;

-- Release a set of drafts together.
CREATE OR REPLACE FUNCTION public.versions_release(p_set uuid[], p_brands uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_bad text; r record; v_moved int := 0;
BEGIN
  IF NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management or Admin release a version' USING ERRCODE = '42501'; END IF;
  IF cardinality(coalesce(p_set, '{}')) = 0 THEN RAISE EXCEPTION 'Nothing to release'; END IF;
  SELECT string_agg(p.part_code || ' v' || iv.version, ', ') INTO v_bad FROM public.item_versions iv JOIN public.parts p ON p.id = iv.item_id
   WHERE iv.id = ANY (p_set) AND (iv.status <> 'DRAFT' OR NOT EXISTS (SELECT 1 FROM public.version_lines l WHERE l.version_id = iv.id));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Not a draft with lines: %', v_bad; END IF;
  SELECT string_agg(DISTINCT p.part_code || ': ' || coalesce(l.description, '?'), '; ') INTO v_bad
    FROM public.version_lines l JOIN public.item_versions iv ON iv.id = l.version_id JOIN public.parts p ON p.id = iv.item_id
   WHERE l.version_id = ANY (p_set) AND l.part_id IS NULL;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Lines without a part code: %', v_bad; END IF;
  SELECT string_agg(DISTINCT pc.part_code, ', ') INTO v_bad
    FROM public.version_lines l JOIN public.parts pc ON pc.id = l.part_id
   WHERE l.version_id = ANY (p_set) AND NOT l.bulk AND coalesce(l.quantity, 0) <= 0;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Lines without a quantity: %', v_bad; END IF;
  SELECT string_agg(DISTINCT pc.part_code || ' v' || cv.version, ', ') INTO v_bad
    FROM public.version_lines l JOIN public.item_versions cv ON cv.id = l.child_version_id JOIN public.parts pc ON pc.id = cv.item_id
   WHERE l.version_id = ANY (p_set) AND cv.status <> 'RELEASED' AND NOT (cv.id = ANY (p_set));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Uses drafts that are not part of this release: %', v_bad; END IF;

  UPDATE public.item_versions SET status = 'RELEASED', released_by = auth.uid(), released_at = now() WHERE id = ANY (p_set);
  PERFORM set_config('app.approving', 'on', true);
  UPDATE public.parts p SET model_version = iv.version FROM public.item_versions iv WHERE iv.id = ANY (p_set) AND p.id = iv.item_id;

  -- Production: sub-assemblies follow at once, brand codes when ticked.
  PERFORM set_config('app.bom_batch', 'on', true);
  FOR r IN SELECT iv.id, iv.item_id FROM public.item_versions iv JOIN public.parts p ON p.id = iv.item_id
            WHERE iv.id = ANY (p_set) AND p.source_type <> 'MODEL' LOOP
    PERFORM public.item_apply_production(r.item_id, r.id);
  END LOOP;
  FOR r IN SELECT b.id AS brand_id,
                  coalesce((SELECT iv.id FROM public.item_versions iv WHERE iv.id = ANY (p_set) AND iv.item_id = b.model_id),
                           public.item_latest_released(b.model_id)) AS version_id
             FROM public.parts b WHERE b.id = ANY (coalesce(p_brands, '{}')) AND b.source_type = 'FINISHED_GOOD' LOOP
    PERFORM public.brand_apply_version(r.brand_id, r.version_id);
    v_moved := v_moved + 1;
  END LOOP;
  PERFORM set_config('app.bom_batch', 'off', true);
  PERFORM set_config('app.approving', 'off', true);
  PERFORM public.sync_brand_variants();
  RETURN jsonb_build_object('released', cardinality(p_set), 'brands_moved', v_moved);
END $function$;

CREATE OR REPLACE FUNCTION public.ecn_release(p_ecn uuid, p_brands uuid[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_set uuid[]; v_res jsonb;
BEGIN
  IF (SELECT status FROM public.ecns WHERE id = p_ecn) IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'Only an open ECN is released'; END IF;
  SELECT array_agg(id) INTO v_set FROM public.item_versions WHERE ecn_id = p_ecn AND status = 'DRAFT';
  v_res := public.versions_release(v_set, p_brands);
  UPDATE public.ecns SET status = 'RELEASED', released_by = auth.uid(), released_at = now() WHERE id = p_ecn;
  RETURN v_res;
END $function$;

-- A first version (no ECN): with the new sub-assemblies drafted inside it.
CREATE OR REPLACE FUNCTION public.version_release(p_version uuid, p_brands uuid[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_set uuid[]; v_other text;
BEGIN
  IF (SELECT ecn_id FROM public.item_versions WHERE id = p_version) IS NOT NULL THEN
    RAISE EXCEPTION 'This version belongs to an ECN: release the ECN';
  END IF;
  WITH RECURSIVE t(id) AS (
    SELECT p_version
    UNION
    SELECT l.child_version_id FROM t JOIN public.version_lines l ON l.version_id = t.id
      JOIN public.item_versions cv ON cv.id = l.child_version_id
     WHERE cv.status = 'DRAFT' AND cv.ecn_id IS NULL
  )
  SELECT array_agg(id) INTO v_set FROM t;
  SELECT string_agg(DISTINCT e.ecn_no, ', ') INTO v_other
    FROM public.version_lines l JOIN public.item_versions cv ON cv.id = l.child_version_id JOIN public.ecns e ON e.id = cv.ecn_id
   WHERE l.version_id = ANY (v_set) AND cv.status = 'DRAFT';
  IF v_other IS NOT NULL THEN RAISE EXCEPTION 'Release % first: this version uses drafts from it', v_other; END IF;
  RETURN public.versions_release(v_set, p_brands);
END $function$;

-- Brand codes ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.model_move_brand(p_brand uuid, p_version uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management or Admin move a brand to another version' USING ERRCODE = '42501'; END IF;
  IF (SELECT status FROM public.item_versions WHERE id = p_version) <> 'RELEASED' THEN
    RAISE EXCEPTION 'Release the version before moving brands onto it';
  END IF;
  PERFORM public.brand_apply_version(p_brand, p_version);
  RETURN jsonb_build_object('applied', true);
END $function$;

-- A new brand code on a model: its BOM is the model version's lines for that brand.
CREATE OR REPLACE FUNCTION public.model_add_brand(p_model uuid, p_brand text, p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE m record; v_id uuid; v_code text; v_ver uuid; v_res jsonb := '{}'::jsonb; v_lines jsonb; v_b text := upper(btrim(p_brand));
BEGIN
  IF NOT (public.can_edit_masters() OR public.can_edit_plm()) THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can add a brand' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO m FROM public.parts WHERE id = p_model AND source_type = 'MODEL';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not a model'; END IF;
  v_code := m.part_code || '-' || v_b;
  IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = v_code) THEN RAISE EXCEPTION '% already exists', v_code; END IF;
  INSERT INTO public.parts (part_code, name, category, uom)
  VALUES (v_code, coalesce(nullif(btrim(p_name), ''), m.name), m.category, 'PCS') RETURNING id INTO v_id;
  -- Built on the released version; before release (catch-up) on the draft.
  v_ver := coalesce(public.item_latest_released(p_model),
                    (SELECT id FROM public.item_versions WHERE item_id = p_model ORDER BY major DESC, minor DESC LIMIT 1));
  IF v_ver IS NOT NULL AND EXISTS (SELECT 1 FROM public.version_lines WHERE version_id = v_ver AND (brands IS NULL OR v_b = ANY (brands))) THEN
    IF public.can_approve() THEN
      PERFORM public.brand_apply_version(v_id, v_ver, true);
      v_res := jsonb_build_object('applied', true);
    ELSE
      SELECT jsonb_agg(jsonb_build_object('child_part_id', part_id, 'quantity', quantity, 'bulk', bulk, 'is_critical', is_critical))
        INTO v_lines FROM public.version_lines WHERE version_id = v_ver AND part_id IS NOT NULL AND (brands IS NULL OR v_b = ANY (brands));
      v_res := public.save_bom(v_id, v_lines);
    END IF;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'part_code', v_code, 'version', (SELECT version FROM public.item_versions WHERE id = v_ver), 'bom', v_res);
END $function$;

-- A brand code made on the Parts page: start its BOM from its model.
CREATE OR REPLACE FUNCTION public.model_fill_brand(p_brand uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE br record; v_ver uuid; v_lines jsonb;
BEGIN
  SELECT * INTO br FROM public.parts WHERE id = p_brand AND source_type = 'FINISHED_GOOD';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not a brand code'; END IF;
  IF EXISTS (SELECT 1 FROM public.bom WHERE parent_part_id = p_brand AND is_active) THEN RAISE EXCEPTION '% already has a BOM', br.part_code; END IF;
  v_ver := coalesce(public.item_latest_released(br.model_id),
                    (SELECT id FROM public.item_versions WHERE item_id = br.model_id ORDER BY major DESC, minor DESC LIMIT 1));
  IF v_ver IS NULL THEN RETURN jsonb_build_object('applied', false, 'empty', true); END IF;
  IF public.can_approve() THEN
    PERFORM public.brand_apply_version(p_brand, v_ver, true);
    RETURN jsonb_build_object('applied', true);
  END IF;
  SELECT jsonb_agg(jsonb_build_object('child_part_id', part_id, 'quantity', quantity, 'bulk', bulk, 'is_critical', is_critical))
    INTO v_lines FROM public.version_lines WHERE version_id = v_ver AND part_id IS NOT NULL AND (brands IS NULL OR br.brand = ANY (brands));
  IF v_lines IS NULL THEN RETURN jsonb_build_object('applied', false, 'empty', true); END IF;
  RETURN public.save_bom(p_brand, v_lines);
END $function$;

-- Models -----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.model_create(p_category text, p_code text, p_name text,
  p_plm_product uuid DEFAULT NULL, p_copy_from uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_id uuid; v_ver uuid; v_code text := upper(btrim(coalesce(p_code, ''))); v_cat text := upper(btrim(p_category));
BEGIN
  IF NOT (public.can_edit_masters() OR public.can_edit_plm()) THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can create a model' USING ERRCODE = '42501';
  END IF;
  IF v_code = '' THEN v_code := public.model_next_code(v_cat); END IF;
  IF v_code !~ ('^' || v_cat || '-[A-Z0-9]+$') THEN
    RAISE EXCEPTION 'A model code is category-number, e.g. %-016. "%" is not.', v_cat, v_code;
  END IF;
  IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = v_code OR part_code LIKE v_code || '-%') THEN
    RAISE EXCEPTION '% is already used', v_code;
  END IF;
  INSERT INTO public.parts (part_code, name, category, uom, plm_product_id)
  VALUES (v_code, coalesce(nullif(btrim(p_name), ''), v_code), v_cat, 'PCS', p_plm_product)
  RETURNING id INTO v_id;
  SELECT id INTO v_ver FROM public.item_versions WHERE item_id = v_id;
  IF v_ver IS NULL THEN
    INSERT INTO public.item_versions (item_id, major, minor, kind, note) VALUES (v_id, 1, 0, 'INITIAL', 'First version') RETURNING id INTO v_ver;
  END IF;
  IF p_copy_from IS NOT NULL THEN
    UPDATE public.item_versions SET based_on = p_copy_from WHERE id = v_ver;
    PERFORM public.version_copy_lines(p_copy_from, v_ver);
  END IF;
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.parts_link_model()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_code text; v_model uuid; v_num int; v_cat text;
BEGIN
  IF NEW.source_type = 'MODEL' THEN
    NEW.model_id := NULL;
    NEW.approval_status := 'APPROVED';
    v_num := (regexp_match(NEW.part_code, '^[A-Z]{2}-([0-9]+)$'))[1]::int;
    IF v_num IS NOT NULL THEN
      UPDATE public.part_categories SET next_sequence = v_num + 1, updated_at = now()
       WHERE prefix = NEW.category AND next_sequence <= v_num;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.source_type <> 'FINISHED_GOOD' OR NEW.branded_from IS NOT NULL THEN
    NEW.model_id := NULL;
    RETURN NEW;
  END IF;
  v_code := substring(NEW.part_code FROM '^(.*)-[A-Z]{2}$');
  SELECT id INTO v_model FROM public.parts WHERE part_code = v_code;
  IF v_model IS NULL THEN
    SELECT name INTO v_cat FROM public.part_categories WHERE prefix = NEW.category;
    INSERT INTO public.parts (part_code, name, category, uom, plm_product_id)
    VALUES (v_code, coalesce(v_cat, NEW.category) || ' ' || substring(v_code FROM '-(.*)$'), NEW.category, 'PCS', NEW.plm_product_id)
    RETURNING id INTO v_model;
    IF NOT EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = v_model) THEN
      INSERT INTO public.item_versions (item_id, major, minor, kind, note) VALUES (v_model, 1, 0, 'INITIAL', 'First version');
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.model_id IS DISTINCT FROM v_model THEN
    NEW.model_id := v_model;
    NEW.model_version := coalesce(
      (SELECT version FROM public.item_versions WHERE item_id = v_model AND status = 'RELEASED' ORDER BY major DESC, minor DESC LIMIT 1),
      (SELECT version FROM public.item_versions WHERE item_id = v_model ORDER BY major DESC, minor DESC LIMIT 1));
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.plm_product_model()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_cat text; v_model uuid; v_owner uuid;
BEGIN
  v_cat := substring(NEW.product_code FROM '^([A-Z]{2})-[A-Z0-9]+$');
  IF v_cat IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT id INTO v_model FROM public.parts WHERE plm_product_id = NEW.id AND source_type = 'MODEL' AND part_code = OLD.product_code;
    IF v_model IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = NEW.product_code) THEN RAISE EXCEPTION '% is already used', NEW.product_code; END IF;
      PERFORM set_config('app.approving', 'on', true);
      UPDATE public.parts SET part_code = NEW.product_code, category = v_cat WHERE id = v_model;
      PERFORM set_config('app.approving', 'off', true);
      RETURN NULL;
    END IF;
  END IF;
  SELECT id, plm_product_id INTO v_model, v_owner FROM public.parts WHERE part_code = NEW.product_code AND source_type = 'MODEL';
  IF v_model IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = NEW.product_code OR part_code LIKE NEW.product_code || '-%') THEN
      RAISE EXCEPTION '% is already used by a finished good', NEW.product_code;
    END IF;
    INSERT INTO public.parts (part_code, name, category, uom, plm_product_id)
    VALUES (NEW.product_code, NEW.name, v_cat, 'PCS', NEW.id) RETURNING id INTO v_model;
    IF NOT EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = v_model) THEN
      INSERT INTO public.item_versions (item_id, major, minor, kind, note) VALUES (v_model, 1, 0, 'INITIAL', 'First version');
    END IF;
  ELSIF v_owner IS NULL THEN
    PERFORM set_config('app.approving', 'on', true);
    UPDATE public.parts SET plm_product_id = NEW.id WHERE id = v_model;
    PERFORM set_config('app.approving', 'off', true);
  ELSIF v_owner <> NEW.id THEN
    RAISE EXCEPTION 'Model % belongs to another R&D product', NEW.product_code;
  END IF;
  RETURN NULL;
END $function$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['ecn_raise(uuid,text,text,boolean)', 'ecn_update(uuid,text,text)', 'ecn_where_used(uuid)',
    'ecn_change_subassembly(uuid,text)', 'ecn_cancel(uuid)', 'ecn_release(uuid,uuid[])', 'version_release(uuid,uuid[])',
    'model_move_brand(uuid,uuid)', 'model_add_brand(uuid,text,text)', 'model_fill_brand(uuid)',
    'model_create(text,text,text,uuid,uuid)', 'item_version_for(uuid,uuid)', 'item_latest_released(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['version_copy_lines(uuid,uuid)', 'ecn_item_draft(uuid,uuid,boolean)', 'ecn_bump_users(uuid,uuid,uuid,integer)',
    'item_apply_production(uuid,uuid)', 'brand_apply_version(uuid,uuid,boolean)', 'versions_release(uuid[],uuid[])'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;
