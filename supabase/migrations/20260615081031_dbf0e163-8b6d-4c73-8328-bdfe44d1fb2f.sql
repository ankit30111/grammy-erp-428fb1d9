
CREATE OR REPLACE FUNCTION public.admin_list_active_employee_salaries()
RETURNS TABLE (id uuid, employee_code text, first_name text, last_name text, salary numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'permission denied: admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT e.id, e.employee_code, e.first_name, e.last_name, e.salary
    FROM public.employees e
    WHERE e.status = 'active';
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_active_employee_salaries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_active_employee_salaries() TO authenticated;
