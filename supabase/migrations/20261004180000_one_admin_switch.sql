-- Admin is the Role on the user (Users & Access -> Role: Admin / User), and
-- nothing else. auth_is_admin() also counted membership of the department
-- named "Admin", so unticking one of the two left a person admin through the
-- other (PLM account: department removed, role still Admin; Anmol: role set to
-- User, still in the Admin department).
CREATE OR REPLACE FUNCTION public.auth_is_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_accounts ua
                  WHERE ua.id = (SELECT auth.uid()) AND ua.is_active AND ua.role = 'admin');
$function$;

-- The department keeps what it is - access to every module - under a name that
-- does not read as admin rights.
UPDATE public.departments SET name = 'All modules' WHERE name = 'Admin';

-- The PLM account's admin rights, revoked as intended.
UPDATE public.user_accounts SET role = 'user' WHERE email = 'plm.gacoustics@outlook.com' AND role = 'admin';
