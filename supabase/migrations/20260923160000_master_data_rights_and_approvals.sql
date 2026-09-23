-- Who may change master data, and Management approval of what R&D changes.
--
-- Until now every write to parts, BOMs, vendors and customers required the
-- admin role, and the admin role also manages users. So letting R&D create a
-- part code meant letting R&D create and delete users.
--
-- From here, rights come from the department a user is in:
--
--                                   Admin   Management   R&D        others
--   users, access                     x
--   parts, sub-assemblies, FGs        x         x        x -> approval   view
--   BOMs                              x         x        x -> approval   view
--   vendors                           x         x        x -> approval   view
--   customers                         x         x                        view
--   approve                           x         x
--
-- "-> approval" means held until approved: a new part, vendor or customer is
-- saved as PENDING and cannot be used on a PO, plan, GRN or production order;
-- a BOM edit is saved as a change request and the BOM in use does not change.
-- Management's and Admin's own changes are approved as they are made.

-- ---------------------------------------------------------------------------
-- Rights
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.in_department(p_names text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_accounts ua
      JOIN public.user_departments ud ON ud.user_id = ua.id
      JOIN public.departments d ON d.id = ud.department_id
     WHERE ua.id = auth.uid() AND ua.is_active AND d.name = ANY (p_names));
$$;

CREATE OR REPLACE FUNCTION public.can_approve()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_admin() OR public.in_department(ARRAY['Management']);
$$;

CREATE OR REPLACE FUNCTION public.can_edit_masters()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.can_approve() OR public.in_department(ARRAY['R&D']);
$$;

CREATE OR REPLACE FUNCTION public.can_edit_customers()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.can_approve();
$$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'edit_masters', public.can_edit_masters(),
    'edit_customers', public.can_edit_customers(),
    'approve', public.can_approve());
$$;
GRANT EXECUTE ON FUNCTION public.in_department(text[]), public.can_approve(), public.can_edit_masters(),
  public.can_edit_customers(), public.my_permissions() TO authenticated;

-- ---------------------------------------------------------------------------
-- Approval state on parts, vendors, customers
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['parts', 'vendors', 'customers'] LOOP
    EXECUTE format($f$
      ALTER TABLE public.%1$I
        ADD COLUMN IF NOT EXISTS approval_status  text NOT NULL DEFAULT 'APPROVED',
        ADD COLUMN IF NOT EXISTS submitted_by     uuid,
        ADD COLUMN IF NOT EXISTS reviewed_by      uuid,
        ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz,
        ADD COLUMN IF NOT EXISTS rejection_reason text;
      ALTER TABLE public.%1$I DROP CONSTRAINT IF EXISTS %1$s_approval_status_known;
      ALTER TABLE public.%1$I ADD CONSTRAINT %1$s_approval_status_known
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
      CREATE INDEX IF NOT EXISTS %1$s_awaiting_approval ON public.%1$I (created_at)
        WHERE approval_status = 'PENDING';
    $f$, t);
  END LOOP;
END $$;

-- The status is set here and nowhere else: by who is saving on insert, and only
-- by review_master() (which sets app.approving) after that. A client cannot
-- send approval_status = 'APPROVED' and have it stick.
CREATE OR REPLACE FUNCTION public.master_approval_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Migrations and imports run without a signed-in user and keep what they set.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.submitted_by := auth.uid();
    NEW.rejection_reason := NULL;
    IF public.can_approve() THEN
      NEW.approval_status := 'APPROVED'; NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    ELSE
      NEW.approval_status := 'PENDING'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('app.approving', true), '') = 'on' THEN RETURN NEW; END IF;

  NEW.approval_status := OLD.approval_status;
  NEW.submitted_by := OLD.submitted_by;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.rejection_reason := OLD.rejection_reason;

  -- Fixing a rejected record sends it back for approval.
  IF OLD.approval_status = 'REJECTED' AND NOT public.can_approve() THEN
    NEW.approval_status := 'PENDING'; NEW.submitted_by := auth.uid(); NEW.rejection_reason := NULL;
  END IF;

  -- Removing master data is Management's call - except withdrawing one's own
  -- request that has not been approved yet.
  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT public.can_approve()
     AND OLD.approval_status = 'APPROVED' THEN
    RAISE EXCEPTION 'Only Management or Admin can remove an approved record' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['parts', 'vendors', 'customers'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_approval ON public.%1$I;
                    CREATE TRIGGER trg_%1$s_approval BEFORE INSERT OR UPDATE ON public.%1$I
                      FOR EACH ROW EXECUTE FUNCTION public.master_approval_guard();', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Nothing unapproved goes into use
-- ---------------------------------------------------------------------------
-- trigger args: column holding the id, master table it points at.
CREATE OR REPLACE FUNCTION public.require_approved_master() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  v_status text; v_label text;
BEGIN
  IF v_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) ->> TG_ARGV[0])::uuid IS NOT DISTINCT FROM v_id THEN RETURN NEW; END IF;
  EXECUTE format('SELECT approval_status, %s FROM public.%I WHERE id = $1',
                 CASE TG_ARGV[1] WHEN 'parts' THEN 'part_code' WHEN 'vendors' THEN 'name' ELSE 'name' END,
                 TG_ARGV[1])
     INTO v_status, v_label USING v_id;
  IF v_status IS DISTINCT FROM 'APPROVED' THEN
    RAISE EXCEPTION '% is % approval and cannot be used yet',
      v_label, CASE v_status WHEN 'REJECTED' THEN 'rejected in' ELSE 'waiting for' END
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('purchase_order_items', 'part_id', 'parts'), ('production_orders', 'part_id', 'parts'),
      ('production_schedules', 'part_id', 'parts'), ('projections', 'part_id', 'parts'),
      ('grn_items', 'part_id', 'parts'), ('spare_order_items', 'part_id', 'parts'),
      ('material_requests', 'part_id', 'parts'), ('kit_items', 'part_id', 'parts'),
      ('production_order_lines', 'part_id', 'parts'),
      ('purchase_orders', 'vendor_id', 'vendors'), ('grn', 'vendor_id', 'vendors'),
      ('projections', 'customer_id', 'customers'), ('dispatch_orders', 'customer_id', 'customers'),
      ('spare_orders', 'customer_id', 'customers')) v(tbl, col, master)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %1$I ON public.%2$I;
                    CREATE TRIGGER %1$I BEFORE INSERT OR UPDATE OF %3$I ON public.%2$I
                      FOR EACH ROW EXECUTE FUNCTION public.require_approved_master(%3$L, %4$L);',
                   'trg_approved_' || r.col, r.tbl, r.col, r.master);
  END LOOP;
END $$;

-- A live BOM line may only join approved parts.
DROP TRIGGER IF EXISTS trg_approved_parent ON public.bom;
CREATE TRIGGER trg_approved_parent BEFORE INSERT OR UPDATE OF parent_part_id ON public.bom
  FOR EACH ROW EXECUTE FUNCTION public.require_approved_master('parent_part_id', 'parts');
DROP TRIGGER IF EXISTS trg_approved_child ON public.bom;
CREATE TRIGGER trg_approved_child BEFORE INSERT OR UPDATE OF child_part_id ON public.bom
  FOR EACH ROW EXECUTE FUNCTION public.require_approved_master('child_part_id', 'parts');

-- ---------------------------------------------------------------------------
-- BOM change requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bom_change_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_part_id   uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  -- [{child_part_id, quantity, uom, is_critical}] - the whole BOM as proposed.
  lines            jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  submitted_by     uuid NOT NULL DEFAULT auth.uid(),
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  rejection_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS bom_change_requests_one_pending
  ON public.bom_change_requests (parent_part_id) WHERE status = 'PENDING';
ALTER TABLE public.bom_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bom_change_requests_read ON public.bom_change_requests;
CREATE POLICY bom_change_requests_read ON public.bom_change_requests FOR SELECT USING (public.has_role(NULL::text));
GRANT SELECT ON public.bom_change_requests TO authenticated;

-- Make the live BOM of p_parent exactly p_lines. Internal: called by save_bom
-- and review_bom_change only.
CREATE OR REPLACE FUNCTION public.apply_bom(p_parent uuid, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_added int; v_changed int; v_removed int;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _bom_next (child_part_id uuid PRIMARY KEY, quantity numeric, uom text, is_critical boolean) ON COMMIT DROP;
  DELETE FROM _bom_next;
  INSERT INTO _bom_next
  SELECT (l->>'child_part_id')::uuid, (l->>'quantity')::numeric, coalesce(nullif(l->>'uom', ''), 'PCS'),
         coalesce((l->>'is_critical')::boolean, false)
    FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l;

  DELETE FROM public.bom b WHERE b.parent_part_id = p_parent AND b.is_active
     AND NOT EXISTS (SELECT 1 FROM _bom_next n WHERE n.child_part_id = b.child_part_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  UPDATE public.bom b SET quantity = n.quantity, uom = n.uom, is_critical = n.is_critical
    FROM _bom_next n
   WHERE b.parent_part_id = p_parent AND b.is_active AND b.child_part_id = n.child_part_id
     AND (b.quantity <> n.quantity OR b.is_critical IS DISTINCT FROM n.is_critical OR b.uom IS DISTINCT FROM n.uom);
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  INSERT INTO public.bom (parent_part_id, child_part_id, quantity, uom, is_critical, created_by)
  SELECT p_parent, n.child_part_id, n.quantity, n.uom, n.is_critical, auth.uid()
    FROM _bom_next n
   WHERE NOT EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = p_parent AND b.is_active
                                                  AND b.child_part_id = n.child_part_id);
  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN jsonb_build_object('added', v_added, 'changed', v_changed, 'removed', v_removed);
END $$;
REVOKE ALL ON FUNCTION public.apply_bom(uuid, jsonb) FROM PUBLIC, authenticated, anon;

-- The one way the screen saves a BOM. Management/Admin: applied now.
-- R&D: becomes (or replaces) the pending change request for that part.
CREATE OR REPLACE FUNCTION public.save_bom(p_parent uuid, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_req uuid; v_result jsonb;
BEGIN
  IF NOT public.can_edit_masters() THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can change a bill of materials' USING ERRCODE = '42501';
  END IF;
  IF (SELECT source_type FROM public.parts WHERE id = p_parent) = 'PURCHASED' THEN
    RAISE EXCEPTION 'A purchased part cannot have a bill of materials';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
              WHERE (l->>'quantity')::numeric <= 0 OR (l->>'child_part_id')::uuid = p_parent) THEN
    RAISE EXCEPTION 'Every line needs a quantity above zero, and a part cannot be inside itself';
  END IF;

  IF public.can_approve() THEN
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
  RETURN jsonb_build_object('applied', false, 'request_id', v_req);
END $$;
GRANT EXECUTE ON FUNCTION public.save_bom(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Review
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_master(p_kind text, p_id uuid, p_approve boolean, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_table text := CASE upper(p_kind) WHEN 'PART' THEN 'parts' WHEN 'VENDOR' THEN 'vendors'
                                           WHEN 'CUSTOMER' THEN 'customers' END;
        v_n int;
BEGIN
  IF NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can approve' USING ERRCODE = '42501';
  END IF;
  IF v_table IS NULL THEN RAISE EXCEPTION 'Unknown kind %', p_kind; END IF;
  IF NOT p_approve AND nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say why it is rejected, so the person who raised it can fix it';
  END IF;
  PERFORM set_config('app.approving', 'on', true);
  EXECUTE format('UPDATE public.%I SET approval_status = $1, reviewed_by = auth.uid(), reviewed_at = now(),
                         rejection_reason = $2 WHERE id = $3 AND approval_status = ''PENDING''', v_table)
    USING CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
          CASE WHEN p_approve THEN NULL ELSE btrim(p_reason) END, p_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.approving', 'off', true);
  IF v_n = 0 THEN RAISE EXCEPTION 'That request is no longer waiting for approval'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.review_master(text, uuid, boolean, text) TO authenticated;

-- Approving a BOM change also approves the parts in it that are still pending
-- (the new sub-assembly itself, a new child) - they were shown in the request.
CREATE OR REPLACE FUNCTION public.review_bom_change(p_id uuid, p_approve boolean, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.bom_change_requests; v_result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can approve' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.bom_change_requests WHERE id = p_id AND status = 'PENDING' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That request is no longer waiting for approval'; END IF;

  IF p_approve THEN
    IF EXISTS (SELECT 1 FROM public.parts p
                WHERE (p.id = r.parent_part_id OR p.id IN (SELECT (l->>'child_part_id')::uuid FROM jsonb_array_elements(r.lines) l))
                  AND p.approval_status = 'REJECTED') THEN
      RAISE EXCEPTION 'This BOM uses a part that was rejected. Reject the BOM, or fix and approve the part first';
    END IF;
    PERFORM set_config('app.approving', 'on', true);
    UPDATE public.parts SET approval_status = 'APPROVED', reviewed_by = auth.uid(), reviewed_at = now()
     WHERE approval_status = 'PENDING'
       AND (id = r.parent_part_id OR id IN (SELECT (l->>'child_part_id')::uuid FROM jsonb_array_elements(r.lines) l));
    PERFORM set_config('app.approving', 'off', true);
    v_result := public.apply_bom(r.parent_part_id, r.lines);
    UPDATE public.bom_change_requests SET status = 'APPROVED', reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_id;
  ELSE
    IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Say why it is rejected, so the person who raised it can fix it';
    END IF;
    UPDATE public.bom_change_requests
       SET status = 'REJECTED', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = btrim(p_reason)
     WHERE id = p_id;
  END IF;
  RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.review_bom_change(uuid, boolean, text) TO authenticated;

-- Everything waiting, with the name of who raised it (user_accounts is not
-- readable by other users directly).
CREATE OR REPLACE FUNCTION public.list_master_approvals()
RETURNS TABLE(kind text, id uuid, code text, name text, detail text, parent_part_id uuid,
              lines jsonb, submitted_by_name text, submitted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'PART', p.id, p.part_code, p.name, c.name || ' · ' || c.tier, NULL::uuid, NULL::jsonb,
         coalesce(u.full_name, u.email), p.created_at
    FROM public.parts p JOIN public.part_categories c ON c.prefix = p.category
    LEFT JOIN public.user_accounts u ON u.id = p.submitted_by
   WHERE p.approval_status = 'PENDING' AND public.has_role(NULL::text)
  UNION ALL
  SELECT 'VENDOR', v.id, v.vendor_code, v.name, concat_ws(' · ', v.supplies, v.location, v.gst_number), NULL, NULL,
         coalesce(u.full_name, u.email), v.created_at
    FROM public.vendors v LEFT JOIN public.user_accounts u ON u.id = v.submitted_by
   WHERE v.approval_status = 'PENDING' AND public.has_role(NULL::text)
  UNION ALL
  SELECT 'CUSTOMER', cu.id, cu.customer_code, cu.name, concat_ws(' · ', cu.brand_name, cu.gst_number), NULL, NULL,
         coalesce(u.full_name, u.email), cu.created_at
    FROM public.customers cu LEFT JOIN public.user_accounts u ON u.id = cu.submitted_by
   WHERE cu.approval_status = 'PENDING' AND public.has_role(NULL::text)
  UNION ALL
  SELECT 'BOM', r.id, p.part_code, p.name, NULL, r.parent_part_id, r.lines,
         coalesce(u.full_name, u.email), r.submitted_at
    FROM public.bom_change_requests r JOIN public.parts p ON p.id = r.parent_part_id
    LEFT JOIN public.user_accounts u ON u.id = r.submitted_by
   WHERE r.status = 'PENDING' AND public.has_role(NULL::text)
  ORDER BY 9;
$$;
GRANT EXECUTE ON FUNCTION public.list_master_approvals() TO authenticated;

-- ---------------------------------------------------------------------------
-- Write policies: department rights instead of the admin role
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('parts', 'public.can_edit_masters()'), ('part_vendors', 'public.can_edit_masters()'),
      ('part_specifications', 'public.can_edit_masters()'), ('part_categories', 'public.can_edit_masters()'),
      ('brands', 'public.can_edit_masters()'), ('vendors', 'public.can_edit_masters()'),
      ('vendor_contacts', 'public.can_edit_masters()'), ('customers', 'public.can_edit_customers()'),
      ('bom', 'public.can_approve()')) v(tbl, rule)
  LOOP
    -- Replace every non-SELECT policy on the table with one clear rule.
    PERFORM 1;
    EXECUTE (SELECT coalesce(string_agg(format('DROP POLICY %I ON public.%I;', policyname, r.tbl), ' '), '')
               FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl AND cmd <> 'SELECT');
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s);', r.tbl || '_insert', r.tbl, r.rule);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s);', r.tbl || '_update', r.tbl, r.rule, r.rule);
    -- Hard deletes of a master are Management's; child rows follow the table's rule.
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (%s);', r.tbl || '_delete', r.tbl,
                   CASE WHEN r.tbl IN ('parts', 'vendors', 'customers', 'part_categories', 'brands')
                        THEN 'public.can_approve()' ELSE r.rule END);
  END LOOP;
END $$;

-- Vendor bank details: Management and Admin (they approve payments).
CREATE OR REPLACE FUNCTION public.get_vendor_finance(p_vendor_id uuid)
RETURNS TABLE(id uuid, bank_account_number text, ifsc_code text, bank_name text,
              account_holder_name text, pan_number text,
              gst_certificate_url text, msme_certificate_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can view vendor bank details' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT v.id, v.bank_account_number, v.ifsc_code, v.bank_name, v.account_holder_name, v.pan_number,
         v.gst_certificate_url, v.msme_certificate_url
    FROM public.vendors v WHERE v.id = p_vendor_id;
END $$;

GRANT SELECT (approval_status, submitted_by, reviewed_by, reviewed_at, rejection_reason) ON public.vendors TO authenticated;
DO $$ BEGIN
  EXECUTE (SELECT coalesce(string_agg(format('DROP POLICY %I ON public.customer_warehouses;', policyname), ' '), '')
             FROM pg_policies WHERE schemaname='public' AND tablename='customer_warehouses' AND cmd <> 'SELECT');
END $$;
CREATE POLICY customer_warehouses_write ON public.customer_warehouses FOR ALL
  USING (public.can_edit_customers()) WITH CHECK (public.can_edit_customers());
