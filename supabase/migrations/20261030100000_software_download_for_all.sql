-- Anyone logged in can download the software version in production for a brand code.
-- Older versions, testing versions and documents stay R&D-only.

CREATE OR REPLACE VIEW public.software_in_production AS
SELECT DISTINCT ON (r.part_id) r.part_id,
    r.version,
    r.activated_at,
    r.approved_at,
    r.sha256,
    r.file_size,
    bv.version AS bom_version,
    r.file_path,
    r.file_name
FROM software_releases r
LEFT JOIN item_versions bv ON bv.id = r.bom_version_id
WHERE r.kind = 'BRAND' AND r.status = 'APPROVED' AND has_role()
ORDER BY r.part_id, r.activated_at DESC;

-- True when the storage object is the file of a version currently in production.
CREATE OR REPLACE FUNCTION public.software_file_in_production(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT DISTINCT ON (r.part_id) r.file_path
      FROM software_releases r
      WHERE r.kind = 'BRAND' AND r.status = 'APPROVED'
      ORDER BY r.part_id, r.activated_at DESC
    ) p WHERE p.file_path = p_name);
$$;
REVOKE ALL ON FUNCTION public.software_file_in_production(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.software_file_in_production(text) TO authenticated;

DROP POLICY IF EXISTS software_files_read_production ON storage.objects;
CREATE POLICY software_files_read_production ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'software-releases' AND public.has_role() AND public.software_file_in_production(name));
