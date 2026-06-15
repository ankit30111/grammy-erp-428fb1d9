-- Restrict sensitive plant columns to admins only via column-level grants
REVOKE SELECT ON public.plants FROM authenticated;
GRANT SELECT (id, code, name, is_active, address_line1, address_line2, city, state, postal_code, country, notes, created_at, updated_at)
  ON public.plants TO authenticated;
GRANT ALL ON public.plants TO service_role;

-- Admin-only RPC to fetch sensitive plant fields
CREATE OR REPLACE FUNCTION public.get_plant_sensitive(p_plant_id uuid)
RETURNS TABLE(id uuid, gstin text, factory_license_no text, email text, phone text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.auth_is_admin() THEN
    RAISE EXCEPTION 'permission denied: get_plant_sensitive is admin-only' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT p.id, p.gstin, p.factory_license_no, p.email, p.phone FROM public.plants p WHERE p.id = p_plant_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_plant_sensitive(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_plant_sensitive(uuid) TO authenticated;