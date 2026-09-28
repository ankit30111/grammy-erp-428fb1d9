-- The DASH workspace no longer exists (its tables went in 20260928150000 and
-- the app has no DASH pages). Remove its department and module permissions so
-- Users & Access shows only real departments. Its one member keeps their other
-- departments.
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.departments WHERE name = 'Dash';
  IF v_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.user_accounts WHERE department_id = v_id) THEN
    RAISE EXCEPTION 'Someone has Dash as their main department - move them first';
  END IF;
  DELETE FROM public.user_departments WHERE department_id = v_id;
  DELETE FROM public.department_permissions WHERE department_id = v_id OR tab_name = 'dash';
  DELETE FROM public.departments WHERE id = v_id;
END $$;
