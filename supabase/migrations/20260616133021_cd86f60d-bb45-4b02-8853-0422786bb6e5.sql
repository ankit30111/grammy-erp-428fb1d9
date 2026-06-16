DROP POLICY IF EXISTS payroll_select ON public.payroll;
CREATE POLICY payroll_select ON public.payroll FOR SELECT TO authenticated USING (public.auth_is_admin());