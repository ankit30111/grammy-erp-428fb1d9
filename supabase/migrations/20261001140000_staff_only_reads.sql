-- Reads are for staff only.
--
-- Found 1 Oct 2026: public sign-up was switched on (with auto-confirm) and every
-- new auth user got an active user_accounts row. has_role(NULL) - the read rule
-- on 30 master/reference tables (parts, vendors, customers, projections, BOM...)
-- - only checked "has an active account". So anyone with the website's public
-- key could sign themselves up and read those tables. Nobody did: the only
-- accounts are the four created by Admin.
--
-- Fixed:
--   * public sign-up switched off in Auth settings (accounts are created by Admin
--     through admin-create-user, which is not affected);
--   * has_role(NULL) now also needs the account to be in at least one department
--     (or be an admin) - an account nobody has set up sees nothing;
--   * part_brands and brand_sync_issues were readable by any logged-in user
--     (USING true); now staff only, like the other masters.

CREATE OR REPLACE FUNCTION public.has_role(_module text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_accounts ua
    WHERE ua.id = auth.uid() AND ua.is_active
      AND (ua.role = 'admin'
        OR (_module IS NULL AND EXISTS (SELECT 1 FROM public.user_departments ud WHERE ud.user_id = ua.id))
        OR EXISTS (SELECT 1 FROM public.user_departments ud
                   JOIN public.department_permissions dp ON dp.department_id = ud.department_id
                   WHERE ud.user_id = ua.id AND dp.tab_name = _module))
  );
$function$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename IN ('part_brands', 'brand_sync_issues')
              AND cmd = 'SELECT' AND qual = 'true' LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (public.has_role())', r.policyname, r.tablename);
  END LOOP;
END $$;
