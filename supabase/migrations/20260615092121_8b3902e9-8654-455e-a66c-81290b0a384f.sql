
-- 1. ht_store: drop permissive anon policy, lock down
DROP POLICY IF EXISTS ht_store_anon_all ON public.ht_store;
REVOKE ALL ON public.ht_store FROM anon;
REVOKE ALL ON public.ht_store FROM authenticated;
GRANT ALL ON public.ht_store TO service_role;
CREATE POLICY ht_store_admin_all ON public.ht_store
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ht_store TO authenticated;

-- 2. audit_logs: restrict SELECT to admins
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());

-- 3. user_accounts: restrict SELECT to admins or self
DROP POLICY IF EXISTS user_accounts_select ON public.user_accounts;
CREATE POLICY user_accounts_select ON public.user_accounts
  FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR id = (SELECT auth.uid()));

-- 4. Column-level restriction on customers
REVOKE SELECT ON public.customers FROM authenticated;
GRANT SELECT (
  id, customer_code, name, email, contact_number, address, gst_number,
  is_active, created_at, updated_at, created_by, brand_name, contact_person_name
) ON public.customers TO authenticated;

-- 5. Column-level restriction on vendors
REVOKE SELECT ON public.vendors FROM authenticated;
GRANT SELECT (
  id, vendor_code, name, email, contact_number, address, gst_number,
  is_active, created_at, updated_at, created_by, contact_person_name
) ON public.vendors TO authenticated;

-- 6. Column-level restriction on dash_customers
REVOKE SELECT ON public.dash_customers FROM authenticated;
GRANT SELECT (
  id, customer_name, customer_type, gst_number, credit_limit, outstanding_balance,
  contact_person, phone, email, address, city, state, territory,
  assigned_sales_manager, is_active, created_at, updated_at, owner_name,
  owner_phone, primary_address, godown_address, pincode, salesman_name,
  notes, created_by, updated_by
) ON public.dash_customers TO authenticated;

-- 7. Column-level restriction on employees
REVOKE SELECT ON public.employees FROM authenticated;
GRANT SELECT (
  id, employee_code, first_name, last_name, email, hire_date, position,
  department, status, bank_name, address, city, state, pincode,
  created_at, updated_at, created_by
) ON public.employees TO authenticated;
