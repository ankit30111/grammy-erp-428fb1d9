-- ============================================================================
-- CUTOVER: clean baseline. Keeps dash_*, HR tables, auth.*, storage.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. DROP the old public spine + masters (dash_* and HR preserved)
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT LIKE 'dash\_%'
      AND c.relname NOT IN ('employees','skills','training_programs','employee_skills',
                            'employee_training','attendance','payroll','performance_reviews')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;

DROP VIEW IF EXISTS public.material_requirements_view CASCADE;
DROP VIEW IF EXISTS public.material_shortages_calculated CASCADE;
DROP VIEW IF EXISTS public.stock_balance_check CASCADE;

DROP TYPE IF EXISTS public.bom_type CASCADE;
DROP TYPE IF EXISTS public.bom_type_enum CASCADE;
DROP TYPE IF EXISTS public.batch_item_type CASCADE;
DROP TYPE IF EXISTS public.production_line_type CASCADE;
DROP TYPE IF EXISTS public.receipt_type CASCADE;

DROP FUNCTION IF EXISTS public.post_stock_movement(uuid,uuid,uuid,numeric,text,text,text,uuid,text,text) CASCADE;
DROP FUNCTION IF EXISTS public.post_stock_movements(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.log_audit_event(text,text,uuid,jsonb,jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.log_material_movement(uuid,text,integer,uuid,text,text,text) CASCADE;
DROP FUNCTION IF EXISTS public.log_inventory_movements() CASCADE;
DROP FUNCTION IF EXISTS public.recalc_projection_quantities() CASCADE;
DROP FUNCTION IF EXISTS public.recalc_projection_quantities_from_order() CASCADE;
DROP FUNCTION IF EXISTS public.update_projection_scheduled_quantity() CASCADE;
DROP FUNCTION IF EXISTS public.generate_po_number() CASCADE;
DROP FUNCTION IF EXISTS public.set_po_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_grn_number() CASCADE;
DROP FUNCTION IF EXISTS public.set_grn_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_kit_number() CASCADE;
DROP FUNCTION IF EXISTS public.set_kit_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_dispatch_order_number() CASCADE;
DROP FUNCTION IF EXISTS public.set_dispatch_order_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_spare_order_number() CASCADE;
DROP FUNCTION IF EXISTS public.set_spare_order_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_material_code(text) CASCADE;
DROP FUNCTION IF EXISTS public.set_material_code() CASCADE;
DROP FUNCTION IF EXISTS public.generate_complaint_number() CASCADE;
DROP FUNCTION IF EXISTS public.set_complaint_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_temp_part_code(text) CASCADE;
DROP FUNCTION IF EXISTS public.update_inventory_from_grn() CASCADE;
DROP FUNCTION IF EXISTS public.update_inventory_from_store_verification() CASCADE;
DROP FUNCTION IF EXISTS public.update_po_received_quantities() CASCADE;
DROP FUNCTION IF EXISTS public.sync_grn_status_from_items() CASCADE;
DROP FUNCTION IF EXISTS public.create_store_discrepancy() CASCADE;
DROP FUNCTION IF EXISTS public.create_vendor_capa_on_iqc_status() CASCADE;
DROP FUNCTION IF EXISTS public.validate_iqc_report_required() CASCADE;
DROP FUNCTION IF EXISTS public.guard_production_order_delete() CASCADE;
DROP FUNCTION IF EXISTS public.guard_production_schedule_changes() CASCADE;
DROP FUNCTION IF EXISTS public.production_schedule_locked(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.delete_production_schedule_cascade(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_projection(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.renumber_vouchers_after_deletion(text) CASCADE;
DROP FUNCTION IF EXISTS public.stock_ledger_append_only() CASCADE;
DROP FUNCTION IF EXISTS public.log_production_dispatch() CASCADE;
DROP FUNCTION IF EXISTS public.log_production_material_receipt(uuid,uuid,integer,uuid,text) CASCADE;
DROP FUNCTION IF EXISTS public.log_production_material_receipt_with_discrepancy_check(uuid,uuid,integer,uuid,text) CASCADE;
DROP FUNCTION IF EXISTS public.log_production_receipt_with_discrepancy(uuid,uuid,integer,integer,uuid,text) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_production_discrepancy(uuid,text,uuid,text) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_production_receipt_discrepancy(uuid,text,uuid,text) CASCADE;
DROP FUNCTION IF EXISTS public.create_complaints_from_batch(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.update_complaint_status_on_parts_closure() CASCADE;
DROP FUNCTION IF EXISTS public.get_vendor_finance(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_customer_finance(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_vendor_code() CASCADE;
DROP FUNCTION IF EXISTS public.set_vendor_code() CASCADE;
DROP FUNCTION IF EXISTS public.set_verified_by_on_insert() CASCADE;
DROP FUNCTION IF EXISTS public.audit_user_role_changes() CASCADE;
DROP FUNCTION IF EXISTS public.update_iqc_vendor_capa_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_production_capa_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_capa_implementation_checks_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_production_discrepancies_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_kit_items_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_kit_preparation_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_npd_updated_at_column() CASCADE;

-- ---------------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE public.part_source_type AS ENUM ('PURCHASED','ASSEMBLED_STOCKED','ASSEMBLED_INLINE','FINISHED_GOOD');
CREATE TYPE public.production_line_type AS ENUM ('LINE','SUB_ASSEMBLY');
CREATE TYPE public.stock_location_type AS ENUM ('STORE','QUARANTINE','REJECT');
CREATE TYPE public.po_status AS ENUM ('DRAFT','PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED');
CREATE TYPE public.grn_status AS ENUM ('DRAFT','IQC_PENDING','IQC_DONE','STORE_CONFIRMED','CLOSED');
CREATE TYPE public.iqc_outcome AS ENUM ('PENDING','ACCEPTED','REJECTED','PARTIAL');
CREATE TYPE public.schedule_status AS ENUM ('PLANNED','KIT_PREPARED','KIT_SENT','IN_PRODUCTION','COMPLETED','CANCELLED');
CREATE TYPE public.hold_status AS ENUM ('ACTIVE','ISSUED','RELEASED');
CREATE TYPE public.hold_source AS ENUM ('VOUCHER','SPARE','DASH','SAMPLE','REWORK');
CREATE TYPE public.capa_status AS ENUM ('OPEN','SUBMITTED','ACCEPTED','REJECTED','CLOSED');
CREATE TYPE public.container_status AS ENUM ('ORDERED','LOADED','SHIPPED','IN_TRANSIT','INDIA_CUSTOM','ARRIVED','AT_FACTORY');
CREATE TYPE public.dispatch_status AS ENUM ('DRAFT','PACKED','GATE_OUT','DELIVERED','CANCELLED');
CREATE TYPE public.rejection_verdict AS ENUM ('DAMAGED','FAULTY','USABLE');
CREATE TYPE public.complaint_status AS ENUM ('OPEN','UNDER_REVIEW','PARTS_SENT','RESOLVED','CLOSED');
CREATE TYPE public.npd_stage AS ENUM ('CONCEPT','DESIGN','BOM','SAMPLE','VALIDATION','LAUNCHED','DROPPED');

-- ---------------------------------------------------------------------------
-- 2. ACCESS
-- ---------------------------------------------------------------------------
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  address_line1 text, address_line2 text, city text, state text,
  postal_code text, country text DEFAULT 'India',
  phone text, email text, gstin text, factory_license_no text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_accounts (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password_hash text,
  full_name text,
  role text NOT NULL DEFAULT 'user',
  is_active boolean NOT NULL DEFAULT true,
  department_id uuid REFERENCES public.departments(id),
  default_plant_id uuid REFERENCES public.plants(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.department_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  tab_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, tab_name)
);

CREATE TABLE public.user_departments (
  user_id uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  PRIMARY KEY (user_id, department_id)
);

CREATE TABLE public.user_plants (
  user_id uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  PRIMARY KEY (user_id, plant_id)
);

CREATE TABLE public.ht_store (
  account_key text NOT NULL,
  store_key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_key, store_key)
);

-- THE single access helper (R10)
CREATE OR REPLACE FUNCTION public.has_role(_module text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_accounts ua
    WHERE ua.id = auth.uid() AND ua.is_active
      AND (ua.role = 'admin' OR _module IS NULL
        OR EXISTS (SELECT 1 FROM public.user_departments ud
                   JOIN public.department_permissions dp ON dp.department_id = ud.department_id
                   WHERE ud.user_id = ua.id AND dp.tab_name = _module))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_accounts
                 WHERE id = auth.uid() AND is_active AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.in_plant(_plant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_admin()
      OR EXISTS (SELECT 1 FROM public.user_plants
                 WHERE user_id = auth.uid() AND plant_id = _plant_id);
$$;

-- ---------------------------------------------------------------------------
-- 3. SHARED PLUMBING
-- ---------------------------------------------------------------------------
-- OWNS: updated_at on every table that has it. Nothing else writes updated_at.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  from_status text, to_status text,
  old_values jsonb, new_values jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_record ON public.audit_logs (table_name, record_id, created_at DESC);

-- OWNS: rows in audit_logs. TG_ARGV[0] = status column name.
CREATE OR REPLACE FUNCTION public.audit_state_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE col text := TG_ARGV[0]; old_s text; new_s text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    EXECUTE format('SELECT ($1).%I::text', col) INTO new_s USING NEW;
    INSERT INTO public.audit_logs(table_name, record_id, action, to_status, new_values, actor_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', new_s, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    EXECUTE format('SELECT ($1).%I::text', col) INTO old_s USING OLD;
    EXECUTE format('SELECT ($1).%I::text', col) INTO new_s USING NEW;
    IF old_s IS DISTINCT FROM new_s THEN
      INSERT INTO public.audit_logs(table_name, record_id, action, from_status, to_status, old_values, new_values, actor_id)
      VALUES (TG_TABLE_NAME, NEW.id, 'STATUS_CHANGE', old_s, new_s, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    END IF;
    RETURN NEW;
  ELSE
    EXECUTE format('SELECT ($1).%I::text', col) INTO old_s USING OLD;
    INSERT INTO public.audit_logs(table_name, record_id, action, from_status, old_values, actor_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', old_s, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
END; $$;

-- R9: document numbers issued by the database only.
CREATE SEQUENCE public.seq_grn_number;
CREATE SEQUENCE public.seq_voucher_number;
CREATE SEQUENCE public.seq_kit_number;
CREATE SEQUENCE public.seq_request_number;
CREATE SEQUENCE public.seq_dispatch_number;
CREATE SEQUENCE public.seq_spare_order_number;
CREATE SEQUENCE public.seq_capa_number;
CREATE SEQUENCE public.seq_complaint_number;

CREATE OR REPLACE FUNCTION public.next_doc_number(_prefix text, _seq regclass)
RETURNS text LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT _prefix || '-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval(_seq)::text, 5, '0');
$$;

-- Per-month document counter (a document serial, not a derived total).
CREATE TABLE public.document_counters (
  doc_family text NOT NULL,
  period_key text NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_family, period_key)
);

-- OWNS: purchase_orders.po_number — format GAPO-MM_NN, restarts at 01 each month.
CREATE OR REPLACE FUNCTION public.next_po_number()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE mm text := to_char(now(), 'MM'); pk text := to_char(now(), 'YYYY-MM'); n integer;
BEGIN
  INSERT INTO public.document_counters (doc_family, period_key, last_value)
  VALUES ('PO', pk, 1)
  ON CONFLICT (doc_family, period_key)
  DO UPDATE SET last_value = public.document_counters.last_value + 1
  RETURNING last_value INTO n;
  RETURN 'GAPO-' || mm || '_' || lpad(n::text, 2, '0');
END; $$;

-- ---------------------------------------------------------------------------
-- 4. MASTERS — parts (products + raw_materials merged), recursive BOM
-- ---------------------------------------------------------------------------
CREATE TABLE public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,                      -- P | W | E | O
  uom text NOT NULL DEFAULT 'PCS',
  source_type public.part_source_type NOT NULL DEFAULT 'PURCHASED',
  plant_id uuid REFERENCES public.plants(id),   -- NULL = all plants
  -- specification (merged from raw_material_specifications; every part has one)
  specification text,
  specification_sheet_url text,
  iqc_checklist_url text,
  spec_version integer NOT NULL DEFAULT 1,
  spec_changes_description text,
  -- sourcing / costing
  sourcing_type text,                          -- DOMESTIC | IMPORTED
  currency text, unit_price numeric, cbm_per_unit numeric,
  supplier_country text, last_price_update timestamptz,
  -- finished-good documents
  bom_url text, wi_url text, pqc_checklist_url text, oqc_checklist_url text,
  ccl_url text, crs_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_parts_source ON public.parts (source_type, is_active);

CREATE TABLE public.part_specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  specification_sheet_url text,
  iqc_checklist_url text,
  changes_description text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_id, version_number)
);

CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code text NOT NULL UNIQUE,
  name text NOT NULL,
  email text, contact_number text, address text,
  gst_number text,
  contact_person_name text,
  bank_account_number text, ifsc_code text,
  gst_certificate_url text, msme_certificate_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.part_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_id, vendor_id)
);

CREATE TABLE public.bom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  child_part_id uuid NOT NULL REFERENCES public.parts(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  uom text NOT NULL DEFAULT 'PCS',
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  is_critical boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bom_no_self_parent CHECK (parent_part_id <> child_part_id),
  UNIQUE (parent_part_id, child_part_id, version)
);
CREATE INDEX idx_bom_parent ON public.bom (parent_part_id, is_active);
CREATE INDEX idx_bom_child ON public.bom (child_part_id);

-- A PURCHASED part can never be a BOM parent.
CREATE OR REPLACE FUNCTION public.bom_parent_must_be_made()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE st public.part_source_type;
BEGIN
  SELECT source_type INTO st FROM public.parts WHERE id = NEW.parent_part_id;
  IF st = 'PURCHASED' THEN
    RAISE EXCEPTION 'A purchased part cannot have a bill of materials';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_bom_parent_must_be_made
  BEFORE INSERT OR UPDATE ON public.bom
  FOR EACH ROW EXECUTE FUNCTION public.bom_parent_must_be_made();

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code text NOT NULL UNIQUE,
  name text NOT NULL,
  email text, contact_number text, address text,
  gst_number text, brand_name text, contact_person_name text,
  bank_account_number text, ifsc_code text,
  gst_certificate_url text, msme_certificate_url text, brand_authorization_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customer_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  warehouse_name text NOT NULL,
  address text NOT NULL,
  contact_person text, contact_number text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.production_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  line_type public.production_line_type NOT NULL DEFAULT 'LINE',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  location_building text, location_floor text, location_bay text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, code)
);

CREATE TABLE public.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type text NOT NULL,
  reference_id uuid NOT NULL,
  document_url text,
  status text NOT NULL DEFAULT 'PENDING',
  submitted_by uuid, submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid, reviewed_at timestamptz,
  comments text, rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 5. STOCK — the only mechanism (R3)
-- ---------------------------------------------------------------------------
CREATE TABLE public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  location_type public.stock_location_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, code)
);

CREATE TABLE public.stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  part_id uuid NOT NULL REFERENCES public.parts(id),
  location_id uuid NOT NULL REFERENCES public.stock_locations(id),
  qty_delta numeric NOT NULL CHECK (qty_delta <> 0),
  balance_after numeric NOT NULL,
  movement_type text NOT NULL,
  reason_code text,
  reference_type text, reference_id uuid, reference_number text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_key ON public.stock_ledger (plant_id, part_id, location_id, created_at DESC);
CREATE INDEX idx_ledger_ref ON public.stock_ledger (reference_type, reference_id);

CREATE OR REPLACE FUNCTION public.stock_ledger_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'stock_ledger is append-only'; END; $$;
CREATE TRIGGER trg_stock_ledger_append_only
  BEFORE UPDATE OR DELETE ON public.stock_ledger
  FOR EACH ROW EXECUTE FUNCTION public.stock_ledger_append_only();

CREATE TABLE public.stock_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  part_id uuid NOT NULL REFERENCES public.parts(id),
  location_id uuid NOT NULL REFERENCES public.stock_locations(id),
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_stock numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, part_id, location_id)
);

-- OWNS: stock_balance.quantity — recomputed as the SUM of the ledger.
CREATE OR REPLACE FUNCTION public.recalc_stock_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE total numeric;
BEGIN
  SELECT COALESCE(SUM(qty_delta), 0) INTO total FROM public.stock_ledger
  WHERE plant_id = NEW.plant_id AND part_id = NEW.part_id AND location_id = NEW.location_id;
  INSERT INTO public.stock_balance (plant_id, part_id, location_id, quantity, updated_at)
  VALUES (NEW.plant_id, NEW.part_id, NEW.location_id, total, now())
  ON CONFLICT (plant_id, part_id, location_id)
  DO UPDATE SET quantity = total, updated_at = now();
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_stock_balance
  AFTER INSERT ON public.stock_ledger
  FOR EACH ROW EXECUTE FUNCTION public.recalc_stock_balance();

-- The ONLY write path into stock.
CREATE OR REPLACE FUNCTION public.post_stock_movements(p_movements jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m jsonb; running numeric; out_ids uuid[] := '{}'; new_id uuid;
BEGIN
  IF jsonb_typeof(p_movements) <> 'array' THEN
    RAISE EXCEPTION 'p_movements must be a JSON array';
  END IF;
  FOR m IN SELECT * FROM jsonb_array_elements(p_movements) LOOP
    IF NOT public.in_plant((m->>'plant_id')::uuid) THEN
      RAISE EXCEPTION 'Not permitted to post stock for this plant';
    END IF;
    SELECT COALESCE(SUM(qty_delta), 0) INTO running FROM public.stock_ledger
    WHERE plant_id = (m->>'plant_id')::uuid AND part_id = (m->>'part_id')::uuid
      AND location_id = (m->>'location_id')::uuid;
    running := running + (m->>'qty_delta')::numeric;
    IF running < 0 THEN
      RAISE EXCEPTION 'Insufficient stock: movement would take balance to %', running;
    END IF;
    INSERT INTO public.stock_ledger (plant_id, part_id, location_id, qty_delta, balance_after,
      movement_type, reason_code, reference_type, reference_id, reference_number, notes)
    VALUES ((m->>'plant_id')::uuid, (m->>'part_id')::uuid, (m->>'location_id')::uuid,
      (m->>'qty_delta')::numeric, running, m->>'movement_type', m->>'reason_code',
      m->>'reference_type', NULLIF(m->>'reference_id','')::uuid, m->>'reference_number', m->>'notes')
    RETURNING id INTO new_id;
    out_ids := out_ids || new_id;
  END LOOP;
  RETURN jsonb_build_object('posted', COALESCE(array_length(out_ids,1),0), 'ids', to_jsonb(out_ids));
END; $$;

CREATE OR REPLACE FUNCTION public.post_stock_movement(
  p_plant_id uuid, p_part_id uuid, p_location_id uuid, p_qty_delta numeric,
  p_movement_type text, p_reason_code text DEFAULT NULL, p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL, p_reference_number text DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.post_stock_movements(jsonb_build_array(jsonb_build_object(
    'plant_id', p_plant_id, 'part_id', p_part_id, 'location_id', p_location_id,
    'qty_delta', p_qty_delta, 'movement_type', p_movement_type, 'reason_code', p_reason_code,
    'reference_type', p_reference_type, 'reference_id', p_reference_id,
    'reference_number', p_reference_number, 'notes', p_notes)));
$$;

CREATE TABLE public.stock_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  part_id uuid NOT NULL REFERENCES public.parts(id),
  location_id uuid NOT NULL REFERENCES public.stock_locations(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  needed_on date NOT NULL,
  source public.hold_source NOT NULL,
  production_order_id uuid,
  reference_type text, reference_id uuid,
  status public.hold_status NOT NULL DEFAULT 'ACTIVE',
  released_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hold_voucher_needs_order CHECK (source <> 'VOUCHER' OR production_order_id IS NOT NULL)
);
CREATE INDEX idx_holds_key ON public.stock_holds (plant_id, part_id, status, needed_on);

-- ---------------------------------------------------------------------------
-- 6. DEMAND
-- ---------------------------------------------------------------------------
CREATE TABLE public.projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  part_id uuid NOT NULL REFERENCES public.parts(id),
  month date NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  scheduled_quantity numeric NOT NULL DEFAULT 0,   -- OWNED BY trg_recalc_projection_totals_*
  vouchered_quantity numeric NOT NULL DEFAULT 0,   -- OWNED BY trg_recalc_projection_totals_*
  produced_quantity numeric NOT NULL DEFAULT 0,    -- OWNED BY trg_recalc_projection_totals_*
  status text NOT NULL DEFAULT 'NEW',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.production_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  projection_id uuid NOT NULL REFERENCES public.projections(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts(id),
  production_line_id uuid REFERENCES public.production_lines(id),
  scheduled_date date NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  status public.schedule_status NOT NULL DEFAULT 'PLANNED',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number text NOT NULL UNIQUE,             -- OWNED BY trg_production_orders_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  production_schedule_id uuid REFERENCES public.production_schedules(id) ON DELETE CASCADE,
  projection_id uuid REFERENCES public.projections(id),
  part_id uuid NOT NULL REFERENCES public.parts(id),
  production_line_id uuid REFERENCES public.production_lines(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  produced_quantity numeric NOT NULL DEFAULT 0,    -- OWNED BY trg_recalc_order_produced
  status public.schedule_status NOT NULL DEFAULT 'PLANNED',
  planned_date date NOT NULL DEFAULT current_date,
  started_at timestamptz, completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Output must be a finished good or a stocked assembly.
CREATE OR REPLACE FUNCTION public.order_output_must_be_made()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE st public.part_source_type;
BEGIN
  SELECT source_type INTO st FROM public.parts WHERE id = NEW.part_id;
  IF st NOT IN ('FINISHED_GOOD','ASSEMBLED_STOCKED') THEN
    RAISE EXCEPTION 'Production output must be a finished good or a stocked assembly';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_order_output_must_be_made
  BEFORE INSERT OR UPDATE OF part_id ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.order_output_must_be_made();

ALTER TABLE public.stock_holds
  ADD CONSTRAINT stock_holds_production_order_fkey
  FOREIGN KEY (production_order_id) REFERENCES public.production_orders(id) ON DELETE CASCADE;

-- OWNS: production_orders.voucher_number
CREATE OR REPLACE FUNCTION public.set_voucher_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.voucher_number := public.next_doc_number('PV', 'public.seq_voucher_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_production_orders_number BEFORE INSERT ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_voucher_number();

-- OWNS: projections.scheduled_quantity / vouchered_quantity / produced_quantity (SUMs)
CREATE OR REPLACE FUNCTION public.recalc_projection_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid := COALESCE(NEW.projection_id, OLD.projection_id);
BEGIN
  IF pid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.projections p SET
    scheduled_quantity = COALESCE((SELECT SUM(s.quantity) FROM public.production_schedules s
                                   WHERE s.projection_id = p.id AND s.status <> 'CANCELLED'), 0),
    vouchered_quantity = COALESCE((SELECT SUM(o.quantity) FROM public.production_orders o
                                   WHERE o.projection_id = p.id AND o.status <> 'CANCELLED'), 0),
    produced_quantity  = COALESCE((SELECT SUM(o.produced_quantity) FROM public.production_orders o
                                   WHERE o.projection_id = p.id), 0),
    updated_at = now()
  WHERE p.id = pid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_projection_totals_from_schedule
  AFTER INSERT OR UPDATE OR DELETE ON public.production_schedules
  FOR EACH ROW EXECUTE FUNCTION public.recalc_projection_totals();
CREATE TRIGGER trg_recalc_projection_totals_from_order
  AFTER INSERT OR UPDATE OR DELETE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.recalc_projection_totals();

-- Lifecycle lock: editable only before the kit leaves the store; admin bypasses.
CREATE OR REPLACE FUNCTION public.guard_schedule_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.is_admin() THEN RETURN COALESCE(NEW, OLD); END IF;
  IF OLD.status IN ('KIT_SENT','IN_PRODUCTION','COMPLETED') THEN
    RAISE EXCEPTION 'This production is already sent to production and can no longer be changed';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_guard_schedule_update BEFORE UPDATE ON public.production_schedules
  FOR EACH ROW EXECUTE FUNCTION public.guard_schedule_lifecycle();
CREATE TRIGGER trg_guard_schedule_delete BEFORE DELETE ON public.production_schedules
  FOR EACH ROW EXECUTE FUNCTION public.guard_schedule_lifecycle();

-- ---------------------------------------------------------------------------
-- 7. SHORTAGE -> PURCHASE -> IMPORT -> GRN
-- ---------------------------------------------------------------------------
CREATE TABLE public.shortages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  part_id uuid NOT NULL REFERENCES public.parts(id),
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE CASCADE,
  production_schedule_id uuid REFERENCES public.production_schedules(id) ON DELETE CASCADE,
  required_quantity numeric NOT NULL CHECK (required_quantity > 0),
  available_quantity numeric NOT NULL DEFAULT 0,
  shortage_quantity numeric NOT NULL CHECK (shortage_quantity > 0),
  needed_on date NOT NULL,
  purchase_order_item_id uuid,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,                  -- OWNED BY trg_purchase_orders_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  projection_id uuid REFERENCES public.projections(id),
  is_import boolean NOT NULL DEFAULT false,
  origin_country text,
  promised_loading_date date,
  promised_delivery_date date,
  po_date date NOT NULL DEFAULT current_date,
  status public.po_status NOT NULL DEFAULT 'DRAFT',
  currency text NOT NULL DEFAULT 'INR',
  total_amount numeric NOT NULL DEFAULT 0,         -- OWNED BY trg_recalc_po_total
  notes text,
  created_by uuid, approved_by uuid, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  received_quantity numeric NOT NULL DEFAULT 0,    -- OWNED BY trg_recalc_po_item_received
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shortages
  ADD CONSTRAINT shortages_po_item_fkey
  FOREIGN KEY (purchase_order_item_id) REFERENCES public.purchase_order_items(id) ON DELETE SET NULL;

-- OWNS: purchase_orders.po_number (GAPO-MM_NN)
CREATE OR REPLACE FUNCTION public.set_po_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.po_number := public.next_po_number(); RETURN NEW; END; $$;
CREATE TRIGGER trg_purchase_orders_number BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_po_number();

-- OWNS: purchase_orders.total_amount (SUM of items)
CREATE OR REPLACE FUNCTION public.recalc_po_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE poid uuid := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
BEGIN
  UPDATE public.purchase_orders po
  SET total_amount = COALESCE((SELECT SUM(i.line_total) FROM public.purchase_order_items i
                               WHERE i.purchase_order_id = po.id), 0), updated_at = now()
  WHERE po.id = poid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_po_total
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_po_total();

CREATE TABLE public.import_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_number text NOT NULL UNIQUE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  current_status public.container_status NOT NULL DEFAULT 'ORDERED',
  vessel_name text, supplier_info text, notes text,
  ordered_date date,
  planned_loaded date,  loaded_date date,
  planned_shipped date, shipped_date date,
  planned_arrived date, arrived_date date, indian_dock_date date,
  planned_factory date, factory_arrival_date date,
  china_custom_date date, india_custom_date date,
  total_cbm numeric,
  freight_cost numeric, duty_cost numeric, other_cost numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.container_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.import_containers(id) ON DELETE CASCADE,
  part_id uuid REFERENCES public.parts(id),
  brand text, model text, material_description text,
  quantity numeric NOT NULL CHECK (quantity > 0),
  cbm_occupied numeric,
  unit_cost_allocation numeric,                   -- OWNED BY trg_allocate_container_cost
  status text NOT NULL DEFAULT 'PENDING',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- OWNS: container_materials.unit_cost_allocation (CBM-proportional, recomputed)
CREATE OR REPLACE FUNCTION public.allocate_container_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cid uuid := COALESCE(NEW.container_id, OLD.container_id);
        total_cost numeric; total_cbm numeric;
BEGIN
  SELECT COALESCE(freight_cost,0)+COALESCE(duty_cost,0)+COALESCE(other_cost,0)
    INTO total_cost FROM public.import_containers WHERE id = cid;
  SELECT NULLIF(SUM(COALESCE(cbm_occupied,0)),0) INTO total_cbm
    FROM public.container_materials WHERE container_id = cid;
  UPDATE public.container_materials cm
  SET unit_cost_allocation = CASE WHEN total_cbm IS NULL OR cm.quantity = 0 THEN NULL
        ELSE (total_cost * COALESCE(cm.cbm_occupied,0) / total_cbm) / cm.quantity END,
      updated_at = now()
  WHERE cm.container_id = cid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_allocate_container_cost
  AFTER INSERT OR DELETE OR UPDATE OF quantity, cbm_occupied ON public.container_materials
  FOR EACH ROW EXECUTE FUNCTION public.allocate_container_cost();

CREATE TABLE public.grn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text NOT NULL UNIQUE,                -- OWNED BY trg_grn_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  import_container_id uuid REFERENCES public.import_containers(id),
  invoice_number text,
  invoice_quantity numeric,
  invoice_date date,
  received_date date NOT NULL DEFAULT current_date,
  status public.grn_status NOT NULL DEFAULT 'DRAFT',   -- OWNED BY trg_recalc_grn_status
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.grn_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.grn(id) ON DELETE CASCADE,
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id),
  part_id uuid NOT NULL REFERENCES public.parts(id),
  received_quantity numeric NOT NULL CHECK (received_quantity > 0),
  iqc_outcome public.iqc_outcome NOT NULL DEFAULT 'PENDING',
  iqc_accepted_quantity numeric NOT NULL DEFAULT 0,
  iqc_rejected_quantity numeric NOT NULL DEFAULT 0,
  iqc_report_url text,
  iqc_by uuid, iqc_at timestamptz,
  store_counted_quantity numeric,
  store_confirmed_by uuid, store_confirmed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iqc_split_matches_receipt
    CHECK (iqc_accepted_quantity + iqc_rejected_quantity <= received_quantity)
);

-- OWNS: grn.grn_number
CREATE OR REPLACE FUNCTION public.set_grn_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.grn_number := public.next_doc_number('GRN', 'public.seq_grn_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_grn_number BEFORE INSERT ON public.grn
  FOR EACH ROW EXECUTE FUNCTION public.set_grn_number();

-- OWNS: purchase_order_items.received_quantity (SUM of grn_items)
CREATE OR REPLACE FUNCTION public.recalc_po_item_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE iid uuid := COALESCE(NEW.purchase_order_item_id, OLD.purchase_order_item_id);
BEGIN
  IF iid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.purchase_order_items i
  SET received_quantity = COALESCE((SELECT SUM(g.received_quantity) FROM public.grn_items g
                                    WHERE g.purchase_order_item_id = i.id), 0), updated_at = now()
  WHERE i.id = iid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_po_item_received
  AFTER INSERT OR DELETE OR UPDATE OF received_quantity, purchase_order_item_id ON public.grn_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_po_item_received();

-- OWNS: grn.status (derived from its items)
CREATE OR REPLACE FUNCTION public.recalc_grn_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE gid uuid := COALESCE(NEW.grn_id, OLD.grn_id); s public.grn_status;
BEGIN
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 'DRAFT'
    WHEN COUNT(*) FILTER (WHERE store_confirmed_at IS NOT NULL) = COUNT(*) THEN 'STORE_CONFIRMED'
    WHEN COUNT(*) FILTER (WHERE iqc_outcome <> 'PENDING') = COUNT(*) THEN 'IQC_DONE'
    ELSE 'IQC_PENDING' END
  INTO s FROM public.grn_items WHERE grn_id = gid;
  UPDATE public.grn SET status = s, updated_at = now() WHERE id = gid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_grn_status
  AFTER INSERT OR UPDATE OR DELETE ON public.grn_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_grn_status();

-- ---------------------------------------------------------------------------
-- 8. STORE ISSUE — kits, kit returns, material requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.kit_preparation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_number text NOT NULL UNIQUE,               -- OWNED BY trg_kit_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PREPARING',
  prepared_by uuid, sent_at timestamptz, received_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_preparation_id uuid NOT NULL REFERENCES public.kit_preparation(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts(id),
  required_quantity numeric NOT NULL CHECK (required_quantity > 0),
  issued_quantity numeric NOT NULL DEFAULT 0,
  received_quantity numeric,
  returned_quantity numeric NOT NULL DEFAULT 0,  -- OWNED BY trg_recalc_kit_returned
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kit_preparation_id, part_id)
);

CREATE TABLE public.kit_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_item_id uuid NOT NULL REFERENCES public.kit_items(id) ON DELETE CASCADE,
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  verdict public.rejection_verdict NOT NULL,
  notes text,
  returned_by uuid, verified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- OWNS: kit_items.returned_quantity (SUM of kit_returns)
CREATE OR REPLACE FUNCTION public.recalc_kit_returned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE kid uuid := COALESCE(NEW.kit_item_id, OLD.kit_item_id);
BEGIN
  UPDATE public.kit_items k
  SET returned_quantity = COALESCE((SELECT SUM(r.quantity) FROM public.kit_returns r
                                    WHERE r.kit_item_id = k.id), 0), updated_at = now()
  WHERE k.id = kid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_kit_returned
  AFTER INSERT OR UPDATE OR DELETE ON public.kit_returns
  FOR EACH ROW EXECUTE FUNCTION public.recalc_kit_returned();

-- OWNS: kit_preparation.kit_number
CREATE OR REPLACE FUNCTION public.set_kit_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.kit_number := public.next_doc_number('KIT', 'public.seq_kit_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_kit_number BEFORE INSERT ON public.kit_preparation
  FOR EACH ROW EXECUTE FUNCTION public.set_kit_number();

CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,           -- OWNED BY trg_request_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts(id),
  requested_quantity numeric NOT NULL CHECK (requested_quantity > 0),
  issued_quantity numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  requested_by uuid, approved_by uuid, approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.set_request_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.request_number := public.next_doc_number('REQ', 'public.seq_request_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_request_number BEFORE INSERT ON public.material_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_request_number();

-- ---------------------------------------------------------------------------
-- 9. PRODUCTION OUTPUT + QUALITY
-- ---------------------------------------------------------------------------
CREATE TABLE public.hourly_production (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  production_line_id uuid REFERENCES public.production_lines(id),
  hour_slot timestamptz NOT NULL,
  produced_quantity numeric NOT NULL DEFAULT 0,
  rejected_quantity numeric NOT NULL DEFAULT 0,
  manpower integer,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (production_order_id, hour_slot)
);

-- OWNS: production_orders.produced_quantity (SUM of hourly_production)
CREATE OR REPLACE FUNCTION public.recalc_order_produced()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE oid uuid := COALESCE(NEW.production_order_id, OLD.production_order_id);
BEGIN
  UPDATE public.production_orders o
  SET produced_quantity = COALESCE((SELECT SUM(h.produced_quantity) FROM public.hourly_production h
                                    WHERE h.production_order_id = o.id), 0), updated_at = now()
  WHERE o.id = oid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_order_produced
  AFTER INSERT OR UPDATE OR DELETE ON public.hourly_production
  FOR EACH ROW EXECUTE FUNCTION public.recalc_order_produced();

CREATE TABLE public.production_serial_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  serial_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PRODUCED',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pqc_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  inspected_quantity numeric NOT NULL,
  passed_quantity numeric NOT NULL DEFAULT 0,
  failed_quantity numeric NOT NULL DEFAULT 0,
  report_url text,
  status text NOT NULL DEFAULT 'OPEN',
  inspected_by uuid, inspected_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.line_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  part_id uuid REFERENCES public.parts(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  verdict public.rejection_verdict NOT NULL DEFAULT 'FAULTY',
  defect text NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id),
  status text NOT NULL DEFAULT 'OPEN',
  reported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.capa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_number text NOT NULL UNIQUE,              -- OWNED BY trg_capa_number
  source text NOT NULL,
  plant_id uuid REFERENCES public.plants(id),
  vendor_id uuid REFERENCES public.vendors(id),
  part_id uuid REFERENCES public.parts(id),
  grn_item_id uuid REFERENCES public.grn_items(id) ON DELETE SET NULL,
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  line_rejection_id uuid REFERENCES public.line_rejections(id) ON DELETE SET NULL,
  problem_statement text NOT NULL,
  containment_action text, root_cause text, corrective_action text, preventive_action text,
  document_url text,
  status public.capa_status NOT NULL DEFAULT 'OPEN',
  due_date date,
  raised_by uuid, closed_by uuid, closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.set_capa_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.capa_number := public.next_doc_number('CAPA', 'public.seq_capa_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_capa_number BEFORE INSERT ON public.capa
  FOR EACH ROW EXECUTE FUNCTION public.set_capa_number();

CREATE TABLE public.capa_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_id uuid NOT NULL REFERENCES public.capa(id) ON DELETE CASCADE,
  check_date date NOT NULL DEFAULT current_date,
  effective boolean,
  observation text,
  checked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rca_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_id uuid NOT NULL REFERENCES public.capa(id) ON DELETE CASCADE,
  why1 text, why2 text, why3 text, why4 text, why5 text,
  conclusion text, report_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 10. FINISHED GOODS -> DISPATCH -> SPARES
-- ---------------------------------------------------------------------------
CREATE TABLE public.finished_goods_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id),
  part_id uuid NOT NULL REFERENCES public.parts(id),
  quantity_in numeric NOT NULL CHECK (quantity_in > 0),
  quantity_dispatched numeric NOT NULL DEFAULT 0,  -- OWNED BY trg_recalc_fg_dispatched
  quantity_available numeric GENERATED ALWAYS AS (quantity_in - quantity_dispatched) STORED,
  lot_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fg_not_oversold CHECK (quantity_dispatched <= quantity_in)
);

CREATE TABLE public.dispatch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number text NOT NULL UNIQUE,           -- OWNED BY trg_dispatch_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  customer_warehouse_id uuid REFERENCES public.customer_warehouses(id),
  dispatch_date date NOT NULL DEFAULT current_date,
  invoice_number text, vehicle_number text,
  status public.dispatch_status NOT NULL DEFAULT 'DRAFT',
  gate_out_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dispatch_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id uuid NOT NULL REFERENCES public.dispatch_orders(id) ON DELETE CASCADE,
  finished_goods_inventory_id uuid NOT NULL REFERENCES public.finished_goods_inventory(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- OWNS: finished_goods_inventory.quantity_dispatched (SUM of dispatch items)
CREATE OR REPLACE FUNCTION public.recalc_fg_dispatched()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE fid uuid := COALESCE(NEW.finished_goods_inventory_id, OLD.finished_goods_inventory_id);
BEGIN
  UPDATE public.finished_goods_inventory f
  SET quantity_dispatched = COALESCE((SELECT SUM(d.quantity) FROM public.dispatch_order_items d
        JOIN public.dispatch_orders o ON o.id = d.dispatch_order_id
        WHERE d.finished_goods_inventory_id = f.id AND o.status <> 'CANCELLED'), 0),
      updated_at = now()
  WHERE f.id = fid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_fg_dispatched
  AFTER INSERT OR UPDATE OR DELETE ON public.dispatch_order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_fg_dispatched();

CREATE OR REPLACE FUNCTION public.set_dispatch_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.dispatch_number := public.next_doc_number('DO', 'public.seq_dispatch_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_dispatch_number BEFORE INSERT ON public.dispatch_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_dispatch_number();

CREATE TABLE public.spare_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_order_number text NOT NULL UNIQUE,        -- OWNED BY trg_spare_order_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  customer_id uuid REFERENCES public.customers(id),
  order_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'DRAFT',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.spare_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_order_id uuid NOT NULL REFERENCES public.spare_orders(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  issued_quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.set_spare_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.spare_order_number := public.next_doc_number('SPO', 'public.seq_spare_order_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_spare_order_number BEFORE INSERT ON public.spare_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_spare_order_number();

-- ---------------------------------------------------------------------------
-- 11. CUSTOMER COMPLAINTS
-- ---------------------------------------------------------------------------
CREATE TABLE public.customer_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_number text NOT NULL UNIQUE,          -- OWNED BY trg_complaint_number
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  plant_id uuid REFERENCES public.plants(id),
  part_id uuid REFERENCES public.parts(id),
  serial_number text,
  received_date date NOT NULL DEFAULT current_date,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  complaint_details text NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'OPEN',
  resolution text, resolved_at timestamptz,
  capa_id uuid REFERENCES public.capa(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.set_complaint_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.complaint_number := public.next_doc_number('CC', 'public.seq_complaint_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_complaint_number BEFORE INSERT ON public.customer_complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_complaint_number();

CREATE TABLE public.customer_complaint_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.customer_complaints(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  verdict public.rejection_verdict,
  vendor_id uuid REFERENCES public.vendors(id),
  analysis text,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 12. NPD
-- ---------------------------------------------------------------------------
CREATE TABLE public.npd_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL UNIQUE,
  project_name text NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  target_part_id uuid REFERENCES public.parts(id),
  stage public.npd_stage NOT NULL DEFAULT 'CONCEPT',
  target_launch_date date,
  owner_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.npd_bom_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.npd_projects(id) ON DELETE CASCADE,
  part_id uuid REFERENCES public.parts(id),
  proposed_part_code text, description text,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  uom text NOT NULL DEFAULT 'PCS',
  vendor_id uuid REFERENCES public.vendors(id),
  target_price numeric, currency text,
  status text NOT NULL DEFAULT 'DRAFT',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.npd_sample_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.npd_projects(id) ON DELETE CASCADE,
  sample_round integer NOT NULL DEFAULT 1,
  requested_on date, received_on date,
  quantity numeric,
  outcome text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.npd_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.npd_projects(id) ON DELETE CASCADE,
  competitor_brand text, competitor_model text,
  attribute text, competitor_value text, our_value text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 13. updated_at + audit triggers, attached once and uniformly
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'plants','user_accounts','ht_store','parts','vendors','bom','customers','customer_warehouses',
    'production_lines','approval_workflows','stock_balance','stock_holds','projections',
    'production_schedules','production_orders','shortages','purchase_orders','purchase_order_items',
    'import_containers','container_materials','grn','grn_items','kit_preparation','kit_items',
    'kit_returns','material_requests','hourly_production','pqc_reports','line_rejections','capa',
    'rca_reports','finished_goods_inventory','dispatch_orders','spare_orders','customer_complaints',
    'customer_complaint_parts','npd_projects','npd_bom_materials','npd_sample_tracking','npd_benchmarks'])
  LOOP
    EXECUTE format('CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('projections','status'), ('production_schedules','status'), ('production_orders','status'),
      ('purchase_orders','status'), ('shortages','status'), ('grn','status'),
      ('grn_items','iqc_outcome'), ('kit_preparation','status'), ('material_requests','status'),
      ('stock_holds','status'), ('import_containers','current_status'),
      ('capa','status'), ('pqc_reports','status'), ('line_rejections','status'),
      ('dispatch_orders','status'), ('spare_orders','status'), ('approval_workflows','status'),
      ('customer_complaints','status'), ('npd_projects','stage')
    ) AS v(tbl, col)
  LOOP
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
                    FOR EACH ROW EXECUTE FUNCTION public.audit_state_transition(%2$L)', r.tbl, r.col);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 14. GRANTS + RLS — one policy set per table
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'departments','plants','user_accounts','department_permissions','user_departments','user_plants',
    'ht_store','audit_logs','document_counters','parts','part_specifications','part_vendors','bom',
    'vendors','customers','customer_warehouses','production_lines','approval_workflows',
    'stock_locations','stock_ledger','stock_balance','stock_holds','projections',
    'production_schedules','production_orders','shortages','purchase_orders','purchase_order_items',
    'import_containers','container_materials','grn','grn_items','kit_preparation','kit_items',
    'kit_returns','material_requests','hourly_production','production_serial_numbers','pqc_reports',
    'line_rejections','capa','capa_checks','rca_reports','finished_goods_inventory',
    'dispatch_orders','dispatch_order_items','spare_orders','spare_order_items',
    'customer_complaints','customer_complaint_parts','npd_projects','npd_bom_materials',
    'npd_sample_tracking','npd_benchmarks'])
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- masters: read for any active user, write for admin
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['parts','part_specifications','part_vendors','bom','vendors',
      'customers','customer_warehouses','plants','production_lines','departments',
      'department_permissions','stock_locations','approval_workflows'])
  LOOP
    EXECUTE format('CREATE POLICY %1$s_read ON public.%1$I FOR SELECT TO authenticated USING (public.has_role(NULL))', t);
    EXECUTE format('CREATE POLICY %1$s_write ON public.%1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

CREATE POLICY user_accounts_self_read ON public.user_accounts
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY user_accounts_admin_write ON public.user_accounts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE SELECT (role) ON public.user_accounts FROM authenticated;

CREATE POLICY user_departments_read ON public.user_departments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY user_departments_admin_write ON public.user_departments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY user_plants_read ON public.user_plants
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY user_plants_admin_write ON public.user_plants
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY ht_store_own ON public.ht_store
  FOR ALL TO authenticated USING (account_key = auth.uid()::text) WITH CHECK (account_key = auth.uid()::text);

-- plant-scoped operational tables
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('production_schedules','planning'), ('production_orders','production'),
      ('purchase_orders','purchase'), ('shortages','purchase'),
      ('grn','store'), ('kit_preparation','store'), ('material_requests','store'),
      ('stock_holds','store'), ('kit_returns','store'),
      ('pqc_reports','quality'), ('line_rejections','quality'),
      ('finished_goods_inventory','store'), ('dispatch_orders','sales'), ('spare_orders','sales')
    ) AS v(tbl, module)
  LOOP
    EXECUTE format('CREATE POLICY %1$s_read ON public.%1$I FOR SELECT TO authenticated
       USING (public.in_plant(plant_id))', r.tbl);
    EXECUTE format('CREATE POLICY %1$s_write ON public.%1$I FOR ALL TO authenticated
       USING (public.in_plant(plant_id) AND public.has_role(%2$L))
       WITH CHECK (public.in_plant(plant_id) AND public.has_role(%2$L))', r.tbl, r.module);
  END LOOP;
END $$;

-- derived / append-only stock: read only, writes go through post_stock_movements()
CREATE POLICY stock_balance_read ON public.stock_balance FOR SELECT TO authenticated USING (public.in_plant(plant_id));
REVOKE INSERT, UPDATE, DELETE ON public.stock_balance FROM authenticated;
CREATE POLICY stock_ledger_read ON public.stock_ledger FOR SELECT TO authenticated USING (public.in_plant(plant_id));
REVOKE INSERT, UPDATE, DELETE ON public.stock_ledger FROM authenticated;
REVOKE ALL ON public.document_counters FROM authenticated;

-- child tables inherit the parent's visibility
CREATE POLICY purchase_order_items_read ON public.purchase_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_id AND public.in_plant(p.plant_id)));
CREATE POLICY purchase_order_items_write ON public.purchase_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_id AND public.in_plant(p.plant_id)) AND public.has_role('purchase'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_id AND public.in_plant(p.plant_id)) AND public.has_role('purchase'));

CREATE POLICY grn_items_read ON public.grn_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.grn g WHERE g.id = grn_id AND public.in_plant(g.plant_id)));
CREATE POLICY grn_items_write ON public.grn_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.grn g WHERE g.id = grn_id AND public.in_plant(g.plant_id)) AND (public.has_role('store') OR public.has_role('quality')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.grn g WHERE g.id = grn_id AND public.in_plant(g.plant_id)) AND (public.has_role('store') OR public.has_role('quality')));

CREATE POLICY kit_items_read ON public.kit_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kit_preparation k WHERE k.id = kit_preparation_id AND public.in_plant(k.plant_id)));
CREATE POLICY kit_items_write ON public.kit_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kit_preparation k WHERE k.id = kit_preparation_id AND public.in_plant(k.plant_id)) AND public.has_role('store'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kit_preparation k WHERE k.id = kit_preparation_id AND public.in_plant(k.plant_id)) AND public.has_role('store'));

CREATE POLICY dispatch_order_items_read ON public.dispatch_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dispatch_orders d WHERE d.id = dispatch_order_id AND public.in_plant(d.plant_id)));
CREATE POLICY dispatch_order_items_write ON public.dispatch_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dispatch_orders d WHERE d.id = dispatch_order_id AND public.in_plant(d.plant_id)) AND public.has_role('sales'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.dispatch_orders d WHERE d.id = dispatch_order_id AND public.in_plant(d.plant_id)) AND public.has_role('sales'));

CREATE POLICY spare_order_items_read ON public.spare_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.spare_orders s WHERE s.id = spare_order_id AND public.in_plant(s.plant_id)));
CREATE POLICY spare_order_items_write ON public.spare_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.spare_orders s WHERE s.id = spare_order_id AND public.in_plant(s.plant_id)) AND public.has_role('sales'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.spare_orders s WHERE s.id = spare_order_id AND public.in_plant(s.plant_id)) AND public.has_role('sales'));

CREATE POLICY production_serials_read ON public.production_serial_numbers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_orders o WHERE o.id = production_order_id AND public.in_plant(o.plant_id)));
CREATE POLICY production_serials_write ON public.production_serial_numbers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_orders o WHERE o.id = production_order_id AND public.in_plant(o.plant_id)) AND public.has_role('production'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.production_orders o WHERE o.id = production_order_id AND public.in_plant(o.plant_id)) AND public.has_role('production'));

CREATE POLICY hourly_production_read ON public.hourly_production FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_orders o WHERE o.id = production_order_id AND public.in_plant(o.plant_id)));
CREATE POLICY hourly_production_write ON public.hourly_production FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_orders o WHERE o.id = production_order_id AND public.in_plant(o.plant_id)) AND public.has_role('production'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.production_orders o WHERE o.id = production_order_id AND public.in_plant(o.plant_id)) AND public.has_role('production'));

-- company-wide operational tables
CREATE POLICY projections_read ON public.projections FOR SELECT TO authenticated USING (public.has_role(NULL));
CREATE POLICY projections_write ON public.projections FOR ALL TO authenticated
  USING (public.has_role('planning')) WITH CHECK (public.has_role('planning'));
CREATE POLICY import_containers_read ON public.import_containers FOR SELECT TO authenticated USING (public.has_role(NULL));
CREATE POLICY import_containers_write ON public.import_containers FOR ALL TO authenticated
  USING (public.has_role('purchase')) WITH CHECK (public.has_role('purchase'));
CREATE POLICY container_materials_read ON public.container_materials FOR SELECT TO authenticated USING (public.has_role(NULL));
CREATE POLICY container_materials_write ON public.container_materials FOR ALL TO authenticated
  USING (public.has_role('purchase')) WITH CHECK (public.has_role('purchase'));
CREATE POLICY capa_read ON public.capa FOR SELECT TO authenticated USING (public.has_role(NULL));
CREATE POLICY capa_write ON public.capa FOR ALL TO authenticated
  USING (public.has_role('quality')) WITH CHECK (public.has_role('quality'));
CREATE POLICY capa_checks_read ON public.capa_checks FOR SELECT TO authenticated USING (public.has_role(NULL));
CREATE POLICY capa_checks_write ON public.capa_checks FOR ALL TO authenticated
  USING (public.has_role('quality')) WITH CHECK (public.has_role('quality'));
CREATE POLICY rca_read ON public.rca_reports FOR SELECT TO authenticated USING (public.has_role(NULL));
CREATE POLICY rca_write ON public.rca_reports FOR ALL TO authenticated
  USING (public.has_role('quality')) WITH CHECK (public.has_role('quality'));
CREATE POLICY complaints_read ON public.customer_complaints FOR SELECT TO authenticated USING (public.has_role(NULL));
CREATE POLICY complaints_write ON public.customer_complaints FOR ALL TO authenticated
  USING (public.has_role('quality')) WITH CHECK (public.has_role('quality'));
CREATE POLICY complaint_parts_read ON public.customer_complaint_parts FOR SELECT TO authenticated USING (public.has_role(NULL));
CREATE POLICY complaint_parts_write ON public.customer_complaint_parts FOR ALL TO authenticated
  USING (public.has_role('quality')) WITH CHECK (public.has_role('quality'));

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['npd_projects','npd_bom_materials','npd_sample_tracking','npd_benchmarks'])
  LOOP
    EXECUTE format('CREATE POLICY %1$s_read ON public.%1$I FOR SELECT TO authenticated USING (public.has_role(NULL))', t);
    EXECUTE format('CREATE POLICY %1$s_write ON public.%1$I FOR ALL TO authenticated USING (public.has_role(%2$L)) WITH CHECK (public.has_role(%2$L))', t, 'rnd');
  END LOOP;
END $$;

CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;

-- function grants
REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.in_plant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_stock_movements(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_stock_movement(uuid,uuid,uuid,numeric,text,text,text,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_po_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(text), public.is_admin(), public.in_plant(uuid),
  public.post_stock_movements(jsonb),
  public.post_stock_movement(uuid,uuid,uuid,numeric,text,text,text,uuid,text,text) TO authenticated;