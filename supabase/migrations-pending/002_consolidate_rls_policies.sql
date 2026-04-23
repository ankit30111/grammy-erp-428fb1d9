-- ============================================================================
-- Migration 002: Consolidate RLS Policies (replaces 134 always-true policies)
-- ----------------------------------------------------------------------------
-- Purpose
--   1. Rename department `Purchase` → `PPC`, drop `Planning` (folded into PPC).
--   2. Update the seeded department_permissions matrix accordingly.
--   3. Drop EVERY existing policy on the 90 public tables.
--   4. Recreate ONE consolidated set of policies per table using the helpers
--      from migration 001 (auth_is_admin, auth_user_can_access_module).
--   5. For sensitive tables (user_accounts, audit_logs, payroll, departments,
--      department_permissions, user_departments) writes are Admin-only.
--
-- Effect on advisors:
--   - rls_policy_always_true:        134 → 0
--   - multiple_permissive_policies:  151 → 0
--   - auth_rls_initplan:              72 → 0   (new policies use (SELECT auth.uid()))
--
-- Safety
--   All public tables currently have 0 rows, so policy changes are not
--   user-visible. RLS remains ENABLED on every table throughout. The
--   helper function _apply_standard_module_policies(...) is idempotent.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Part A — Department restructure: Purchase → PPC, drop Planning
-- ---------------------------------------------------------------------------

UPDATE public.departments
SET    name = 'PPC',
       description = 'Production Planning & Control — owns purchase, planning, production, store, imports, approvals'
WHERE  name = 'Purchase';

-- Move any users in Planning to PPC, then drop Planning
DO $migrate$
DECLARE
  ppc_id      uuid := (SELECT id FROM public.departments WHERE name = 'PPC');
  plan_id     uuid := (SELECT id FROM public.departments WHERE name = 'Planning');
BEGIN
  IF plan_id IS NOT NULL AND ppc_id IS NOT NULL THEN
    -- Move user assignments
    INSERT INTO public.user_departments (user_id, department_id)
    SELECT user_id, ppc_id FROM public.user_departments WHERE department_id = plan_id
    ON CONFLICT DO NOTHING;
    DELETE FROM public.user_departments WHERE department_id = plan_id;
    -- Move any user_accounts.department_id pointing at Planning
    UPDATE public.user_accounts SET department_id = ppc_id WHERE department_id = plan_id;
    -- Drop Planning's old permissions and the dept itself
    DELETE FROM public.department_permissions WHERE department_id = plan_id;
    DELETE FROM public.departments WHERE id = plan_id;
  END IF;
END $migrate$;

-- Reseed PPC's permission matrix to its full module set
DO $reseed$
DECLARE
  ppc_id uuid := (SELECT id FROM public.departments WHERE name = 'PPC');
  modules text[] := ARRAY['purchase','planning','production','store','imports','approvals','core'];
  m text;
BEGIN
  IF ppc_id IS NOT NULL THEN
    -- Clear old set then re-add (so we don't keep stale entries)
    DELETE FROM public.department_permissions WHERE department_id = ppc_id;
    FOREACH m IN ARRAY modules LOOP
      INSERT INTO public.department_permissions (department_id, tab_name)
      VALUES (ppc_id, m) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $reseed$;

-- ---------------------------------------------------------------------------
-- Part B — Helper function that drops & recreates standard policies on a table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_standard_module_policies(
  p_table         regclass,
  p_module        text,
  p_write_mode    text DEFAULT 'module'   -- 'module' | 'admin_only'
)
RETURNS void
LANGUAGE plpgsql
AS $apply$
DECLARE
  pol record;
  tbl_name text := split_part(p_table::text, '.', 2);
  schema_name text := split_part(p_table::text, '.', 1);
  fq text := quote_ident(schema_name) || '.' || quote_ident(tbl_name);
  read_check  text;
  write_check text;
BEGIN
  -- 1. Drop every existing policy on this table
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = schema_name AND tablename = tbl_name
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol.policyname, fq);
  END LOOP;

  -- 2. Make sure RLS is enabled
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', fq);

  -- 3. Build the predicates
  read_check  := format('public.auth_user_can_access_module(%L)', p_module);
  IF p_write_mode = 'admin_only' THEN
    write_check := 'public.auth_is_admin()';
  ELSE
    write_check := read_check;
  END IF;

  -- 4. Create ONE policy per action (no overlap → no multiple_permissive warnings)
  EXECUTE format(
    'CREATE POLICY %I ON %s FOR SELECT TO authenticated USING (%s)',
    tbl_name || '_select', fq, read_check);

  EXECUTE format(
    'CREATE POLICY %I ON %s FOR INSERT TO authenticated WITH CHECK (%s)',
    tbl_name || '_insert', fq, write_check);

  EXECUTE format(
    'CREATE POLICY %I ON %s FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
    tbl_name || '_update', fq, write_check, write_check);

  EXECUTE format(
    'CREATE POLICY %I ON %s FOR DELETE TO authenticated USING (%s)',
    tbl_name || '_delete', fq, write_check);
END
$apply$;

-- ---------------------------------------------------------------------------
-- Part C — Apply policies to every public table.
--   Each line: table → module, [admin_only] for sensitive writes.
-- ---------------------------------------------------------------------------

-- CORE (reference data — read by anyone with 'core' access; sensitive ones admin-only writes)
SELECT public._apply_standard_module_policies('public.products',                       'core');
SELECT public._apply_standard_module_policies('public.vendors',                        'core');
SELECT public._apply_standard_module_policies('public.customers',                      'core');
SELECT public._apply_standard_module_policies('public.customer_warehouses',            'core');
SELECT public._apply_standard_module_policies('public.raw_materials',                  'core');
SELECT public._apply_standard_module_policies('public.raw_material_specifications',    'core');
SELECT public._apply_standard_module_policies('public.raw_material_vendors',           'core');
SELECT public._apply_standard_module_policies('public.bom',                            'core');
SELECT public._apply_standard_module_policies('public.bom_versions',                   'core');

-- ORG STRUCTURE (Admin-only writes — see migration 001 question)
SELECT public._apply_standard_module_policies('public.departments',                    'core', 'admin_only');
SELECT public._apply_standard_module_policies('public.department_permissions',         'core', 'admin_only');
SELECT public._apply_standard_module_policies('public.user_accounts',                  'core', 'admin_only');
SELECT public._apply_standard_module_policies('public.user_departments',               'core', 'admin_only');

-- QUALITY
SELECT public._apply_standard_module_policies('public.pqc_reports',                    'quality');
SELECT public._apply_standard_module_policies('public.line_rejections',                'quality');
SELECT public._apply_standard_module_policies('public.rca_reports',                    'quality');
SELECT public._apply_standard_module_policies('public.vendor_capa',                    'quality');
SELECT public._apply_standard_module_policies('public.iqc_vendor_capa',                'quality');
SELECT public._apply_standard_module_policies('public.production_capa',                'quality');
SELECT public._apply_standard_module_policies('public.customer_complaints',            'quality');
SELECT public._apply_standard_module_policies('public.customer_complaint_parts',       'quality');
SELECT public._apply_standard_module_policies('public.customer_complaint_batches',     'quality');
SELECT public._apply_standard_module_policies('public.customer_complaint_batch_items', 'quality');
SELECT public._apply_standard_module_policies('public.capa_implementation_checks',     'quality');

-- PURCHASE
SELECT public._apply_standard_module_policies('public.purchase_orders',                'purchase');
SELECT public._apply_standard_module_policies('public.purchase_order_items',           'purchase');
SELECT public._apply_standard_module_policies('public.grn',                            'purchase');
SELECT public._apply_standard_module_policies('public.grn_items',                      'purchase');
SELECT public._apply_standard_module_policies('public.material_blocking',              'purchase');

-- STORE
SELECT public._apply_standard_module_policies('public.inventory',                      'store');
SELECT public._apply_standard_module_policies('public.material_movements',             'store');
SELECT public._apply_standard_module_policies('public.material_requests',              'store');
SELECT public._apply_standard_module_policies('public.kit_preparation',                'store');
SELECT public._apply_standard_module_policies('public.kit_items',                      'store');
SELECT public._apply_standard_module_policies('public.store_discrepancies',            'store');

-- PRODUCTION
SELECT public._apply_standard_module_policies('public.production_orders',                  'production');
SELECT public._apply_standard_module_policies('public.production_schedules',               'production');
SELECT public._apply_standard_module_policies('public.production_serial_numbers',          'production');
SELECT public._apply_standard_module_policies('public.production_line_assignments',        'production');
SELECT public._apply_standard_module_policies('public.production_material_receipts',       'production');
SELECT public._apply_standard_module_policies('public.production_material_discrepancies',  'production');
SELECT public._apply_standard_module_policies('public.production_discrepancies',           'production');
SELECT public._apply_standard_module_policies('public.hourly_production',                  'production');
SELECT public._apply_standard_module_policies('public.finished_goods_inventory',           'production');

-- PLANNING
SELECT public._apply_standard_module_policies('public.projections',                    'planning');

-- R&D
SELECT public._apply_standard_module_policies('public.npd_projects',                   'rnd');
SELECT public._apply_standard_module_policies('public.npd_benchmarks',                 'rnd');
SELECT public._apply_standard_module_policies('public.npd_project_bom',                'rnd');
SELECT public._apply_standard_module_policies('public.npd_bom_materials',              'rnd');
SELECT public._apply_standard_module_policies('public.npd_sample_tracking',            'rnd');
SELECT public._apply_standard_module_policies('public.npd_bom_stage_history',          'rnd');
SELECT public._apply_standard_module_policies('public.npd_bom_comments',               'rnd');
SELECT public._apply_standard_module_policies('public.pre_existing_projects',          'rnd');

-- HR (payroll = admin-only writes)
SELECT public._apply_standard_module_policies('public.employees',                      'hr');
SELECT public._apply_standard_module_policies('public.attendance',                     'hr');
SELECT public._apply_standard_module_policies('public.payroll',                        'hr', 'admin_only');
SELECT public._apply_standard_module_policies('public.performance_reviews',            'hr');
SELECT public._apply_standard_module_policies('public.training_programs',              'hr');
SELECT public._apply_standard_module_policies('public.employee_training',              'hr');
SELECT public._apply_standard_module_policies('public.skills',                         'hr');
SELECT public._apply_standard_module_policies('public.employee_skills',                'hr');

-- SALES
SELECT public._apply_standard_module_policies('public.dispatch_orders',                'sales');
SELECT public._apply_standard_module_policies('public.dispatch_order_items',           'sales');
SELECT public._apply_standard_module_policies('public.spare_orders',                   'sales');
SELECT public._apply_standard_module_policies('public.spare_order_items',              'sales');

-- IMPORTS
SELECT public._apply_standard_module_policies('public.import_containers',              'imports');
SELECT public._apply_standard_module_policies('public.container_materials',            'imports');
SELECT public._apply_standard_module_policies('public.container_status_history',       'imports');
SELECT public._apply_standard_module_policies('public.container_cost_breakdown',       'imports');

-- APPROVALS
SELECT public._apply_standard_module_policies('public.approval_workflows',             'approvals');
SELECT public._apply_standard_module_policies('public.audit_logs',                     'approvals', 'admin_only');

-- DASH (separate brand — only Dash-dept users + Admin)
SELECT public._apply_standard_module_policies('public.dash_products',                  'dash');
SELECT public._apply_standard_module_policies('public.dash_product_artwork',           'dash');
SELECT public._apply_standard_module_policies('public.dash_product_documents',         'dash');
SELECT public._apply_standard_module_policies('public.dash_product_compliance',        'dash');
SELECT public._apply_standard_module_policies('public.dash_product_specs',             'dash');
SELECT public._apply_standard_module_policies('public.dash_product_qc_checklist',      'dash');
SELECT public._apply_standard_module_policies('public.dash_product_spares',            'dash');
SELECT public._apply_standard_module_policies('public.dash_product_spare_parts',       'dash');
SELECT public._apply_standard_module_policies('public.dash_factory_orders',            'dash');
SELECT public._apply_standard_module_policies('public.dash_inventory',                 'dash');
SELECT public._apply_standard_module_policies('public.dash_inventory_movements',       'dash');
SELECT public._apply_standard_module_policies('public.dash_customers',                 'dash');
SELECT public._apply_standard_module_policies('public.dash_customer_documents',        'dash');
SELECT public._apply_standard_module_policies('public.dash_sales_orders',              'dash');
SELECT public._apply_standard_module_policies('public.dash_sales_order_items',         'dash');
SELECT public._apply_standard_module_policies('public.dash_service_tickets',           'dash');
SELECT public._apply_standard_module_policies('public.dash_service_history',           'dash');
SELECT public._apply_standard_module_policies('public.dash_spare_parts',               'dash');
SELECT public._apply_standard_module_policies('public.dash_spare_consumption',         'dash');
SELECT public._apply_standard_module_policies('public.dash_spare_dispatch_log',        'dash');
SELECT public._apply_standard_module_policies('public.dash_payments',                  'dash');

-- ---------------------------------------------------------------------------
-- Part D — Drop the helper function (we don't want it sitting in production)
-- ---------------------------------------------------------------------------
DROP FUNCTION public._apply_standard_module_policies(regclass, text, text);

COMMIT;

-- ============================================================================
-- POST-APPLY VERIFICATION (run by hand):
--   -- Should show every public table has exactly 4 policies
--   SELECT tablename, COUNT(*) AS n
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   GROUP BY tablename
--   HAVING COUNT(*) <> 4
--   ORDER BY tablename;
--
--   -- Should show 0 always-true
--   SELECT COUNT(*) FROM pg_policies
--   WHERE schemaname='public' AND (qual='true' OR with_check='true');
-- ============================================================================
