-- Employees: current + permanent address, emergency contact, photo (for the ID card).
-- address / city / state / pincode stay as the CURRENT address.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS permanent_address text,
  ADD COLUMN IF NOT EXISTS permanent_city text,
  ADD COLUMN IF NOT EXISTS permanent_state text,
  ADD COLUMN IF NOT EXISTS permanent_pincode text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS photo_path text;

COMMENT ON COLUMN public.employees.address IS 'Current address (with city, state, pincode)';
COMMENT ON COLUMN public.employees.permanent_address IS 'Permanent address (with permanent_city, _state, _pincode)';
COMMENT ON COLUMN public.employees.photo_path IS 'Path in storage bucket employee-photos; printed on the ID card';

-- plain reads are column-limited on employees; these new columns are not sensitive
GRANT SELECT (permanent_address, permanent_city, permanent_state, permanent_pincode,
              emergency_contact_name, emergency_contact_phone, photo_path) ON public.employees TO authenticated;

-- photos: private bucket, HR and Admin only
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-photos', 'employee-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS employee_photos_read ON storage.objects;
DROP POLICY IF EXISTS employee_photos_write ON storage.objects;
DROP POLICY IF EXISTS employee_photos_update ON storage.objects;
DROP POLICY IF EXISTS employee_photos_delete ON storage.objects;
CREATE POLICY employee_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employee-photos' AND (public.auth_is_admin() OR public.auth_user_can_access_module('hr')));
CREATE POLICY employee_photos_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-photos' AND (public.auth_is_admin() OR public.auth_user_can_access_module('hr')));
CREATE POLICY employee_photos_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'employee-photos' AND (public.auth_is_admin() OR public.auth_user_can_access_module('hr')));
CREATE POLICY employee_photos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employee-photos' AND (public.auth_is_admin() OR public.auth_user_can_access_module('hr')));
