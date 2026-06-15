
-- =====================================================================
-- Lock down sensitive financial / PII columns and storage buckets.
-- =====================================================================

-- ---- VENDORS ---------------------------------------------------------
REVOKE SELECT ON public.vendors FROM authenticated;
GRANT SELECT (id, vendor_code, name, email, contact_number, address, gst_number,
              is_active, created_at, updated_at, created_by, contact_person_name)
  ON public.vendors TO authenticated;

CREATE OR REPLACE FUNCTION public.get_vendor_finance(p_vendor_id uuid)
RETURNS TABLE (id uuid, bank_account_number text, ifsc_code text,
               gst_certificate_url text, msme_certificate_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'permission denied: get_vendor_finance is admin-only'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT v.id, v.bank_account_number, v.ifsc_code,
         v.gst_certificate_url, v.msme_certificate_url
    FROM public.vendors v WHERE v.id = p_vendor_id;
END; $$;
REVOKE ALL ON FUNCTION public.get_vendor_finance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_finance(uuid) TO authenticated;

-- ---- DASH_CUSTOMERS --------------------------------------------------
REVOKE SELECT ON public.dash_customers FROM authenticated, anon;
GRANT SELECT (id, customer_name, customer_type, gst_number, credit_limit,
              outstanding_balance, contact_person, phone, email, address, city,
              state, territory, assigned_sales_manager, is_active, created_at,
              updated_at, owner_name, owner_phone, primary_address,
              godown_address, pincode, salesman_name, notes, created_by, updated_by)
  ON public.dash_customers TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dash_customer_finance(p_customer_id uuid)
RETURNS TABLE (id uuid, bank_account_number text, bank_ifsc text, bank_name text,
               pan_number text, msme_number text, gst_certificate_url text,
               cancelled_cheque_url text, msme_certificate_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'permission denied: get_dash_customer_finance is admin-only'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT c.id, c.bank_account_number, c.bank_ifsc, c.bank_name, c.pan_number,
         c.msme_number, c.gst_certificate_url, c.cancelled_cheque_url,
         c.msme_certificate_url
    FROM public.dash_customers c WHERE c.id = p_customer_id;
END; $$;
REVOKE ALL ON FUNCTION public.get_dash_customer_finance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dash_customer_finance(uuid) TO authenticated;

-- ---- EMPLOYEES -------------------------------------------------------
REVOKE SELECT ON public.employees FROM authenticated, anon;
GRANT SELECT (id, employee_code, first_name, last_name, email, hire_date,
              position, department, status, address, city, state, pincode,
              created_at, updated_at, created_by)
  ON public.employees TO authenticated;

CREATE OR REPLACE FUNCTION public.get_employee_sensitive(p_employee_id uuid)
RETURNS TABLE (id uuid, phone_number text, date_of_birth date, salary numeric,
               aadhar_number text, pan_number text, esic_number text,
               bank_name text, bank_account_number text, ifsc_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'permission denied: get_employee_sensitive is admin-only'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT e.id, e.phone_number, e.date_of_birth, e.salary, e.aadhar_number,
         e.pan_number, e.esic_number, e.bank_name, e.bank_account_number, e.ifsc_code
    FROM public.employees e WHERE e.id = p_employee_id;
END; $$;
REVOKE ALL ON FUNCTION public.get_employee_sensitive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_sensitive(uuid) TO authenticated;

-- ---- PAYROLL ---------------------------------------------------------
-- Tighten SELECT to admin only (financial records). HR can still manage via
-- admin-only RPC; non-admin HR users can no longer browse all payslips.
DROP POLICY IF EXISTS payroll_select ON public.payroll;
CREATE POLICY payroll_select ON public.payroll
  FOR SELECT USING (public.auth_is_admin());

-- =====================================================================
-- Storage bucket policies: scope to matching module permission.
-- =====================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policy WHERE polrelid='storage.objects'::regclass LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.polname);
  END LOOP;
END $$;

-- Helper: bucket -> required module
-- vendor-documents       -> core
-- customer-documents     -> core
-- iqc-reports            -> quality
-- capa-documents         -> quality
-- product-documents      -> core
-- raw-material-documents -> core
-- npd-specifications     -> rnd
-- dash-documents         -> dash
-- dash-product-docs      -> dash

CREATE POLICY storage_bucket_module_select ON storage.objects FOR SELECT TO authenticated
USING (
  (bucket_id = 'vendor-documents'       AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'customer-documents'  AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'iqc-reports'         AND public.auth_user_can_access_module('quality'))
  OR (bucket_id = 'capa-documents'      AND public.auth_user_can_access_module('quality'))
  OR (bucket_id = 'product-documents'   AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'raw-material-documents' AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'npd-specifications'  AND public.auth_user_can_access_module('rnd'))
  OR (bucket_id = 'dash-documents'      AND public.auth_user_can_access_module('dash'))
  OR (bucket_id = 'dash-product-docs'   AND public.auth_user_can_access_module('dash'))
);

CREATE POLICY storage_bucket_module_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  (bucket_id = 'vendor-documents'       AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'customer-documents'  AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'iqc-reports'         AND public.auth_user_can_access_module('quality'))
  OR (bucket_id = 'capa-documents'      AND public.auth_user_can_access_module('quality'))
  OR (bucket_id = 'product-documents'   AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'raw-material-documents' AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'npd-specifications'  AND public.auth_user_can_access_module('rnd'))
  OR (bucket_id = 'dash-documents'      AND public.auth_user_can_access_module('dash'))
  OR (bucket_id = 'dash-product-docs'   AND public.auth_user_can_access_module('dash'))
);

CREATE POLICY storage_bucket_module_update ON storage.objects FOR UPDATE TO authenticated
USING (
  (bucket_id = 'vendor-documents'       AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'customer-documents'  AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'iqc-reports'         AND public.auth_user_can_access_module('quality'))
  OR (bucket_id = 'capa-documents'      AND public.auth_user_can_access_module('quality'))
  OR (bucket_id = 'product-documents'   AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'raw-material-documents' AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'npd-specifications'  AND public.auth_user_can_access_module('rnd'))
  OR (bucket_id = 'dash-documents'      AND public.auth_user_can_access_module('dash'))
  OR (bucket_id = 'dash-product-docs'   AND public.auth_user_can_access_module('dash'))
);

CREATE POLICY storage_bucket_module_delete ON storage.objects FOR DELETE TO authenticated
USING (
  (bucket_id = 'vendor-documents'       AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'customer-documents'  AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'iqc-reports'         AND public.auth_user_can_access_module('quality'))
  OR (bucket_id = 'capa-documents'      AND public.auth_user_can_access_module('quality'))
  OR (bucket_id = 'product-documents'   AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'raw-material-documents' AND public.auth_user_can_access_module('core'))
  OR (bucket_id = 'npd-specifications'  AND public.auth_user_can_access_module('rnd'))
  OR (bucket_id = 'dash-documents'      AND public.auth_user_can_access_module('dash'))
  OR (bucket_id = 'dash-product-docs'   AND public.auth_user_can_access_module('dash'))
);

-- =====================================================================
-- user_plants: document RPC-only writes (no client INSERT/UPDATE/DELETE).
-- =====================================================================
COMMENT ON TABLE public.user_plants IS
  'Plant assignments. Writes are RPC-only via public.set_user_plants(); no INSERT/UPDATE/DELETE policies exist, so direct client writes are blocked by RLS.';
