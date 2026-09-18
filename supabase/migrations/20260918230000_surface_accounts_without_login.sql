-- An account can exist in user_accounts with no sign-in identity behind it, and
-- nothing said so.
--
-- Anmol Malhotra had a user_accounts row, an admin badge and department controls,
-- and no row in auth.users at all. He could never have signed in. The Access
-- Control screen showed him exactly like every working account, because
-- list_user_accounts_for_admin only ever read user_accounts. The first and only
-- hint was "Failed to update password: User not found" when someone tried to reset
-- it - an error that points at the password, not at the account never having had a
-- login.
--
-- The reverse also existed: pqc.grammyelectronics@outlook.com could sign in but had
-- no profile row, so it appeared nowhere in Access Control while still holding a
-- valid login.
--
-- Two halves of one account, each able to exist without the other. The screen
-- cannot fix that, but it can stop hiding it, so the listing now reports whether
-- the login exists.

CREATE OR REPLACE FUNCTION public.list_user_accounts_for_admin()
RETURNS TABLE(
  id                   uuid,
  email                text,
  username             text,
  full_name            text,
  role                 text,
  is_active            boolean,
  department_id        uuid,
  department_name      text,
  all_department_names text,
  has_login            boolean,
  last_sign_in_at      timestamptz,
  created_at           timestamptz,
  updated_at           timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege: admin role required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ua.id,
    ua.email,
    ua.username,
    ua.full_name,
    ua.role,
    ua.is_active,
    ua.department_id,
    d.name AS department_name,
    COALESCE(
      (SELECT string_agg(d2.name, ', ' ORDER BY d2.name)
         FROM public.user_departments ud
         JOIN public.departments d2 ON d2.id = ud.department_id
        WHERE ud.user_id = ua.id),
      ''
    ) AS all_department_names,
    (au.id IS NOT NULL) AS has_login,
    au.last_sign_in_at,
    ua.created_at,
    ua.updated_at
  FROM public.user_accounts ua
  LEFT JOIN public.departments d ON d.id = ua.department_id
  LEFT JOIN auth.users au ON au.id = ua.id
  ORDER BY ua.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_user_accounts_for_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_user_accounts_for_admin() TO authenticated;

-- Logins with no profile are invisible in Access Control while still being able to
-- sign in. An admin should be able to see that without opening the Supabase
-- dashboard.
CREATE OR REPLACE FUNCTION public.list_logins_without_account()
RETURNS TABLE(id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege: admin role required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT au.id, au.email::text, au.created_at, au.last_sign_in_at
    FROM auth.users au
    LEFT JOIN public.user_accounts ua ON ua.id = au.id
   WHERE ua.id IS NULL
   ORDER BY au.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_logins_without_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_logins_without_account() TO authenticated;
