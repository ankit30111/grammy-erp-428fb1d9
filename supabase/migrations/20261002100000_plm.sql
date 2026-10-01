-- R&D / PLM: every new product from idea to mass production, in the ERP.
-- Design: claude/plm-design.md (from Anmol's GRAMMY_PLM_Tracker.xlsx).
--
--   plm_products      one row per product (Product ID J6C ...). New model, or a
--                     variation based on an earlier product (based_on_id).
--   parts.plm_product_id  the finished-good codes that belong to a product.
--   plm_deliverables  the stage checklists (Open / WIP / Closed / N/A + file).
--   plm_gates         a gate once passed, with how and by whom. Latched.
--   plm_tests         EVT / SVT tests. A FAIL opens an issue by itself.
--   plm_issues        Issues & Actions (ISS-001 ...). Also opened by customer
--                     complaints on the product's finished goods.
--   stage             worked out by plm_refresh() from the gates; never typed.
--
-- Rules enforced by the database:
--   * a finished good of a product below stage 6 gets no normal voucher;
--     at stage 5 it can get a pilot voucher (is_pilot) without a projection;
--   * from stage 6 its BOM changes only through an approved BOM change request.
-- Replaces the empty, unused npd_* tables.

DROP TABLE IF EXISTS public.npd_bom_materials, public.npd_benchmarks, public.npd_sample_tracking, public.npd_projects;

-- Products -----------------------------------------------------------------------
CREATE TABLE public.plm_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL UNIQUE CHECK (btrim(product_code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  category text,
  kind text NOT NULL DEFAULT 'NEW_MODEL' CHECK (kind IN ('NEW_MODEL', 'VARIATION')),
  based_on_id uuid REFERENCES public.plm_products(id) ON DELETE SET NULL,
  ownership text NOT NULL DEFAULT 'GRAMMY' CHECK (ownership IN ('GRAMMY', 'CLIENT')),
  client text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  business_model text CHECK (business_model IN ('ODM', 'OEM')),
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  start_date date,
  target_launch date,
  target_cost numeric CHECK (target_cost IS NULL OR target_cost >= 0),
  stage smallint NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 6),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ON_HOLD', 'DROPPED')),
  bis_status text NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (bis_status IN ('NOT_STARTED', 'APPLIED', 'SAMPLE_SENT', 'TESTING', 'LETTER_RECEIVED', 'NOT_REQUIRED')),
  bis_letter_url text,
  firmware_version text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (based_on_id IS NULL OR based_on_id <> id)
);
COMMENT ON TABLE public.plm_products IS '[R&D] A product in development, from idea to mass production. stage is worked out from plm_gates.';

ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS plm_product_id uuid REFERENCES public.plm_products(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.parts.plm_product_id IS 'Finished goods only: the R&D product this code belongs to.';

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS is_pilot boolean NOT NULL DEFAULT false;
ALTER TABLE public.production_schedules ADD COLUMN IF NOT EXISTS is_pilot boolean NOT NULL DEFAULT false;


-- Checklists ----------------------------------------------------------------------
CREATE TABLE public.plm_deliverable_template (
  key text PRIMARY KEY, stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 6), label text NOT NULL, sort smallint NOT NULL
);
COMMENT ON TABLE public.plm_deliverable_template IS '[R&D] The checklist every product gets, per stage.';
INSERT INTO public.plm_deliverable_template (key, stage, label, sort) VALUES
  ('crs_v1', 1, 'CRS v1', 1), ('did', 1, 'DID (PPT)', 2), ('bom_v1', 1, 'BOM v1', 3),
  ('proto1', 1, 'Prototype 1', 4), ('sound_test', 1, 'Sound Test', 5), ('cost_conf', 1, 'Cost Confirmation', 6),
  ('proto2', 2, 'Prototype 2', 1), ('bom_v2', 2, 'BOM v2', 2),
  ('eng_issues', 3, 'Engineering Issues', 1),
  ('bom_picture_book', 4, 'BOM Picture Book', 1), ('picture_book', 4, 'Picture Book', 2), ('wi_v1', 4, 'WI v1', 3),
  ('oqc_v1', 4, 'OQC Checklist v1', 4), ('pqc_v1', 4, 'PQC Checklist v1', 5), ('fw_freeze', 4, 'Firmware Freeze', 6),
  ('procurement', 5, 'Procurement Complete', 1), ('pp_build', 5, 'PP Build Qty & Date', 2),
  ('wi_validated', 5, 'WI Validated On Line', 3), ('qc_executed', 5, 'OQC/PQC Executed', 4),
  ('yield_ok', 5, 'Yield / Defect Rate OK', 5), ('golden_sample', 5, 'Golden Sample Signed', 6),
  ('packaging', 5, 'Packaging Verification', 7), ('bom_cost_freeze', 5, 'BOM & Cost Sign-off (freeze)', 8),
  ('jigs', 5, 'Jigs & Fixtures Qualified', 9), ('issue_list', 5, 'Issue List Verification', 10),
  ('ort_plan', 5, 'ORT Plan', 11), ('customer_pp_exit', 5, 'Customer PP Exit Confirmation', 12),
  ('pp_issue_closure', 6, 'PP Issue List Closure', 1), ('final_bom_cost', 6, 'Final BOM & Cost', 2), ('dispatch', 6, 'Dispatch', 3);

CREATE TABLE public.plm_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.plm_products(id) ON DELETE CASCADE,
  key text NOT NULL REFERENCES public.plm_deliverable_template(key),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'WIP', 'CLOSED', 'NA')),
  file_url text, owner text, due_date date, note text,
  updated_by uuid DEFAULT auth.uid(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, key)
);
COMMENT ON TABLE public.plm_deliverables IS '[R&D] One checklist item of a product: Open / WIP / Closed / N/A, with its file.';

CREATE TABLE public.plm_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.plm_products(id) ON DELETE CASCADE,
  gate smallint NOT NULL CHECK (gate BETWEEN 1 AND 5),
  how text NOT NULL CHECK (how IN ('AUTO', 'RECORDED', 'MANAGEMENT', 'OVERRIDE', 'IMPORTED')),
  approved_by_name text, file_url text, note text,
  passed_by uuid DEFAULT auth.uid(), passed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, gate)
);
COMMENT ON TABLE public.plm_gates IS '[R&D] A stage gate a product has passed (gate n moves it to stage n+1), how and by whom.';

CREATE TABLE public.plm_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.plm_products(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('EVT', 'SVT')),
  name text NOT NULL CHECK (btrim(name) <> ''),
  result text NOT NULL DEFAULT 'PENDING' CHECK (result IN ('PENDING', 'PASS', 'FAIL')),
  report_url text, note text, tested_by uuid, tested_at timestamptz,
  sort integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.plm_tests IS '[R&D] An EVT or SVT test of a product. A FAIL opens an issue.';

CREATE SEQUENCE IF NOT EXISTS public.seq_plm_issue;
CREATE TABLE public.plm_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_no text NOT NULL UNIQUE DEFAULT ('ISS-' || lpad(nextval('public.seq_plm_issue')::text, 3, '0')),
  product_id uuid NOT NULL REFERENCES public.plm_products(id) ON DELETE CASCADE,
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 6),
  raised_on date NOT NULL DEFAULT current_date,
  description text NOT NULL CHECK (btrim(description) <> ''),
  severity text NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
  owner text, action text, target_date date,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  closed_on date, remarks text,
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'TEST', 'COMPLAINT', 'IMPORTED')),
  test_id uuid REFERENCES public.plm_tests(id) ON DELETE SET NULL,
  complaint_id uuid REFERENCES public.customer_complaints(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.plm_issues IS '[R&D] Issues & Actions: failed tests, ECNs, risks and customer complaints, per product.';

-- Rights -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_edit_plm()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT public.has_role('rnd') OR public.can_approve() $$;
GRANT EXECUTE ON FUNCTION public.can_edit_plm() TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plm_products', 'plm_deliverables', 'plm_gates', 'plm_tests', 'plm_issues', 'plm_deliverable_template'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role())', t || '_read', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['plm_products', 'plm_deliverables', 'plm_tests', 'plm_issues'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_edit_plm())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_edit_plm()) WITH CHECK (public.can_edit_plm())', t || '_update', t);
  END LOOP;
  -- Deleting: Management only; tests and open issues can be removed by R&D.
  EXECUTE 'CREATE POLICY plm_products_delete ON public.plm_products FOR DELETE TO authenticated USING (public.can_approve())';
  EXECUTE 'CREATE POLICY plm_tests_delete ON public.plm_tests FOR DELETE TO authenticated USING (public.can_edit_plm())';
  EXECUTE 'CREATE POLICY plm_issues_delete ON public.plm_issues FOR DELETE TO authenticated USING (public.can_approve())';
  -- plm_gates are written only by the functions below.
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_products, public.plm_deliverables, public.plm_tests, public.plm_issues TO authenticated;
GRANT SELECT ON public.plm_gates, public.plm_deliverable_template TO authenticated;
GRANT USAGE ON SEQUENCE public.seq_plm_issue TO authenticated;

-- Housekeeping triggers --------------------------------------------------------
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON public.plm_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON public.plm_issues FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.plm_product_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage
     AND coalesce(current_setting('app.plm', true), '') <> 'on' THEN
    RAISE EXCEPTION 'The stage moves only when a gate is passed';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.stage <> 1 AND coalesce(current_setting('app.plm', true), '') <> 'on' THEN
    NEW.stage := 1;
  END IF;
  NEW.product_code := upper(btrim(NEW.product_code));
  IF NEW.kind = 'NEW_MODEL' THEN NEW.based_on_id := NULL; END IF;
  -- Client name follows the Customers master when the customer is chosen there.
  IF NEW.customer_id IS NOT NULL THEN
    SELECT name INTO NEW.client FROM public.customers WHERE id = NEW.customer_id;
  END IF;
  NEW.ownership := CASE WHEN nullif(btrim(coalesce(NEW.client, '')), '') IS NULL THEN 'GRAMMY' ELSE NEW.ownership END;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_plm_product_guard BEFORE INSERT OR UPDATE ON public.plm_products
  FOR EACH ROW EXECUTE FUNCTION public.plm_product_guard();

-- Every product gets the full checklist.
CREATE OR REPLACE FUNCTION public.plm_seed_deliverables()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.plm_deliverables (product_id, key)
  SELECT NEW.id, t.key FROM public.plm_deliverable_template t
  ON CONFLICT (product_id, key) DO NOTHING;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_plm_seed_deliverables AFTER INSERT ON public.plm_products
  FOR EACH ROW EXECUTE FUNCTION public.plm_seed_deliverables();

CREATE OR REPLACE FUNCTION public.plm_deliverable_touch()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$ BEGIN NEW.updated_at := now(); NEW.updated_by := auth.uid(); RETURN NEW; END $$;
CREATE TRIGGER trg_plm_deliverable_touch BEFORE UPDATE ON public.plm_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.plm_deliverable_touch();

-- A failed test opens an issue (one open issue per test).
CREATE OR REPLACE FUNCTION public.plm_test_result()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NEW.result IS DISTINCT FROM OLD.result OR TG_OP = 'INSERT' THEN
    NEW.tested_by := CASE WHEN NEW.result = 'PENDING' THEN NULL ELSE auth.uid() END;
    NEW.tested_at := CASE WHEN NEW.result = 'PENDING' THEN NULL ELSE now() END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_plm_test_result BEFORE INSERT OR UPDATE ON public.plm_tests
  FOR EACH ROW EXECUTE FUNCTION public.plm_test_result();

CREATE OR REPLACE FUNCTION public.plm_test_failed()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NEW.result = 'FAIL' AND (TG_OP = 'INSERT' OR OLD.result IS DISTINCT FROM 'FAIL')
     AND NOT EXISTS (SELECT 1 FROM public.plm_issues WHERE test_id = NEW.id AND status = 'OPEN') THEN
    INSERT INTO public.plm_issues (product_id, stage, description, severity, source, test_id, owner)
    VALUES (NEW.product_id, CASE NEW.phase WHEN 'EVT' THEN 3 ELSE 4 END,
            NEW.phase || ' test failed: ' || NEW.name || coalesce(' - ' || nullif(btrim(NEW.note), ''), ''),
            'MEDIUM', 'TEST', NEW.id, NULL);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_plm_test_failed AFTER INSERT OR UPDATE OF result ON public.plm_tests
  FOR EACH ROW EXECUTE FUNCTION public.plm_test_failed();

CREATE OR REPLACE FUNCTION public.plm_issue_touch()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
  NEW.closed_on := CASE WHEN NEW.status = 'CLOSED' THEN coalesce(NEW.closed_on, current_date) ELSE NULL END;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_plm_issue_touch BEFORE INSERT OR UPDATE ON public.plm_issues
  FOR EACH ROW EXECUTE FUNCTION public.plm_issue_touch();

-- A customer complaint on a product's finished good is an issue on the product.
CREATE OR REPLACE FUNCTION public.plm_complaint_to_issue()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_prod uuid; v_code text;
BEGIN
  SELECT plm_product_id, part_code INTO v_prod, v_code FROM public.parts WHERE id = NEW.part_id;
  IF v_prod IS NOT NULL THEN
    INSERT INTO public.plm_issues (product_id, stage, description, severity, source, complaint_id, raised_on)
    VALUES (v_prod, 6, 'Customer complaint ' || coalesce(NEW.complaint_number, '') || ' on ' || v_code || ': ' || coalesce(NEW.complaint_details, ''),
            'HIGH', 'COMPLAINT', NEW.id, coalesce(NEW.received_date, current_date));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_plm_complaint_to_issue AFTER INSERT ON public.customer_complaints
  FOR EACH ROW EXECUTE FUNCTION public.plm_complaint_to_issue();

-- Measurements -------------------------------------------------------------------
-- BOM complete: every distinct part in the BOM tree of the product's finished
-- goods; a purchased line is complete when its code is approved and it has a
-- primary vendor, a price and a spec sheet or IQC checklist (a brand version
-- takes these from its base part); a made line when approved and it has a BOM.
CREATE OR REPLACE FUNCTION public.plm_metrics(p_product uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v jsonb; v_fgs uuid[];
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

  RETURN jsonb_build_object(
    'fg_count', coalesce(array_length(v_fgs, 1), 0),
    'bom_lines', n_lines, 'bom_done', n_done,
    'bom_pct', CASE WHEN n_lines > 0 THEN round(100.0 * n_done / n_lines, 1) ELSE 0 END,
    'spec_pct', CASE WHEN n_purch > 0 THEN round(100.0 * n_spec / n_purch, 1) ELSE 0 END,
    'cost', v_cost,
    'evt_total', evt_t, 'evt_pass', evt_p, 'svt_total', svt_t, 'svt_pass', svt_p, 'svt_not_passed', svt_open,
    'open_issues', open_iss,
    'deliverables', coalesce(v_del, '{}'::jsonb),
    'pilot_vouchers', v_pp);
END $$;
GRANT EXECUTE ON FUNCTION public.plm_metrics(uuid) TO authenticated;

-- Gates ----------------------------------------------------------------------------
-- What gate g still needs, as a list of plain sentences (empty = can pass).
CREATE OR REPLACE FUNCTION public.plm_gate_blockers(p_product uuid, p_gate smallint)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE m jsonb := public.plm_metrics(p_product); pr public.plm_products; out text[] := '{}'; d jsonb;
BEGIN
  SELECT * INTO pr FROM public.plm_products WHERE id = p_product;
  d := m->'deliverables'->(p_gate::text);
  IF p_gate = 1 THEN
    IF (d->>'done')::int < (d->>'total')::int THEN out := out || ('Still open: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(d->'open') x)); END IF;
  ELSIF p_gate = 2 THEN
    IF (m->>'fg_count')::int = 0 THEN out := out || 'Link the finished-good code(s) of this product'::text; END IF;
    IF (m->>'bom_pct')::numeric <= 70 THEN out := out || ('BOM complete ' || (m->>'bom_pct') || '% - needs more than 70%'); END IF;
  ELSIF p_gate = 3 THEN
    IF (m->>'evt_total')::int = 0 THEN out := out || 'Add the EVT tests'::text;
    ELSIF (m->>'evt_pass')::int < (m->>'evt_total')::int THEN
      out := out || (((m->>'evt_total')::int - (m->>'evt_pass')::int) || ' EVT test(s) not passed yet'); END IF;
    IF (d->>'done')::int < (d->>'total')::int THEN out := out || ('Still open: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(d->'open') x)); END IF;
  ELSIF p_gate = 4 THEN
    IF (m->>'bom_pct')::numeric <= 95 THEN out := out || ('BOM complete ' || (m->>'bom_pct') || '% - needs more than 95%'); END IF;
    IF (d->>'done')::int < (d->>'total')::int THEN out := out || ('Still open: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(d->'open') x)); END IF;
    IF (m->>'svt_total')::int = 0 THEN out := out || 'Add the SVT tests'::text;
    ELSIF (m->>'svt_not_passed')::int > 0 THEN out := out || ((m->>'svt_not_passed') || ' SVT test(s) not passed yet'); END IF;
    IF (m->>'open_issues')::int > 0 THEN out := out || ((m->>'open_issues') || ' open issue(s)'); END IF;
  ELSIF p_gate = 5 THEN
    IF pr.bis_status NOT IN ('LETTER_RECEIVED', 'NOT_REQUIRED') THEN out := out || 'BIS letter not received'::text; END IF;
    IF (d->>'done')::int < (d->>'total')::int THEN out := out || ('Still open: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(d->'open') x)); END IF;
    IF (m->>'open_issues')::int > 0 THEN out := out || ((m->>'open_issues') || ' open issue(s)'); END IF;
  END IF;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.plm_gate_blockers(uuid, smallint) TO authenticated;

-- Stage = 1 + the gates passed in a row. Gates 2 and 4 pass by themselves.
CREATE OR REPLACE FUNCTION public.plm_refresh(p_product uuid)
 RETURNS smallint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_stage smallint;
BEGIN
  LOOP
    v_stage := 1;
    WHILE v_stage <= 5 AND EXISTS (SELECT 1 FROM public.plm_gates WHERE product_id = p_product AND gate = v_stage) LOOP
      v_stage := v_stage + 1;
    END LOOP;
    EXIT WHEN v_stage NOT IN (2, 4)
      OR (SELECT status FROM public.plm_products WHERE id = p_product) <> 'ACTIVE'
      OR cardinality(public.plm_gate_blockers(p_product, v_stage)) > 0;
    INSERT INTO public.plm_gates (product_id, gate, how, note) VALUES (p_product, v_stage, 'AUTO',
      CASE v_stage WHEN 2 THEN 'BOM above 70%' ELSE 'BOM above 95%, all closed, tests passed, no open issues' END);
  END LOOP;
  PERFORM set_config('app.plm', 'on', true);
  UPDATE public.plm_products SET stage = v_stage WHERE id = p_product AND stage IS DISTINCT FROM v_stage;
  PERFORM set_config('app.plm', '', true);
  RETURN v_stage;
END $$;
GRANT EXECUTE ON FUNCTION public.plm_refresh(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.plm_refresh_all()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM public.plm_products WHERE status = 'ACTIVE' AND stage < 6 LOOP
    PERFORM public.plm_refresh(r.id); n := n + 1;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.plm_refresh_all() TO authenticated;

-- Gates 1, 3 (R&D records them) and 5 (Management releases to mass production).
CREATE OR REPLACE FUNCTION public.plm_pass_gate(p_product uuid, p_gate smallint, p_approved_by text DEFAULT NULL,
                                                p_file_url text DEFAULT NULL, p_note text DEFAULT NULL)
 RETURNS smallint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
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
  RETURN public.plm_refresh(p_product);
END $$;
GRANT EXECUTE ON FUNCTION public.plm_pass_gate(uuid, smallint, text, text, text) TO authenticated;

-- Management can release a product straight to mass production, with a reason
-- (products already being built when the ERP started).
CREATE OR REPLACE FUNCTION public.plm_release_override(p_product uuid, p_reason text)
 RETURNS smallint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management can release a product without its gates' USING ERRCODE = '42501'; END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'Give the reason for releasing it without its gates'; END IF;
  INSERT INTO public.plm_gates (product_id, gate, how, note)
  SELECT p_product, g, 'OVERRIDE', btrim(p_reason) FROM generate_series(1, 5) g
  ON CONFLICT (product_id, gate) DO NOTHING;
  RETURN public.plm_refresh(p_product);
END $$;
GRANT EXECUTE ON FUNCTION public.plm_release_override(uuid, text) TO authenticated;

-- Finished goods and BOM ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plm_link_part(p_product uuid, p_part uuid, p_link boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_type public.part_source_type; v_other uuid; v_code text;
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can link finished goods' USING ERRCODE = '42501'; END IF;
  SELECT source_type, plm_product_id, part_code INTO v_type, v_other, v_code FROM public.parts WHERE id = p_part;
  IF v_type IS DISTINCT FROM 'FINISHED_GOOD' THEN RAISE EXCEPTION 'Only a finished good is linked to a product'; END IF;
  IF p_link AND v_other IS NOT NULL AND v_other <> p_product THEN
    RAISE EXCEPTION '% already belongs to product %', v_code, (SELECT product_code FROM public.plm_products WHERE id = v_other);
  END IF;
  PERFORM set_config('app.approving', 'on', true);
  UPDATE public.parts SET plm_product_id = CASE WHEN p_link THEN p_product END WHERE id = p_part;
  PERFORM set_config('app.approving', 'off', true);
  PERFORM public.plm_refresh(p_product);
END $$;
GRANT EXECUTE ON FUNCTION public.plm_link_part(uuid, uuid, boolean) TO authenticated;

-- A variation starts from its base product's BOM.
CREATE OR REPLACE FUNCTION public.plm_copy_bom(p_from_part uuid, p_to_part uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_lines jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.bom WHERE parent_part_id = p_to_part AND is_active) THEN
    RAISE EXCEPTION 'That finished good already has a BOM. Change it in its BOM editor instead';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('child_part_id', coalesce(c.branded_from, c.id), 'quantity', b.quantity,
                     'bulk', b.issue_mode = 'BULK', 'is_critical', b.is_critical))
    INTO v_lines
    FROM public.bom b JOIN public.parts c ON c.id = b.child_part_id
   WHERE b.parent_part_id = p_from_part AND b.is_active;
  IF v_lines IS NULL THEN RAISE EXCEPTION 'The base finished good has no BOM to copy'; END IF;
  -- Brand versions are copied as their base part; the brand sync puts this
  -- finished good's own brand versions in.
  RETURN public.save_bom(p_to_part, v_lines);
END $$;
GRANT EXECUTE ON FUNCTION public.plm_copy_bom(uuid, uuid) TO authenticated;

-- A frozen BOM (product in mass production) changes only through an approved request.
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
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
              WHERE (l->>'child_part_id')::uuid = p_parent
                 OR (NOT coalesce((l->>'bulk')::boolean, false) AND coalesce((l->>'quantity')::numeric, 0) <= 0)) THEN
    RAISE EXCEPTION 'Every line needs a quantity above zero (or is marked bulk), and a part cannot be inside itself';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.parts p JOIN public.plm_products pr ON pr.id = p.plm_product_id
                  WHERE p.id = p_parent AND pr.stage = 6)
    INTO v_frozen;

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

-- Vouchers --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_projection_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p record; v_msg text; v_versions text; pr record;
BEGIN
  SELECT source_type, part_code, is_active, brand_relevant, branded_from, plm_product_id INTO p
    FROM public.parts WHERE id = NEW.part_id;
  IF NOT p.is_active THEN
    RAISE EXCEPTION '% is no longer active, so it cannot be scheduled', p.part_code;
  END IF;
  IF p.plm_product_id IS NOT NULL THEN
    SELECT product_code, stage INTO pr FROM public.plm_products WHERE id = p.plm_product_id;
  END IF;
  IF NEW.is_pilot THEN
    IF p.source_type <> 'FINISHED_GOOD' OR pr.stage IS DISTINCT FROM 5 THEN
      RAISE EXCEPTION 'A pilot build is for a finished good whose product is at stage 5 (Pilot Production)';
    END IF;
  ELSIF p.source_type = 'FINISHED_GOOD' AND pr.stage IS NOT NULL AND pr.stage < 6 THEN
    RAISE EXCEPTION '% is still in R&D (product % at stage %). It can be built in volume once it is released to mass production%.',
      p.part_code, pr.product_code, pr.stage, CASE WHEN pr.stage = 5 THEN '; until then schedule a pilot build from R&D' ELSE '' END;
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

CREATE OR REPLACE FUNCTION public.plm_schedule_pilot(p_plant_id uuid, p_part_id uuid, p_quantity numeric, p_date date,
                                                     p_line_id uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO ''
AS $$
DECLARE v_sched uuid; v_order public.production_orders%ROWTYPE;
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can schedule a pilot build' USING ERRCODE = '42501'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be more than zero'; END IF;
  INSERT INTO public.production_schedules (plant_id, projection_id, part_id, production_line_id, scheduled_date, quantity,
                                           status, notes, is_pilot, created_by)
  VALUES (p_plant_id, NULL, p_part_id, p_line_id, p_date, p_quantity, 'PLANNED', 'Pilot build (PP)', true, auth.uid())
  RETURNING id INTO v_sched;
  INSERT INTO public.production_orders (plant_id, production_schedule_id, part_id, quantity, planned_date, voucher_number,
                                        status, is_pilot, created_by)
  VALUES (p_plant_id, v_sched, p_part_id, p_quantity, p_date, '', 'PLANNED', true, auth.uid())
  RETURNING * INTO v_order;
  RETURN jsonb_build_object('schedule_id', v_sched, 'order_id', v_order.id, 'voucher_number', v_order.voucher_number);
END $$;
GRANT EXECUTE ON FUNCTION public.plm_schedule_pilot(uuid, uuid, numeric, date, uuid) TO authenticated;
