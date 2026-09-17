-- ============================================================================
-- GRAMMY ERP — CLEAN BASELINE SCHEMA (PROPOSAL, NOT APPLIED)
-- File location is deliberately supabase/migrations_proposed/ so nothing runs.
--
-- Scope: masters (structure identical to today so backup/masters/*.json restores
-- cleanly) + the operational spine.
-- Explicitly OUT of scope and NOT touched: all 22 dash_* tables, all HR tables
-- (employees, skills, training_programs, employee_skills, employee_training,
-- attendance, payroll, performance_reviews), storage buckets, auth users.
--
-- Design rules enforced here:
--   R1 one writer per fact — every derived column names its owning trigger
--   R2 every derived total is recomputed as a SUM, never incremented
--   R3 one stock mechanism: stock_ledger (append-only) -> stock_balance
--       (derived, non-negative). NO inventory table. NO material_movements table.
--   R4 stock_holds = a voucher's dated claim on a material; released on issue
--       or cancellation
--   R5 real foreign keys on every handoff
--   R6 planned date beside every actual on import_containers
--   R7 one promised delivery field on purchase_orders
--   R8 grn carries invoice_number + invoice_quantity
--   R9 document numbers come from database sequences, never the client
--   R10 RLS written once per table via public.has_role()
--   R11 audit_logs written by trigger on every state transition
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE public.bom_type AS ENUM ('MAIN', 'SUB_ASSEMBLY', 'PACKING');
CREATE TYPE public.production_line_type AS ENUM ('LINE', 'SUB_ASSEMBLY');
CREATE TYPE public.stock_location_type AS ENUM ('STORE', 'QUARANTINE', 'REJECT');
CREATE TYPE public.po_status AS ENUM ('DRAFT','PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED');
CREATE TYPE public.grn_status AS ENUM ('DRAFT','IQC_PENDING','IQC_DONE','STORE_CONFIRMED','CLOSED');
CREATE TYPE public.iqc_outcome AS ENUM ('PENDING','ACCEPTED','REJECTED','PARTIAL');
CREATE TYPE public.schedule_status AS ENUM ('PLANNED','KIT_PREPARED','KIT_SENT','IN_PRODUCTION','COMPLETED','CANCELLED');
CREATE TYPE public.hold_status AS ENUM ('ACTIVE','ISSUED','RELEASED');
CREATE TYPE public.hold_source AS ENUM ('VOUCHER','SPARE','DASH','SAMPLE','REWORK');
CREATE TYPE public.capa_status AS ENUM ('OPEN','SUBMITTED','ACCEPTED','REJECTED','CLOSED');
CREATE TYPE public.container_status AS ENUM ('ORDERED','LOADED','SHIPPED','IN_TRANSIT','INDIA_CUSTOM','ARRIVED','AT_FACTORY');
CREATE TYPE public.dispatch_status AS ENUM ('DRAFT','PACKED','GATE_OUT','DELIVERED','CANCELLED');

-- ---------------------------------------------------------------------------
-- 1. ROLE / ACCESS HELPERS  (R10 — the single source of truth for RLS)
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
  id uuid PRIMARY KEY,                       -- equals auth.users.id, no FK (managed schema)
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password_hash text,                        -- vestigial; auth owns credentials
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

-- The ONE access helper. Everything else calls this.
-- role = 'admin' passes every check. Otherwise the named module must be granted
-- to one of the user's departments.
CREATE OR REPLACE FUNCTION public.has_role(_module text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_accounts ua
    WHERE ua.id = auth.uid() AND ua.is_active
      AND (
        ua.role = 'admin'
        OR _module IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.user_departments ud
          JOIN public.department_permissions dp ON dp.department_id = ud.department_id
          WHERE ud.user_id = ua.id AND dp.tab_name = _module
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_accounts
                 WHERE id = auth.uid() AND is_active AND role = 'admin');
$$;

-- Plant scoping for operational data.
CREATE OR REPLACE FUNCTION public.in_plant(_plant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_admin()
      OR EXISTS (SELECT 1 FROM public.user_plants
                 WHERE user_id = auth.uid() AND plant_id = _plant_id);
$$;

REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.in_plant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(text), public.is_admin(), public.in_plant(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. SHARED PLUMBING
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
-- OWNS: updated_at on every table that has it. Nothing else writes updated_at.

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,                      -- INSERT | STATUS_CHANGE | DELETE
  from_status text,
  to_status text,
  old_values jsonb,
  new_values jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_logs (table_name, record_id, created_at DESC);

-- R11: one generic transition auditor, attached to every table with a status column.
-- Expects TG_ARGV[0] = name of the status column.
CREATE OR REPLACE FUNCTION public.audit_state_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  col text := TG_ARGV[0];
  old_s text; new_s text;
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

-- R9: document numbers from sequences. One sequence per document family.
CREATE SEQUENCE public.seq_po_number;
CREATE SEQUENCE public.seq_grn_number;
CREATE SEQUENCE public.seq_voucher_number;
CREATE SEQUENCE public.seq_kit_number;
CREATE SEQUENCE public.seq_request_number;
CREATE SEQUENCE public.seq_dispatch_number;
CREATE SEQUENCE public.seq_spare_order_number;
CREATE SEQUENCE public.seq_capa_number;

CREATE OR REPLACE FUNCTION public.next_doc_number(_prefix text, _seq regclass)
RETURNS text LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT _prefix || '-' || to_char(now(), 'YYYYMM') || '-' ||
         lpad(nextval(_seq)::text, 5, '0');
$$;

-- ---------------------------------------------------------------------------
-- 3. MASTERS (structure preserved so backup/masters/*.json restores as-is)
-- ---------------------------------------------------------------------------
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  specifications text,
  is_active boolean NOT NULL DEFAULT true,
  bom_url text, wi_url text, pqc_checklist_url text,
  oqc_checklist_url text, ccl_url text, crs_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  specification text,
  is_active boolean NOT NULL DEFAULT true,
  specification_sheet_url text,
  iqc_checklist_url text,
  sourcing_type text,                        -- DOMESTIC | IMPORTED
  currency text, unit_price numeric, cbm_per_unit numeric,
  supplier_country text, last_price_update timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code text NOT NULL UNIQUE,
  name text NOT NULL,
  email text, contact_number text, address text,
  gst_number text NOT NULL,
  contact_person_name text,
  bank_account_number text, ifsc_code text,
  gst_certificate_url text, msme_certificate_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL, contact_number text NOT NULL, address text NOT NULL,
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

CREATE TABLE public.bom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  bom_type public.bom_type NOT NULL DEFAULT 'MAIN',
  quantity integer NOT NULL CHECK (quantity > 0),
  is_critical boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, raw_material_id, bom_type)
);

CREATE TABLE public.bom_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  change_reason text NOT NULL,
  bom_data jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version_number)
);

CREATE TABLE public.raw_material_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_material_id, vendor_id)
);

CREATE TABLE public.raw_material_specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  specification_sheet_url text,
  iqc_checklist_url text,
  changes_description text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_material_id, version_number)
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

CREATE TABLE public.ht_store (
  account_key text NOT NULL,
  store_key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_key, store_key)
);

-- ---------------------------------------------------------------------------
-- 4. STOCK — the one mechanism (R3)
-- ---------------------------------------------------------------------------
CREATE TABLE public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  code text NOT NULL,                        -- MAIN | QUAR | REJECT
  name text NOT NULL,
  location_type public.stock_location_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, code)
);

CREATE TABLE public.stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  location_id uuid NOT NULL REFERENCES public.stock_locations(id),
  qty_delta numeric NOT NULL CHECK (qty_delta <> 0),
  balance_after numeric NOT NULL,
  movement_type text NOT NULL,               -- RECEIPT | IQC_ACCEPT | IQC_REJECT | ISSUE | RETURN | ADJUST | TRANSFER
  reason_code text,
  reference_type text, reference_id uuid, reference_number text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_ledger (plant_id, raw_material_id, location_id, created_at DESC);
CREATE INDEX ON public.stock_ledger (reference_type, reference_id);
-- append-only: no UPDATE, no DELETE, ever
CREATE OR REPLACE FUNCTION public.stock_ledger_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'stock_ledger is append-only'; END; $$;
CREATE TRIGGER trg_stock_ledger_append_only
  BEFORE UPDATE OR DELETE ON public.stock_ledger
  FOR EACH ROW EXECUTE FUNCTION public.stock_ledger_append_only();

CREATE TABLE public.stock_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  location_id uuid NOT NULL REFERENCES public.stock_locations(id),
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_stock numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, raw_material_id, location_id)
);

-- OWNS stock_balance.quantity — recomputed as the SUM of the ledger (R1, R2).
CREATE OR REPLACE FUNCTION public.recalc_stock_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE total numeric;
BEGIN
  SELECT COALESCE(SUM(qty_delta), 0) INTO total
  FROM public.stock_ledger
  WHERE plant_id = NEW.plant_id AND raw_material_id = NEW.raw_material_id
    AND location_id = NEW.location_id;

  INSERT INTO public.stock_balance (plant_id, raw_material_id, location_id, quantity, updated_at)
  VALUES (NEW.plant_id, NEW.raw_material_id, NEW.location_id, total, now())
  ON CONFLICT (plant_id, raw_material_id, location_id)
  DO UPDATE SET quantity = total, updated_at = now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_recalc_stock_balance
  AFTER INSERT ON public.stock_ledger
  FOR EACH ROW EXECUTE FUNCTION public.recalc_stock_balance();

-- The ONLY write path into stock. Direct writes are blocked by RLS below.
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

    SELECT COALESCE(SUM(qty_delta), 0) INTO running
    FROM public.stock_ledger
    WHERE plant_id = (m->>'plant_id')::uuid
      AND raw_material_id = (m->>'raw_material_id')::uuid
      AND location_id = (m->>'location_id')::uuid
    FOR UPDATE;

    running := running + (m->>'qty_delta')::numeric;
    IF running < 0 THEN
      RAISE EXCEPTION 'Insufficient stock: movement would take balance to %', running;
    END IF;

    INSERT INTO public.stock_ledger (plant_id, raw_material_id, location_id, qty_delta,
      balance_after, movement_type, reason_code, reference_type, reference_id,
      reference_number, notes)
    VALUES ((m->>'plant_id')::uuid, (m->>'raw_material_id')::uuid, (m->>'location_id')::uuid,
      (m->>'qty_delta')::numeric, running, m->>'movement_type', m->>'reason_code',
      m->>'reference_type', NULLIF(m->>'reference_id','')::uuid, m->>'reference_number', m->>'notes')
    RETURNING id INTO new_id;
    out_ids := out_ids || new_id;
  END LOOP;

  RETURN jsonb_build_object('posted', array_length(out_ids, 1), 'ids', to_jsonb(out_ids));
END; $$;

-- R4: stock_holds — a dated claim on material. Created with the voucher,
-- released on issue or cancellation. Only voucher/spare/DASH/sample/rework
-- demand may create a hold.
CREATE TABLE public.stock_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  location_id uuid NOT NULL REFERENCES public.stock_locations(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  needed_on date NOT NULL,
  source public.hold_source NOT NULL,
  production_order_id uuid,                  -- FK added after production_orders
  reference_type text, reference_id uuid,
  status public.hold_status NOT NULL DEFAULT 'ACTIVE',
  released_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hold_voucher_needs_order CHECK (source <> 'VOUCHER' OR production_order_id IS NOT NULL)
);
CREATE INDEX ON public.stock_holds (plant_id, raw_material_id, status, needed_on);

-- ---------------------------------------------------------------------------
-- 5. DEMAND — projections, schedules, vouchers
-- ---------------------------------------------------------------------------
CREATE TABLE public.projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  month date NOT NULL,                       -- first day of the projected month
  quantity numeric NOT NULL CHECK (quantity > 0),
  scheduled_quantity numeric NOT NULL DEFAULT 0,   -- OWNED BY trg_recalc_projection_totals
  vouchered_quantity numeric NOT NULL DEFAULT 0,   -- OWNED BY trg_recalc_projection_totals
  produced_quantity numeric NOT NULL DEFAULT 0,    -- OWNED BY trg_recalc_projection_totals
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
  product_id uuid NOT NULL REFERENCES public.products(id),
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
  voucher_number text NOT NULL UNIQUE,       -- OWNED BY trg_production_orders_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  production_schedule_id uuid NOT NULL REFERENCES public.production_schedules(id) ON DELETE CASCADE,
  projection_id uuid NOT NULL REFERENCES public.projections(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  production_line_id uuid REFERENCES public.production_lines(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  produced_quantity numeric NOT NULL DEFAULT 0,  -- OWNED BY trg_recalc_order_produced
  status public.schedule_status NOT NULL DEFAULT 'PLANNED',
  planned_date date NOT NULL,
  started_at timestamptz, completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_holds
  ADD CONSTRAINT stock_holds_production_order_fkey
  FOREIGN KEY (production_order_id) REFERENCES public.production_orders(id) ON DELETE CASCADE;

-- OWNS production_orders.voucher_number (R9)
CREATE OR REPLACE FUNCTION public.set_voucher_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.voucher_number := public.next_doc_number('PV', 'public.seq_voucher_number');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_production_orders_number
  BEFORE INSERT ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_voucher_number();

-- OWNS projections.scheduled_quantity / vouchered_quantity / produced_quantity.
-- Recomputed as SUMs (R2). Fired from schedules and from orders.
CREATE OR REPLACE FUNCTION public.recalc_projection_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid := COALESCE(NEW.projection_id, OLD.projection_id);
BEGIN
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

-- Lifecycle lock: editable/deletable only before the kit leaves the store.
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
-- 6. SHORTAGES -> PURCHASE -> IMPORT -> GRN
-- ---------------------------------------------------------------------------
CREATE TABLE public.shortages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE CASCADE,
  production_schedule_id uuid REFERENCES public.production_schedules(id) ON DELETE CASCADE,
  required_quantity numeric NOT NULL CHECK (required_quantity > 0),
  available_quantity numeric NOT NULL DEFAULT 0,
  shortage_quantity numeric NOT NULL CHECK (shortage_quantity > 0),
  needed_on date NOT NULL,
  purchase_order_item_id uuid,                -- FK added after purchase_order_items (R5)
  status text NOT NULL DEFAULT 'OPEN',        -- OPEN | ORDERED | CLOSED
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,             -- OWNED BY trg_purchase_orders_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  projection_id uuid REFERENCES public.projections(id),   -- R5 demand origin
  is_import boolean NOT NULL DEFAULT false,                -- R7
  origin_country text,                                     -- R7
  promised_loading_date date,                              -- R7
  promised_delivery_date date,                             -- R7 (the ONE field)
  po_date date NOT NULL DEFAULT current_date,
  status public.po_status NOT NULL DEFAULT 'DRAFT',
  currency text NOT NULL DEFAULT 'INR',
  total_amount numeric NOT NULL DEFAULT 0,                 -- OWNED BY trg_recalc_po_total
  notes text,
  created_by uuid,
  approved_by uuid, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  received_quantity numeric NOT NULL DEFAULT 0,            -- OWNED BY trg_recalc_po_item_received
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shortages
  ADD CONSTRAINT shortages_po_item_fkey
  FOREIGN KEY (purchase_order_item_id) REFERENCES public.purchase_order_items(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_po_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.po_number := public.next_doc_number('PO', 'public.seq_po_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_purchase_orders_number BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_po_number();

-- OWNS purchase_orders.total_amount (SUM of items)
CREATE OR REPLACE FUNCTION public.recalc_po_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE poid uuid := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
BEGIN
  UPDATE public.purchase_orders po
  SET total_amount = COALESCE((SELECT SUM(i.line_total) FROM public.purchase_order_items i
                               WHERE i.purchase_order_id = po.id), 0),
      updated_at = now()
  WHERE po.id = poid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_po_total
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_po_total();

CREATE TABLE public.import_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_number text NOT NULL UNIQUE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id),   -- R5
  current_status public.container_status NOT NULL DEFAULT 'ORDERED',
  vessel_name text, supplier_info text, notes text,
  ordered_date date,
  -- R6: planned beside every actual
  planned_loaded date,  loaded_date date,
  planned_shipped date, shipped_date date,
  planned_arrived date, indian_dock_date date, arrived_date date,
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
  raw_material_id uuid REFERENCES public.raw_materials(id),
  brand text, model text, material_description text,
  quantity numeric NOT NULL CHECK (quantity > 0),
  cbm_occupied numeric,
  unit_cost_allocation numeric,               -- OWNED BY trg_allocate_container_cost
  status text NOT NULL DEFAULT 'PENDING',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- OWNS container_materials.unit_cost_allocation — CBM-proportional, recomputed
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
  SET unit_cost_allocation = CASE
        WHEN total_cbm IS NULL OR cm.quantity = 0 THEN NULL
        ELSE (total_cost * COALESCE(cm.cbm_occupied,0) / total_cbm) / cm.quantity END,
      updated_at = now()
  WHERE cm.container_id = cid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_allocate_container_cost
  AFTER INSERT OR UPDATE OF quantity, cbm_occupied OR DELETE ON public.container_materials
  FOR EACH ROW EXECUTE FUNCTION public.allocate_container_cost();

CREATE TABLE public.grn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text NOT NULL UNIQUE,            -- OWNED BY trg_grn_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),   -- R5
  import_container_id uuid REFERENCES public.import_containers(id),
  invoice_number text,                        -- R8
  invoice_quantity numeric,                   -- R8
  invoice_date date,
  received_date date NOT NULL DEFAULT current_date,
  status public.grn_status NOT NULL DEFAULT 'DRAFT',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.grn_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.grn(id) ON DELETE CASCADE,
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
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

CREATE OR REPLACE FUNCTION public.set_grn_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.grn_number := public.next_doc_number('GRN', 'public.seq_grn_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_grn_number BEFORE INSERT ON public.grn
  FOR EACH ROW EXECUTE FUNCTION public.set_grn_number();

-- OWNS purchase_order_items.received_quantity (SUM of grn_items)
CREATE OR REPLACE FUNCTION public.recalc_po_item_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE iid uuid := COALESCE(NEW.purchase_order_item_id, OLD.purchase_order_item_id);
BEGIN
  IF iid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.purchase_order_items i
  SET received_quantity = COALESCE((SELECT SUM(g.received_quantity) FROM public.grn_items g
                                    WHERE g.purchase_order_item_id = i.id), 0),
      updated_at = now()
  WHERE i.id = iid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_po_item_received
  AFTER INSERT OR UPDATE OF received_quantity OR DELETE ON public.grn_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_po_item_received();

-- OWNS grn.status (derived from its items only)
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
-- 7. STORE ISSUE — kits and material requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.kit_preparation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_number text NOT NULL UNIQUE,            -- OWNED BY trg_kit_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PREPARING',   -- PREPARING | READY | SENT | RECEIVED
  prepared_by uuid, sent_at timestamptz, received_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_preparation_id uuid NOT NULL REFERENCES public.kit_preparation(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  required_quantity numeric NOT NULL CHECK (required_quantity > 0),
  issued_quantity numeric NOT NULL DEFAULT 0,
  received_quantity numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_kit_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.kit_number := public.next_doc_number('KIT', 'public.seq_kit_number'); RETURN NEW; END; $$;
CREATE TRIGGER trg_kit_number BEFORE INSERT ON public.kit_preparation
  FOR EACH ROW EXECUTE FUNCTION public.set_kit_number();

CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,        -- OWNED BY trg_request_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  requested_quantity numeric NOT NULL CHECK (requested_quantity > 0),
  issued_quantity numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,                       -- SHORT_MATERIAL | DAMAGED_MATERIAL | EXTRA
  status text NOT NULL DEFAULT 'PENDING',     -- PENDING | APPROVED | ISSUED | REJECTED
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
-- 8. PRODUCTION OUTPUT + QUALITY
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

-- OWNS production_orders.produced_quantity (SUM of hourly_production)
CREATE OR REPLACE FUNCTION public.recalc_order_produced()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE oid uuid := COALESCE(NEW.production_order_id, OLD.production_order_id);
BEGIN
  UPDATE public.production_orders o
  SET produced_quantity = COALESCE((SELECT SUM(h.produced_quantity) FROM public.hourly_production h
                                    WHERE h.production_order_id = o.id), 0),
      updated_at = now()
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
  raw_material_id uuid REFERENCES public.raw_materials(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  defect text NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id),
  status text NOT NULL DEFAULT 'OPEN',
  reported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CAPA: one table, one discriminator, instead of five near-identical ones.
CREATE TABLE public.capa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_number text NOT NULL UNIQUE,           -- OWNED BY trg_capa_number
  source text NOT NULL,                       -- IQC | PRODUCTION | VENDOR | COMPLAINT
  plant_id uuid REFERENCES public.plants(id), -- NULL = company-wide (vendor CAPA)
  vendor_id uuid REFERENCES public.vendors(id),
  raw_material_id uuid REFERENCES public.raw_materials(id),
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
  conclusion text,
  report_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 9. FINISHED GOODS -> DISPATCH -> SPARES
-- ---------------------------------------------------------------------------
CREATE TABLE public.finished_goods_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id),  -- R5
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity_in numeric NOT NULL CHECK (quantity_in > 0),
  quantity_dispatched numeric NOT NULL DEFAULT 0,      -- OWNED BY trg_recalc_fg_dispatched
  quantity_available numeric GENERATED ALWAYS AS (quantity_in - quantity_dispatched) STORED,
  lot_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fg_not_oversold CHECK (quantity_dispatched <= quantity_in)
);

CREATE TABLE public.dispatch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number text NOT NULL UNIQUE,       -- OWNED BY trg_dispatch_number
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  customer_warehouse_id uuid REFERENCES public.customer_warehouses(id),
  dispatch_date date NOT NULL DEFAULT current_date,
  invoice_number text,
  vehicle_number text,
  status public.dispatch_status NOT NULL DEFAULT 'DRAFT',
  gate_out_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dispatch_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id uuid NOT NULL REFERENCES public.dispatch_orders(id) ON DELETE CASCADE,
  finished_goods_inventory_id uuid NOT NULL REFERENCES public.finished_goods_inventory(id),  -- R5
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- OWNS finished_goods_inventory.quantity_dispatched (SUM of dispatch items)
CREATE OR REPLACE FUNCTION public.recalc_fg_dispatched()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE fid uuid := COALESCE(NEW.finished_goods_inventory_id, OLD.finished_goods_inventory_id);
BEGIN
  UPDATE public.finished_goods_inventory f
  SET quantity_dispatched = COALESCE((
        SELECT SUM(d.quantity) FROM public.dispatch_order_items d
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
  spare_order_number text NOT NULL UNIQUE,    -- OWNED BY trg_spare_order_number
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
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
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
-- 10. updated_at + audit triggers (attached once, uniformly)
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'updated_at'
           WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;

-- R11: audit every state transition on the tables that carry a status.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('projections','status'), ('production_schedules','status'), ('production_orders','status'),
      ('purchase_orders','status'), ('shortages','status'), ('grn','status'),
      ('grn_items','iqc_outcome'), ('kit_preparation','status'), ('material_requests','status'),
      ('stock_holds','status'), ('import_containers','current_status'),
      ('capa','status'), ('pqc_reports','status'), ('line_rejections','status'),
      ('dispatch_orders','status'), ('spare_orders','status'), ('approval_workflows','status')
    ) AS v(tbl, col)
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
       FOR EACH ROW EXECUTE FUNCTION public.audit_state_transition(%2$L)', r.tbl, r.col);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 11. GRANTS + RLS — exactly one policy set per table (R10)
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
-- anon gets nothing: every screen is behind sign-in.

-- 11a. Masters and access tables: read for any active user, write for admin.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['products','raw_materials','vendors','customers',
      'customer_warehouses','bom','bom_versions','raw_material_vendors',
      'raw_material_specifications','plants','production_lines','departments',
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
REVOKE SELECT (role) ON public.user_accounts FROM authenticated;  -- role read via RPC only

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

-- 11b. Plant-scoped operational tables: read own plants, write with the module.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('production_schedules','planning'), ('production_orders','production'),
      ('purchase_orders','purchase'), ('shortages','purchase'),
      ('grn','store'), ('kit_preparation','store'), ('material_requests','store'),
      ('stock_holds','store'), ('hourly_production','production'),
      ('pqc_reports','quality'), ('line_rejections','quality'),
      ('finished_goods_inventory','store'), ('dispatch_orders','sales'),
      ('spare_orders','sales'), ('stock_balance','store')
    ) AS v(tbl, module)
  LOOP
    EXECUTE format(
      'CREATE POLICY %1$s_read ON public.%1$I FOR SELECT TO authenticated
         USING (public.in_plant(plant_id))', r.tbl);
    EXECUTE format(
      'CREATE POLICY %1$s_write ON public.%1$I FOR ALL TO authenticated
         USING (public.in_plant(plant_id) AND public.has_role(%2$L))
         WITH CHECK (public.in_plant(plant_id) AND public.has_role(%2$L))', r.tbl, r.module);
  END LOOP;
END $$;

-- stock_balance and stock_ledger are derived / append-only: no direct writes at all.
DROP POLICY stock_balance_write ON public.stock_balance;
REVOKE INSERT, UPDATE, DELETE ON public.stock_balance FROM authenticated;
CREATE POLICY stock_ledger_read ON public.stock_ledger
  FOR SELECT TO authenticated USING (public.in_plant(plant_id));
REVOKE INSERT, UPDATE, DELETE ON public.stock_ledger FROM authenticated;
-- writes go only through public.post_stock_movements()
REVOKE ALL ON FUNCTION public.post_stock_movements(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_stock_movements(jsonb) TO authenticated;

-- 11c. Child tables inherit their parent's visibility.
CREATE POLICY purchase_order_items_read ON public.purchase_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_id AND public.in_plant(p.plant_id)));
CREATE POLICY purchase_order_items_write ON public.purchase_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_id AND public.in_plant(p.plant_id)) AND public.has_role('purchase'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_id AND public.in_plant(p.plant_id)) AND public.has_role('purchase'));

CREATE POLICY grn_items_read ON public.grn_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.grn g WHERE g.id = grn_id AND public.in_plant(g.plant_id)));
CREATE POLICY grn_items_write ON public.grn_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.grn g WHERE g.id = grn_id AND public.in_plant(g.plant_id))
         AND (public.has_role('store') OR public.has_role('quality')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.grn g WHERE g.id = grn_id AND public.in_plant(g.plant_id))
         AND (public.has_role('store') OR public.has_role('quality')));

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

-- 11d. Company-wide (not plant-scoped) operational tables.
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

-- audit_logs: readable by admin only, written by trigger (SECURITY DEFINER).
CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;

COMMIT;
