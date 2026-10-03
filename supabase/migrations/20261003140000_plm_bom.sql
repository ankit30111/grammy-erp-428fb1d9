-- R&D BOM: the product's development BOM, each part moving through
-- Design -> Sample -> Approval -> Release (25% each). Product BOM progress is the
-- average of its lines; gates 2 (>70%), 4 (>95%) and 5 (100% and published)
-- are measured on it. Only R&D (and Management) changes it.
--
-- The production BOM (bom) is written from it by plm_publish_bom: automatically
-- when gate 4 passes, and again with Publish whenever R&D changes it after.
-- A variation starts from its base product's BOM, line by line Keep / Change /
-- Remove. Products that already had a finished good start with its production
-- BOM, every line released (carry-over).

CREATE TABLE public.plm_bom_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.plm_products(id) ON DELETE CASCADE,
  part_id uuid REFERENCES public.parts(id),
  description text,
  quantity numeric CHECK (quantity IS NULL OR quantity >= 0),
  bulk boolean NOT NULL DEFAULT false,
  is_critical boolean NOT NULL DEFAULT false,
  change_type text NOT NULL DEFAULT 'NEW' CHECK (change_type IN ('NEW', 'CARRY_OVER', 'CHANGED')),
  replaces_part_id uuid REFERENCES public.parts(id),
  design_done boolean NOT NULL DEFAULT false,
  sample_done boolean NOT NULL DEFAULT false,
  approval_done boolean NOT NULL DEFAULT false,
  release_done boolean NOT NULL DEFAULT false,
  design_at timestamptz, sample_at timestamptz, approval_at timestamptz, release_at timestamptz,
  vendor_note text,
  quoted_price numeric CHECK (quoted_price IS NULL OR quoted_price >= 0),
  remarks text,
  sort integer NOT NULL DEFAULT 0,
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (part_id IS NOT NULL OR btrim(coalesce(description, '')) <> '')
);
CREATE UNIQUE INDEX plm_bom_lines_one_part ON public.plm_bom_lines (product_id, part_id) WHERE part_id IS NOT NULL;
COMMENT ON TABLE public.plm_bom_lines IS '[R&D] A line of a product''s development BOM: an existing part or a placeholder, and how far it is (Design/Sample/Approval/Release).';

ALTER TABLE public.plm_products
  ADD COLUMN IF NOT EXISTS bom_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bom_published_at timestamptz;

ALTER TABLE public.plm_tests ADD COLUMN IF NOT EXISTS bom_line_id uuid REFERENCES public.plm_bom_lines(id) ON DELETE CASCADE;
ALTER TABLE public.plm_tests DROP CONSTRAINT IF EXISTS plm_tests_phase_check;
ALTER TABLE public.plm_tests ADD CONSTRAINT plm_tests_phase_check CHECK (phase IN ('EVT', 'SVT', 'PART'));
ALTER TABLE public.plm_tests ADD CONSTRAINT plm_tests_part_line CHECK ((phase = 'PART') = (bom_line_id IS NOT NULL));
ALTER TABLE public.plm_issues ADD COLUMN IF NOT EXISTS bom_line_id uuid REFERENCES public.plm_bom_lines(id) ON DELETE SET NULL;

ALTER TABLE public.plm_bom_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY plm_bom_lines_read ON public.plm_bom_lines FOR SELECT TO authenticated USING (public.has_role());
CREATE POLICY plm_bom_lines_insert ON public.plm_bom_lines FOR INSERT TO authenticated WITH CHECK (public.can_edit_plm());
CREATE POLICY plm_bom_lines_update ON public.plm_bom_lines FOR UPDATE TO authenticated USING (public.can_edit_plm()) WITH CHECK (public.can_edit_plm());
CREATE POLICY plm_bom_lines_delete ON public.plm_bom_lines FOR DELETE TO authenticated USING (public.can_edit_plm());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_bom_lines TO authenticated;

-- Steps go in order; unticking one unticks the ones after. Release needs a
-- real part code; Approval needs every part test of the line passed.
CREATE OR REPLACE FUNCTION public.plm_bom_line_rules()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
DECLARE v_open int; v_code text;
BEGIN
  IF NEW.change_type = 'CARRY_OVER' AND TG_OP = 'INSERT' THEN
    NEW.design_done := true; NEW.sample_done := true; NEW.approval_done := true; NEW.release_done := true;
  END IF;
  IF NOT NEW.design_done THEN NEW.sample_done := false; END IF;
  IF NOT NEW.sample_done THEN NEW.approval_done := false; END IF;
  IF NOT NEW.approval_done THEN NEW.release_done := false; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.sample_done AND NOT OLD.sample_done AND NOT NEW.design_done THEN RAISE EXCEPTION 'Design comes before Sample'; END IF;
  END IF;
  IF NEW.release_done AND NEW.part_id IS NULL THEN
    RAISE EXCEPTION 'Give "%" its part code before releasing it', NEW.description;
  END IF;
  IF NEW.approval_done AND (TG_OP = 'INSERT' OR NOT OLD.approval_done) THEN
    SELECT count(*) INTO v_open FROM public.plm_tests WHERE bom_line_id = NEW.id AND result <> 'PASS';
    IF v_open > 0 THEN
      SELECT coalesce(part_code, NEW.description) INTO v_code FROM public.parts WHERE id = NEW.part_id;
      RAISE EXCEPTION '% has % part test(s) not passed: it cannot be approved yet', coalesce(v_code, NEW.description), v_open;
    END IF;
  END IF;
  NEW.design_at := CASE WHEN NEW.design_done THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.design_at END, now()) END;
  NEW.sample_at := CASE WHEN NEW.sample_done THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.sample_at END, now()) END;
  NEW.approval_at := CASE WHEN NEW.approval_done THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.approval_at END, now()) END;
  NEW.release_at := CASE WHEN NEW.release_done THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.release_at END, now()) END;
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_plm_bom_line_rules BEFORE INSERT OR UPDATE ON public.plm_bom_lines
  FOR EACH ROW EXECUTE FUNCTION public.plm_bom_line_rules();

-- Any change to what the BOM contains marks it as changed since publishing.
CREATE OR REPLACE FUNCTION public.plm_bom_changed()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.part_id IS NOT DISTINCT FROM OLD.part_id AND NEW.quantity IS NOT DISTINCT FROM OLD.quantity
     AND NEW.bulk = OLD.bulk AND NEW.is_critical = OLD.is_critical THEN
    RETURN NULL;
  END IF;
  UPDATE public.plm_products SET bom_changed_at = now() WHERE id = coalesce(NEW.product_id, OLD.product_id);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_plm_bom_changed AFTER INSERT OR UPDATE OR DELETE ON public.plm_bom_lines
  FOR EACH ROW EXECUTE FUNCTION public.plm_bom_changed();

-- A failed part test opens an issue on the product, pointing at the line.
CREATE OR REPLACE FUNCTION public.plm_test_failed()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_what text;
BEGIN
  IF NEW.result = 'FAIL' AND (TG_OP = 'INSERT' OR OLD.result IS DISTINCT FROM 'FAIL')
     AND NOT EXISTS (SELECT 1 FROM public.plm_issues WHERE test_id = NEW.id AND status = 'OPEN') THEN
    IF NEW.phase = 'PART' THEN
      SELECT coalesce(p.part_code || ' ' || p.name, l.description) INTO v_what
        FROM public.plm_bom_lines l LEFT JOIN public.parts p ON p.id = l.part_id WHERE l.id = NEW.bom_line_id;
      -- A part that failed is not approved any more.
      UPDATE public.plm_bom_lines SET approval_done = false WHERE id = NEW.bom_line_id AND approval_done;
    END IF;
    INSERT INTO public.plm_issues (product_id, stage, description, severity, source, test_id, bom_line_id)
    VALUES (NEW.product_id,
            coalesce((SELECT stage FROM public.plm_products WHERE id = NEW.product_id), 1),
            CASE WHEN NEW.phase = 'PART' THEN 'Part test failed on ' || v_what || ': ' ELSE NEW.phase || ' test failed: ' END
              || NEW.name || coalesce(' - ' || nullif(btrim(NEW.note), ''), ''),
            'MEDIUM', 'TEST', NEW.id, NEW.bom_line_id);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.plm_metrics(p_product uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v jsonb; v_fgs uuid[]; v_dev jsonb;
  n_lines int; n_done int; n_purch int; n_spec int; n_foreign int;
  evt_t int; evt_p int; svt_t int; svt_p int; svt_open int; open_iss int; v_cost jsonb; v_del jsonb; v_pp jsonb;
BEGIN
  SELECT array_agg(id ORDER BY part_code) INTO v_fgs FROM public.parts WHERE plm_product_id = p_product AND is_active;

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
   WHERE o.is_pilot AND p.plm_product_id = p_product;

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
END $$;

CREATE OR REPLACE FUNCTION public.plm_gate_blockers(p_product uuid, p_gate smallint)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
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
    IF (m->>'fg_count')::int = 0 THEN out := out || 'Link the finished-good code(s) of this product'::text;
    ELSIF pr.bom_published_at IS NULL OR pr.bom_published_at < pr.bom_changed_at THEN
      out := out || 'Publish the BOM to production (it has changed since it was last published)'::text; END IF;
    IF pr.bis_status NOT IN ('LETTER_RECEIVED', 'NOT_REQUIRED') THEN out := out || 'BIS letter not received'::text; END IF;
    IF (d->>'done')::int < (d->>'total')::int THEN out := out || ('Still open: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(d->'open') x)); END IF;
    IF (m->>'open_issues')::int > 0 THEN out := out || ((m->>'open_issues') || ' open issue(s)'); END IF;
  END IF;
  RETURN out;
END $$;

-- Write the development BOM into the production BOM of every finished good of
-- the product. Every line needs a part code. A released product's BOM goes as
-- a change request (save_bom decides).
CREATE OR REPLACE FUNCTION public.plm_publish_bom(p_product uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_lines jsonb; v_fg record; v_out jsonb := '[]'::jsonb; v_missing text;
BEGIN
  IF NOT public.can_edit_plm() AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Only R&D can publish the BOM' USING ERRCODE = '42501';
  END IF;
  SELECT string_agg(description, ', ') INTO v_missing FROM public.plm_bom_lines WHERE product_id = p_product AND part_id IS NULL;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'These lines have no part code yet: %', v_missing; END IF;
  SELECT jsonb_agg(jsonb_build_object('child_part_id', part_id, 'quantity', quantity, 'bulk', bulk, 'is_critical', is_critical))
    INTO v_lines FROM public.plm_bom_lines WHERE product_id = p_product;
  IF v_lines IS NULL THEN RAISE EXCEPTION 'The BOM is empty'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parts WHERE plm_product_id = p_product AND is_active) THEN
    RAISE EXCEPTION 'Create or link the finished-good code first';
  END IF;
  FOR v_fg IN SELECT id, part_code FROM public.parts WHERE plm_product_id = p_product AND is_active LOOP
    v_out := v_out || jsonb_build_object('part_code', v_fg.part_code, 'result', public.save_bom(v_fg.id, v_lines));
  END LOOP;
  UPDATE public.plm_products SET bom_published_at = now() WHERE id = p_product;
  RETURN v_out;
END $$;
GRANT EXECUTE ON FUNCTION public.plm_publish_bom(uuid) TO authenticated;

-- Start a product's BOM from its finished good's production BOM (carry-over).
CREATE OR REPLACE FUNCTION public.plm_bom_from_production(p_product uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
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
   WHERE fg.plm_product_id = p_product
   GROUP BY coalesce(c.branded_from, c.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.plm_products SET bom_published_at = now() WHERE id = p_product;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.plm_bom_from_production(uuid) TO authenticated;

-- A variation: copy the base product's BOM, with each line kept, changed or
-- removed. p_actions = [{"line_id": ..., "action": "KEEP"|"CHANGE"|"REMOVE",
-- "part_id": replacement or null, "description": for a new part}]
CREATE OR REPLACE FUNCTION public.plm_bom_from_base(p_product uuid, p_actions jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE a jsonb; l public.plm_bom_lines; n int := 0; v_desc text;
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D can change the BOM' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.plm_bom_lines WHERE product_id = p_product) THEN
    RAISE EXCEPTION 'This product already has a BOM';
  END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(p_actions) LOOP
    SELECT * INTO l FROM public.plm_bom_lines WHERE id = (a->>'line_id')::uuid;
    CONTINUE WHEN l.id IS NULL OR a->>'action' = 'REMOVE';
    n := n + 1;
    IF a->>'action' = 'KEEP' THEN
      INSERT INTO public.plm_bom_lines (product_id, part_id, description, quantity, bulk, is_critical, change_type, sort,
                                        vendor_note, quoted_price)
      VALUES (p_product, l.part_id, l.description, l.quantity, l.bulk, l.is_critical, 'CARRY_OVER', n, l.vendor_note, l.quoted_price);
    ELSE
      SELECT 'New ' || coalesce(p.name, l.description) INTO v_desc FROM public.parts p WHERE p.id = l.part_id;
      INSERT INTO public.plm_bom_lines (product_id, part_id, description, quantity, bulk, is_critical, change_type,
                                        replaces_part_id, sort)
      VALUES (p_product, nullif(a->>'part_id', '')::uuid,
              coalesce(nullif(btrim(a->>'description'), ''), v_desc, 'Replacement for ' || coalesce(l.description, 'a part')),
              l.quantity, l.bulk, l.is_critical, 'CHANGED', l.part_id, n);
    END IF;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.plm_bom_from_base(uuid, jsonb) TO authenticated;

-- Gate 4 passing publishes the BOM to production.
CREATE OR REPLACE FUNCTION public.plm_gate4_publish()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NEW.gate = 4 AND NEW.how IN ('AUTO', 'RECORDED', 'MANAGEMENT')
     AND EXISTS (SELECT 1 FROM public.parts WHERE plm_product_id = NEW.product_id AND is_active)
     AND NOT EXISTS (SELECT 1 FROM public.plm_bom_lines WHERE product_id = NEW.product_id AND part_id IS NULL)
     AND EXISTS (SELECT 1 FROM public.plm_bom_lines WHERE product_id = NEW.product_id) THEN
    PERFORM public.plm_publish_bom(NEW.product_id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_plm_gate4_publish AFTER INSERT ON public.plm_gates
  FOR EACH ROW EXECUTE FUNCTION public.plm_gate4_publish();

-- Existing products with a finished good start from its production BOM.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT plm_product_id AS id FROM public.parts WHERE plm_product_id IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.plm_bom_lines WHERE product_id = r.id) THEN
      PERFORM public.plm_bom_from_production(r.id);
    END IF;
  END LOOP;
END $$;
SELECT public.plm_refresh_all();
