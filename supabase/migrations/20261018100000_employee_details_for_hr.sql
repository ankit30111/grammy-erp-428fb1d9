-- Employee IDs, bank details, phone, DOB and salary are kept out of plain reads
-- (column grants). Only admins could fetch them, so HR staff saw them blank and,
-- on saving, wrote the blanks back. HR (the people who enter them) can now read
-- them too; everyone else still cannot.
CREATE OR REPLACE FUNCTION public.get_employee_sensitive(p_employee_id uuid)
RETURNS TABLE(id uuid, phone_number text, date_of_birth date, salary numeric, aadhar_number text,
              pan_number text, esic_number text, bank_name text, bank_account_number text, ifsc_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.auth_is_admin() OR public.auth_user_can_access_module('hr')) THEN
    RAISE EXCEPTION 'Only HR or Admin can see employee IDs and bank details' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT e.id, e.phone_number, e.date_of_birth, e.salary, e.aadhar_number,
         e.pan_number, e.esic_number, e.bank_name, e.bank_account_number, e.ifsc_code
    FROM public.employees e WHERE e.id = p_employee_id;
END $$;
REVOKE ALL ON FUNCTION public.get_employee_sensitive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_sensitive(uuid) TO authenticated;

-- updated_at was never maintained on employees
DROP TRIGGER IF EXISTS trg_touch_updated_at ON public.employees;
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
