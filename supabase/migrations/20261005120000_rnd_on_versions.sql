-- R&D works on the model's versions directly: its BOM tab is the model's
-- working version (the open draft, else the released one) as a tree.

-- The version R&D is working on, and every line it is developing (the draft and
-- the drafts of sub-assemblies inside it).
CREATE OR REPLACE FUNCTION public.plm_working_version(p_product uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT iv.id FROM public.parts m JOIN public.item_versions iv ON iv.item_id = m.id
   WHERE m.plm_product_id = p_product AND m.source_type = 'MODEL'
   ORDER BY (iv.status = 'DRAFT') DESC, (iv.status = 'RELEASED') DESC, iv.major DESC, iv.minor DESC
   LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.plm_working_lines(p_product uuid)
RETURNS SETOF public.version_lines LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH RECURSIVE t(id) AS (
    SELECT public.plm_working_version(p_product)
    UNION
    SELECT l.child_version_id FROM t JOIN public.version_lines l ON l.version_id = t.id
      JOIN public.item_versions cv ON cv.id = l.child_version_id
     WHERE cv.status = 'DRAFT'
  )
  SELECT l.* FROM public.version_lines l WHERE l.version_id IN (SELECT id FROM t WHERE id IS NOT NULL)
$function$;
GRANT EXECUTE ON FUNCTION public.plm_working_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plm_working_lines(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.plm_bom_progress WITH (security_invoker = true) AS
SELECT pr.id AS product_id, count(l.id) AS lines,
       coalesce(round(avg((l.design_done::int + l.sample_done::int + l.approval_done::int + l.release_done::int) * 25.0), 1), 0) AS pct
  FROM public.plm_products pr LEFT JOIN LATERAL public.plm_working_lines(pr.id) l ON true
 GROUP BY pr.id;
GRANT SELECT ON public.plm_bom_progress TO authenticated;

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
    FROM public.plm_working_lines(p_product) l
    LEFT JOIN public.parts p ON p.id = l.part_id
    LEFT JOIN public.parts h ON h.id = coalesce(p.branded_from, p.id);

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

CREATE OR REPLACE FUNCTION public.plm_gate_blockers(p_product uuid, p_gate smallint)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m jsonb := public.plm_metrics(p_product); pr public.plm_products; out text[] := '{}'; d jsonb;
BEGIN
  SELECT * INTO pr FROM public.plm_products WHERE id = p_product;
  d := m->'deliverables'->(p_gate::text);
  IF p_gate = 1 THEN
    IF (m->'dev_bom'->>'lines')::int = 0 THEN out := out || 'Make BOM v1 (the BOM tab)'::text;
    ELSIF (m->'dev_bom'->>'no_qty')::int > 0 THEN out := out || ((m->'dev_bom'->>'no_qty') || ' BOM line(s) without a quantity'); END IF;
    IF (d->>'done')::int < (d->>'total')::int THEN out := out || ('Still open: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(d->'open') x)); END IF;
  ELSIF p_gate = 2 THEN
    IF (m->>'bom_pct')::numeric <= 70 THEN out := out || ('BOM progress ' || (m->>'bom_pct') || '% - needs more than 70%'); END IF;
  ELSIF p_gate = 3 THEN
    IF (m->>'evt_total')::int = 0 THEN out := out || 'Add the EVT tests'::text;
    ELSIF (m->>'evt_pass')::int < (m->>'evt_total')::int THEN
      out := out || (((m->>'evt_total')::int - (m->>'evt_pass')::int) || ' EVT test(s) not passed yet'); END IF;
    IF (d->>'done')::int < (d->>'total')::int THEN out := out || ('Still open: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(d->'open') x)); END IF;
  ELSIF p_gate = 4 THEN
    IF (m->>'bom_pct')::numeric <= 95 THEN out := out || ('BOM progress ' || (m->>'bom_pct') || '% - needs more than 95%'); END IF;
    IF (d->>'done')::int < (d->>'total')::int THEN out := out || ('Still open: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(d->'open') x)); END IF;
    IF (m->>'svt_total')::int = 0 THEN out := out || 'Add the SVT tests'::text;
    ELSIF (m->>'svt_not_passed')::int > 0 THEN out := out || ((m->>'svt_not_passed') || ' SVT test(s) not passed yet'); END IF;
    IF (m->>'open_issues')::int > 0 THEN out := out || ((m->>'open_issues') || ' open issue(s)'); END IF;
  ELSIF p_gate = 5 THEN
    IF (m->>'bom_pct')::numeric < 100 THEN out := out || ('BOM progress ' || (m->>'bom_pct') || '% - every part must be released'); END IF;
    IF (m->'dev_bom'->>'no_code')::int > 0 THEN out := out || ((m->'dev_bom'->>'no_code') || ' BOM line(s) without a part code'); END IF;
    IF (m->>'fg_count')::int = 0 THEN out := out || 'Add a brand code (Versions & brands)'::text; END IF;
    IF pr.bis_status NOT IN ('LETTER_RECEIVED', 'NOT_REQUIRED') THEN out := out || 'BIS letter not received'::text; END IF;
    IF (d->>'done')::int < (d->>'total')::int THEN out := out || ('Still open: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(d->'open') x)); END IF;
    IF (m->>'open_issues')::int > 0 THEN out := out || ((m->>'open_issues') || ' open issue(s)'); END IF;
  END IF;
  RETURN out;
END $function$;

-- Gate 5 is the release to mass production: v1.0 is released with it and every
-- brand code of the model is built on it.
CREATE OR REPLACE FUNCTION public.plm_release_first_version(p_product uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v record;
BEGIN
  SELECT iv.id, iv.item_id INTO v FROM public.item_versions iv JOIN public.parts m ON m.id = iv.item_id
   WHERE m.plm_product_id = p_product AND m.source_type = 'MODEL' AND iv.status = 'DRAFT' AND iv.ecn_id IS NULL AND iv.kind = 'INITIAL';
  IF v.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.version_lines WHERE version_id = v.id) THEN RETURN; END IF;
  PERFORM public.version_release(v.id, (SELECT coalesce(array_agg(id), '{}') FROM public.parts WHERE model_id = v.item_id AND is_active));
END $function$;
REVOKE ALL ON FUNCTION public.plm_release_first_version(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.plm_pass_gate(p_product uuid, p_gate smallint, p_approved_by text DEFAULT NULL::text, p_file_url text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS smallint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE pr public.plm_products; b text[];
BEGIN
  SELECT * INTO pr FROM public.plm_products WHERE id = p_product FOR UPDATE;
  IF pr.id IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF pr.status <> 'ACTIVE' THEN RAISE EXCEPTION '% is %, not active', pr.product_code, lower(pr.status); END IF;
  IF pr.stage <> p_gate THEN RAISE EXCEPTION '% is at stage %, so gate % is not the next one', pr.product_code, pr.stage, p_gate; END IF;
  IF p_gate NOT IN (1, 3, 5) THEN RAISE EXCEPTION 'Gate % passes by itself when its numbers are met', p_gate; END IF;
  IF p_gate = 5 AND NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management releases a product to mass production' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can pass a gate' USING ERRCODE = '42501'; END IF;
  IF p_gate = 1 AND nullif(btrim(coalesce(p_approved_by, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say who approved the sample and cost (the customer, or Harish for a Grammy product)';
  END IF;
  b := public.plm_gate_blockers(p_product, p_gate);
  IF cardinality(b) > 0 THEN RAISE EXCEPTION 'Gate % cannot pass yet: %', p_gate, array_to_string(b, '; '); END IF;

  INSERT INTO public.plm_gates (product_id, gate, how, approved_by_name, file_url, note)
  VALUES (p_product, p_gate, CASE WHEN p_gate = 5 THEN 'MANAGEMENT' ELSE 'RECORDED' END,
          nullif(btrim(coalesce(p_approved_by, '')), ''), p_file_url, nullif(btrim(coalesce(p_note, '')), ''));
  IF p_gate = 5 THEN PERFORM public.plm_release_first_version(p_product); END IF;
  RETURN public.plm_refresh(p_product);
END $function$;

CREATE OR REPLACE FUNCTION public.plm_release_override(p_product uuid, p_reason text)
 RETURNS smallint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management can release a product without its gates' USING ERRCODE = '42501'; END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'Give the reason for releasing it without its gates'; END IF;
  INSERT INTO public.plm_gates (product_id, gate, how, note)
  SELECT p_product, g, 'OVERRIDE', btrim(p_reason) FROM generate_series(1, 5) g
  ON CONFLICT (product_id, gate) DO NOTHING;
  PERFORM public.plm_release_first_version(p_product);
  RETURN public.plm_refresh(p_product);
END $function$;

CREATE OR REPLACE FUNCTION public.plm_test_failed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_what text;
BEGIN
  IF NEW.result = 'FAIL' AND (TG_OP = 'INSERT' OR OLD.result IS DISTINCT FROM 'FAIL')
     AND NOT EXISTS (SELECT 1 FROM public.plm_issues WHERE test_id = NEW.id AND status = 'OPEN') THEN
    IF NEW.phase = 'PART' THEN
      SELECT coalesce(p.part_code || ' ' || p.name, l.description) INTO v_what
        FROM public.version_lines l LEFT JOIN public.parts p ON p.id = l.part_id WHERE l.id = NEW.bom_line_id;
      UPDATE public.version_lines l SET approval_status = 'WIP' WHERE l.id = NEW.bom_line_id AND l.approval_status = 'CLOSED'
         AND (SELECT status FROM public.item_versions WHERE id = l.version_id) = 'DRAFT';
    END IF;
    INSERT INTO public.plm_issues (product_id, stage, description, severity, source, test_id, bom_line_id)
    VALUES (NEW.product_id,
            coalesce((SELECT stage FROM public.plm_products WHERE id = NEW.product_id), 1),
            CASE WHEN NEW.phase = 'PART' THEN 'Part test failed on ' || v_what || ': ' ELSE NEW.phase || ' test failed: ' END
              || NEW.name || coalesce(' - ' || nullif(btrim(NEW.note), ''), ''),
            'MEDIUM', 'TEST', NEW.id, NEW.bom_line_id);
  END IF;
  RETURN NULL;
END $function$;

-- What a variation starts from: a model's working version, or a brand code's
-- production BOM (read only).
CREATE OR REPLACE FUNCTION public.plm_part_base_lines(p_part uuid)
RETURNS TABLE (part_id uuid, quantity numeric, bulk boolean, is_critical boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_type public.part_source_type; v_ver uuid;
BEGIN
  SELECT source_type INTO v_type FROM public.parts WHERE id = p_part;
  IF v_type = 'MODEL' THEN
    SELECT id INTO v_ver FROM public.item_versions WHERE item_id = p_part
     ORDER BY (status = 'RELEASED') DESC, major DESC, minor DESC LIMIT 1;
    RETURN QUERY SELECT l.part_id, max(l.quantity), bool_or(l.bulk), bool_or(l.is_critical)
                   FROM public.version_lines l WHERE l.version_id = v_ver AND l.part_id IS NOT NULL GROUP BY l.part_id;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT coalesce(c.branded_from, c.id), max(b.quantity), bool_or(b.issue_mode = 'BULK'), bool_or(b.is_critical)
    FROM public.bom b JOIN public.parts c ON c.id = b.child_part_id
   WHERE b.is_active AND b.parent_part_id = p_part
   GROUP BY 1;
END $function$;

-- Keep / Change / Remove into the product's v1.0 draft.
CREATE OR REPLACE FUNCTION public.plm_bom_from_base(p_product uuid, p_actions jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE a jsonb; n int := 0; v_desc text; v_part uuid; v_base uuid; v_ver uuid; l record;
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D can change the BOM' USING ERRCODE = '42501'; END IF;
  v_ver := public.plm_working_version(p_product);
  IF v_ver IS NULL OR (SELECT status FROM public.item_versions WHERE id = v_ver) <> 'DRAFT' THEN
    RAISE EXCEPTION 'This product has no open draft to fill';
  END IF;
  IF EXISTS (SELECT 1 FROM public.version_lines WHERE version_id = v_ver) THEN RAISE EXCEPTION 'This product already has a BOM'; END IF;
  SELECT based_on_part_id, based_on_id INTO v_part, v_base FROM public.plm_products WHERE id = p_product;
  FOR a IN SELECT * FROM jsonb_array_elements(p_actions) LOOP
    IF v_part IS NOT NULL THEN
      SELECT b.part_id, NULL::text AS description, b.quantity, b.bulk, b.is_critical, NULL::text[] AS brands,
             NULL::text AS vendor_note, NULL::numeric AS quoted_price
        INTO l FROM public.plm_part_base_lines(v_part) b WHERE b.part_id = (a->>'line_id')::uuid;
    ELSE
      SELECT x.part_id, x.description, x.quantity, x.bulk, x.is_critical, x.brands, x.vendor_note, x.quoted_price
        INTO l FROM public.version_lines x WHERE x.id = (a->>'line_id')::uuid
         AND x.version_id = public.plm_working_version(v_base);
    END IF;
    CONTINUE WHEN NOT FOUND OR a->>'action' = 'REMOVE';
    n := n + 1;
    IF a->>'action' = 'KEEP' THEN
      INSERT INTO public.version_lines (version_id, sort, part_id, description, quantity, bulk, is_critical, change_type, vendor_note, quoted_price)
      VALUES (v_ver, n, l.part_id, l.description, l.quantity, l.bulk, l.is_critical, 'CARRY_OVER', l.vendor_note, l.quoted_price);
    ELSE
      SELECT 'New ' || coalesce(p.name, l.description) INTO v_desc FROM public.parts p WHERE p.id = l.part_id;
      INSERT INTO public.version_lines (version_id, sort, part_id, description, quantity, bulk, is_critical, change_type, replaces_part_id)
      VALUES (v_ver, n, nullif(a->>'part_id', '')::uuid,
              coalesce(nullif(btrim(a->>'description'), ''), v_desc, 'Replacement for ' || coalesce(l.description, 'a part')),
              l.quantity, l.bulk, l.is_critical, 'CHANGED', l.part_id);
    END IF;
  END LOOP;
  RETURN n;
END $function$;
