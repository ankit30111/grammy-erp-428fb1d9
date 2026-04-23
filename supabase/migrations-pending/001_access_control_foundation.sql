-- ============================================================================
-- Migration 001: Access Control Foundation
-- ----------------------------------------------------------------------------
-- Purpose:
--   Build the bedrock for a real, server-enforced permission model so we can
--   replace the 134 "always true" RLS policies in the next migration.
--
-- What this migration does (no policies are changed yet — that's migration 002):
--   1. Adds 'Dash' as a department (separate brand)
--   2. Creates user_departments (many-to-many: a user can be in 1, many or all departments)
--   3. Adds 'Admin' department for system-wide override
--   4. Backfills from user_accounts.department_id (single) into user_departments
--   5. Creates STABLE SECURITY DEFINER helper functions used by every RLS policy:
--        auth_is_admin()
--        auth_user_in_department(name text)
--        auth_user_can_access_module(module_name text)
--   6. Seeds department_permissions with sensible per-module defaults
--      (You can edit these in the UI later — they are just a starting matrix.)
--
-- Safety:
--   - Pure additive: no DROP, no ALTER on existing data.
--   - All tables empty in production today; backfill is a no-op but written
--     correctly for the future.
--   - Helper functions are SECURITY DEFINER but do NOT bypass anything beyond
--     reading user_accounts/user_departments — they are read-only and locked
--     to a fixed search_path.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Make sure 'Dash' and 'Admin' departments exist
-- ---------------------------------------------------------------------------
INSERT INTO public.departments (name, description)
VALUES
  ('Admin', 'System administrators — full access to all modules across brands'),
  ('Dash',  'Dash brand — owns all dash_* tables (separate entity from Grammy)')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. user_departments: many-to-many
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_departments (
  user_id       uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id)  ON DELETE CASCADE,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  granted_by    uuid        REFERENCES public.user_accounts(id),
  PRIMARY KEY (user_id, department_id)
);

CREATE INDEX IF NOT EXISTS user_departments_department_id_idx
  ON public.user_departments (department_id);

CREATE INDEX IF NOT EXISTS user_departments_user_id_idx
  ON public.user_departments (user_id);

ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

-- Bootstrap policy so admins can manage; users can read their own.
-- (Will be replaced/expanded by migration 002 along with everything else.)
DROP POLICY IF EXISTS "user_departments self-read" ON public.user_departments;
CREATE POLICY "user_departments self-read"
  ON public.user_departments
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Backfill from existing user_accounts.department_id
--    (No-op today — table is empty — but correct for the future.)
-- ---------------------------------------------------------------------------
INSERT INTO public.user_departments (user_id, department_id)
SELECT id, department_id
FROM public.user_accounts
WHERE department_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Helper functions used by every future RLS policy
--    All three are SECURITY DEFINER + locked search_path so they:
--      * always run with the same plan,
--      * bypass RLS only on the specific tables they need,
--      * are immune to search_path injection attacks.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_accounts ua
    WHERE ua.id = (SELECT auth.uid())
      AND ua.is_active = true
      AND (
        ua.role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.user_departments ud
          JOIN public.departments d ON d.id = ud.department_id
          WHERE ud.user_id = ua.id AND d.name = 'Admin'
        )
      )
  );
$$;

COMMENT ON FUNCTION public.auth_is_admin IS
  'TRUE if the calling auth.uid() has role=admin OR is in the Admin department. Used by every RLS policy.';

CREATE OR REPLACE FUNCTION public.auth_user_in_department(dept_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_departments ud
    JOIN public.departments d  ON d.id = ud.department_id
    JOIN public.user_accounts ua ON ua.id = ud.user_id
    WHERE ud.user_id = (SELECT auth.uid())
      AND ua.is_active = true
      AND d.name = dept_name
  );
$$;

COMMENT ON FUNCTION public.auth_user_in_department IS
  'TRUE if the calling user belongs to the named department.';

CREATE OR REPLACE FUNCTION public.auth_user_can_access_module(module_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  -- Admin always wins
  SELECT public.auth_is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.user_departments ud
        JOIN public.department_permissions dp ON dp.department_id = ud.department_id
        JOIN public.user_accounts ua ON ua.id = ud.user_id
        WHERE ud.user_id = (SELECT auth.uid())
          AND ua.is_active = true
          AND dp.tab_name = module_name
      );
$$;

COMMENT ON FUNCTION public.auth_user_can_access_module IS
  'TRUE if any of the calling user''s departments has permission for the given module/tab name.';

-- ---------------------------------------------------------------------------
-- 5. Seed department_permissions with a sensible default matrix.
--    (Empty today; this populates it. You can edit in the UI after.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  d_admin   uuid := (SELECT id FROM public.departments WHERE name = 'Admin');
  d_mgmt    uuid := (SELECT id FROM public.departments WHERE name = 'Management');
  d_plan    uuid := (SELECT id FROM public.departments WHERE name = 'Planning');
  d_prod    uuid := (SELECT id FROM public.departments WHERE name = 'Production');
  d_pur     uuid := (SELECT id FROM public.departments WHERE name = 'Purchase');
  d_qual    uuid := (SELECT id FROM public.departments WHERE name = 'Quality');
  d_rnd     uuid := (SELECT id FROM public.departments WHERE name = 'R&D');
  d_sales   uuid := (SELECT id FROM public.departments WHERE name = 'Sales');
  d_store   uuid := (SELECT id FROM public.departments WHERE name = 'Store');
  d_hr      uuid := (SELECT id FROM public.departments WHERE name = 'HR');
  d_dash    uuid := (SELECT id FROM public.departments WHERE name = 'Dash');
  -- Modules — keep this list canonical; matches table groups in migration 002
  modules text[] := ARRAY[
    'core',          -- products, vendors, customers, departments, user_accounts (read-only for non-admin)
    'quality',       -- IQC/PQC/OQC, RCA, CAPA, line_rejections, customer_complaints
    'purchase',      -- POs, GRN, vendor_capa, raw_materials
    'store',         -- inventory, material_movements, kit_*, store_discrepancies
    'production',    -- production_orders, production_schedules, hourly_production, production_*
    'planning',      -- projections, material_requests, BOM
    'rnd',           -- npd_*, pre_existing_projects, bom_versions
    'hr',            -- employees, attendance, payroll, performance_reviews, training, skills
    'sales',         -- dispatch_orders, spare_orders, customers
    'imports',       -- import_containers, container_*
    'approvals',     -- approval_workflows
    'dash'           -- all dash_* tables (Dash brand)
  ];
  m text;
BEGIN
  -- helper: insert (dept, module) pairs idempotently
  IF d_admin IS NOT NULL THEN
    FOREACH m IN ARRAY modules LOOP
      INSERT INTO public.department_permissions (department_id, tab_name)
      VALUES (d_admin, m) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Management: read all (we'll handle "read vs write" inside policies)
  IF d_mgmt IS NOT NULL THEN
    FOREACH m IN ARRAY modules LOOP
      INSERT INTO public.department_permissions (department_id, tab_name)
      VALUES (d_mgmt, m) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Per-department defaults
  IF d_plan  IS NOT NULL THEN INSERT INTO public.department_permissions(department_id, tab_name) VALUES
    (d_plan,'planning'),(d_plan,'production'),(d_plan,'purchase'),(d_plan,'core') ON CONFLICT DO NOTHING; END IF;

  IF d_prod  IS NOT NULL THEN INSERT INTO public.department_permissions(department_id, tab_name) VALUES
    (d_prod,'production'),(d_prod,'quality'),(d_prod,'store'),(d_prod,'core') ON CONFLICT DO NOTHING; END IF;

  IF d_pur   IS NOT NULL THEN INSERT INTO public.department_permissions(department_id, tab_name) VALUES
    (d_pur,'purchase'),(d_pur,'imports'),(d_pur,'approvals'),(d_pur,'core') ON CONFLICT DO NOTHING; END IF;

  IF d_qual  IS NOT NULL THEN INSERT INTO public.department_permissions(department_id, tab_name) VALUES
    (d_qual,'quality'),(d_qual,'production'),(d_qual,'purchase'),(d_qual,'core') ON CONFLICT DO NOTHING; END IF;

  IF d_rnd   IS NOT NULL THEN INSERT INTO public.department_permissions(department_id, tab_name) VALUES
    (d_rnd,'rnd'),(d_rnd,'core') ON CONFLICT DO NOTHING; END IF;

  IF d_sales IS NOT NULL THEN INSERT INTO public.department_permissions(department_id, tab_name) VALUES
    (d_sales,'sales'),(d_sales,'core') ON CONFLICT DO NOTHING; END IF;

  IF d_store IS NOT NULL THEN INSERT INTO public.department_permissions(department_id, tab_name) VALUES
    (d_store,'store'),(d_store,'purchase'),(d_store,'production'),(d_store,'core') ON CONFLICT DO NOTHING; END IF;

  IF d_hr    IS NOT NULL THEN INSERT INTO public.department_permissions(department_id, tab_name) VALUES
    (d_hr,'hr'),(d_hr,'core') ON CONFLICT DO NOTHING; END IF;

  IF d_dash  IS NOT NULL THEN INSERT INTO public.department_permissions(department_id, tab_name) VALUES
    (d_dash,'dash'),(d_dash,'core') ON CONFLICT DO NOTHING; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Sanity: surface what the seed produced (visible in migration logs)
-- ---------------------------------------------------------------------------
-- (No SELECT INTO — just informational comment; verify post-apply with:
--    SELECT d.name, array_agg(dp.tab_name ORDER BY dp.tab_name) AS modules
--    FROM departments d LEFT JOIN department_permissions dp ON dp.department_id = d.id
--    GROUP BY d.name ORDER BY d.name;
-- )

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, in case you need it):
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.auth_user_can_access_module(text);
--   DROP FUNCTION IF EXISTS public.auth_user_in_department(text);
--   DROP FUNCTION IF EXISTS public.auth_is_admin();
--   DELETE FROM public.department_permissions;             -- only if you don't want the seed
--   DROP TABLE IF EXISTS public.user_departments;
--   DELETE FROM public.departments WHERE name IN ('Admin','Dash');
--   COMMIT;
-- ============================================================================
