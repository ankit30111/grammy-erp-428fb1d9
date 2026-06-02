
-- ============================================================================
-- ACCESS CONTROL FOUNDATION + PRODUCTION LINES
-- ============================================================================

-- 1. user_plants junction table -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_plants (
  user_id    uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  plant_id   uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid NULL REFERENCES public.user_accounts(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, plant_id)
);

GRANT SELECT ON public.user_plants TO authenticated;
GRANT ALL ON public.user_plants TO service_role;

ALTER TABLE public.user_plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_plants_self_read" ON public.user_plants
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.auth_is_admin());

-- Backfill from default_plant_id
INSERT INTO public.user_plants (user_id, plant_id)
SELECT id, default_plant_id
FROM public.user_accounts
WHERE default_plant_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2. Plant-access helper ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_in_plant(p_plant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.auth_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.user_plants up
        WHERE up.user_id = (SELECT auth.uid()) AND up.plant_id = p_plant_id
      );
$$;

-- 3. RPCs for managing plants -------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_my_plants()
RETURNS TABLE(plant_id uuid, plant_code text, plant_name text, is_default boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT p.id, p.code, p.name,
         (p.id = (SELECT default_plant_id FROM public.user_accounts WHERE id = (SELECT auth.uid())))
  FROM public.plants p
  WHERE p.is_active = true
    AND (
      public.auth_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.user_plants up
        WHERE up.user_id = (SELECT auth.uid()) AND up.plant_id = p.id
      )
    )
  ORDER BY p.name;
$$;

CREATE OR REPLACE FUNCTION public.get_user_plants(p_user_id uuid)
RETURNS TABLE(plant_id uuid, code text, name text, is_default boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.code, p.name,
           (p.id = (SELECT default_plant_id FROM public.user_accounts WHERE id = p_user_id))
    FROM public.user_plants up
    JOIN public.plants p ON p.id = up.plant_id
    WHERE up.user_id = p_user_id
    ORDER BY p.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_plants(p_user_id uuid, p_plant_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller uuid;
  v_ids uuid[];
  v_default uuid;
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  v_caller := (SELECT auth.uid());

  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[]) INTO v_ids
  FROM unnest(COALESCE(p_plant_ids, ARRAY[]::uuid[])) x WHERE x IS NOT NULL;

  v_default := CASE WHEN array_length(v_ids,1) IS NULL THEN NULL ELSE v_ids[1] END;

  DELETE FROM public.user_plants WHERE user_id = p_user_id;
  IF array_length(v_ids,1) IS NOT NULL THEN
    INSERT INTO public.user_plants (user_id, plant_id, granted_by)
    SELECT p_user_id, pid, v_caller FROM unnest(v_ids) pid;
  END IF;

  UPDATE public.user_accounts SET default_plant_id = v_default WHERE id = p_user_id;
END;
$$;

-- 4. RPC for setting department modules --------------------------------------
CREATE OR REPLACE FUNCTION public.set_department_modules(p_department_id uuid, p_modules text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_mods text[];
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO v_mods
  FROM unnest(COALESCE(p_modules, ARRAY[]::text[])) x WHERE x IS NOT NULL AND x <> '';

  DELETE FROM public.department_permissions WHERE department_id = p_department_id;
  IF array_length(v_mods,1) IS NOT NULL THEN
    INSERT INTO public.department_permissions (department_id, tab_name)
    SELECT p_department_id, m FROM unnest(v_mods) m;
  END IF;
END;
$$;

-- 5. List all users + departments for admin --------------------------------
CREATE OR REPLACE FUNCTION public.list_departments_with_modules()
RETURNS TABLE(department_id uuid, name text, modules text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT d.id, d.name,
      COALESCE((SELECT array_agg(dp.tab_name ORDER BY dp.tab_name)
                FROM public.department_permissions dp
                WHERE dp.department_id = d.id), ARRAY[]::text[])
    FROM public.departments d
    ORDER BY d.name;
END;
$$;

-- 6. Production lines / sub-assemblies / cells -------------------------------
DO $$ BEGIN
  CREATE TYPE public.production_line_type AS ENUM ('line','sub_assembly','cell');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.production_lines (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_id    uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  line_type   public.production_line_type NOT NULL DEFAULT 'line',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_lines TO authenticated;
GRANT ALL ON public.production_lines TO service_role;

ALTER TABLE public.production_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_lines_read" ON public.production_lines
  FOR SELECT TO authenticated
  USING (
    public.auth_is_admin()
    OR (public.auth_user_can_access_module('production') AND public.auth_user_in_plant(plant_id))
  );

CREATE POLICY "production_lines_write" ON public.production_lines
  FOR ALL TO authenticated
  USING (
    public.auth_is_admin()
    OR (public.auth_user_can_access_module('production') AND public.auth_user_in_plant(plant_id))
  )
  WITH CHECK (
    public.auth_is_admin()
    OR (public.auth_user_can_access_module('production') AND public.auth_user_in_plant(plant_id))
  );

CREATE TRIGGER trg_production_lines_updated_at
BEFORE UPDATE ON public.production_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Re-seed department_permissions to collapsed module map ------------------
-- Collapsed modules (per product call):
--   commerce  = purchase + planning + sales + imports
--   store, production, quality, rnd, dash, hr  = unchanged
--   approvals = Admin + Management ONLY
-- We keep the old tab_names alive so legacy ModuleGuards keep working:
-- a department granted 'commerce' is also granted purchase/planning/sales/imports.
DELETE FROM public.department_permissions;

-- Admin + Management = everything (incl. approvals)
INSERT INTO public.department_permissions (department_id, tab_name)
SELECT d.id, m
FROM public.departments d
CROSS JOIN unnest(ARRAY[
  'core','quality','purchase','store','production','planning',
  'rnd','hr','sales','imports','approvals','dash','commerce'
]) m
WHERE d.name IN ('Admin','Management');

-- PPC / Planning / Purchase / Sales → commerce bundle + core
INSERT INTO public.department_permissions (department_id, tab_name)
SELECT d.id, m
FROM public.departments d
CROSS JOIN unnest(ARRAY['core','commerce','purchase','planning','sales','imports']) m
WHERE d.name IN ('PPC','Planning','Purchase','Sales');

-- Store
INSERT INTO public.department_permissions (department_id, tab_name)
SELECT d.id, m FROM public.departments d
CROSS JOIN unnest(ARRAY['core','store']) m
WHERE d.name = 'Store';

-- Production
INSERT INTO public.department_permissions (department_id, tab_name)
SELECT d.id, m FROM public.departments d
CROSS JOIN unnest(ARRAY['core','production']) m
WHERE d.name = 'Production';

-- Quality
INSERT INTO public.department_permissions (department_id, tab_name)
SELECT d.id, m FROM public.departments d
CROSS JOIN unnest(ARRAY['core','quality']) m
WHERE d.name = 'Quality';

-- R&D
INSERT INTO public.department_permissions (department_id, tab_name)
SELECT d.id, m FROM public.departments d
CROSS JOIN unnest(ARRAY['core','rnd']) m
WHERE d.name = 'R&D';

-- HR
INSERT INTO public.department_permissions (department_id, tab_name)
SELECT d.id, m FROM public.departments d
CROSS JOIN unnest(ARRAY['core','hr']) m
WHERE d.name = 'HR';

-- Dash
INSERT INTO public.department_permissions (department_id, tab_name)
SELECT d.id, m FROM public.departments d
CROSS JOIN unnest(ARRAY['core','dash']) m
WHERE d.name = 'Dash';
