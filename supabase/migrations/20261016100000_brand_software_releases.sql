-- Software belongs to the brand code, not the model: JA-006-PH and JA-006-AW each
-- have their own file. Everything happens in R&D:
--
--   TESTING     R&D uploads the file + version, then the testing report and issue list
--   RD_CHECKED  another R&D person (never the uploader) checks it
--   APPROVED    Management / Admin approves it for production
--   REJECTED    at either check, with a reason
--   WITHDRAWN   an approved version taken back when Management re-activates an older one
--
-- The approved version with the latest activation is the one in production.
-- Files live in their own private bucket: only R&D, Management and Admin can
-- open them. Everyone else sees the version, date and checksum, never the file.
-- A brand code without approved software only warns on the production voucher.

DROP VIEW IF EXISTS public.software_release_history;
DROP TABLE IF EXISTS public.software_releases;
DROP FUNCTION IF EXISTS public.software_release_guard();
DROP FUNCTION IF EXISTS public.software_release_to_plm();

-- ---- private storage -----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('software-releases', 'software-releases', false)
ON CONFLICT (id) DO UPDATE SET public = false;
DROP POLICY IF EXISTS software_files_read ON storage.objects;
DROP POLICY IF EXISTS software_files_insert ON storage.objects;
DROP POLICY IF EXISTS software_files_delete ON storage.objects;
CREATE POLICY software_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'software-releases' AND public.can_edit_plm());
CREATE POLICY software_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'software-releases' AND public.can_edit_plm());
CREATE POLICY software_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'software-releases' AND public.can_edit_plm());

-- ---- releases ------------------------------------------------------------------
CREATE TABLE public.software_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,   -- the brand code (JA-006-PH)
  version text NOT NULL CHECK (btrim(version) <> ''),
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  sha256 text CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  test_report_path text, test_report_name text,
  issue_list_path text, issue_list_name text,
  details text,
  status text NOT NULL DEFAULT 'TESTING' CHECK (status IN ('TESTING', 'RD_CHECKED', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  rd_checked_by uuid, rd_checked_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  activated_at timestamptz,          -- latest activation among APPROVED = in production
  decision_note text,                -- rejection reason / why re-activated / why withdrawn
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX software_releases_version_uq ON public.software_releases (part_id, lower(btrim(version)));
CREATE INDEX software_releases_part_idx ON public.software_releases (part_id, status);

CREATE OR REPLACE FUNCTION public.software_release_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_admin boolean := EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin' AND is_active);
BEGIN
  NEW.version := regexp_replace(btrim(NEW.version), '^[vV](?=[0-9])', '');
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.parts WHERE id = NEW.part_id AND source_type = 'FINISHED_GOOD') THEN
      RAISE EXCEPTION 'Software is released for a brand code (JA-006-PH), not a model or part';
    END IF;
    NEW.status := 'TESTING';
    NEW.rd_checked_by := NULL; NEW.rd_checked_at := NULL; NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.activated_at := NULL;
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    RETURN NEW;
  END IF;

  NEW.updated_at := now(); NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  -- Once checked, the files and version are what was checked.
  IF OLD.status <> 'TESTING' AND (NEW.version IS DISTINCT FROM OLD.version OR NEW.file_path IS DISTINCT FROM OLD.file_path
       OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.test_report_path IS DISTINCT FROM OLD.test_report_path
       OR NEW.issue_list_path IS DISTINCT FROM OLD.issue_list_path OR NEW.part_id IS DISTINCT FROM OLD.part_id) THEN
    RAISE EXCEPTION 'v% is past testing, its files cannot change. Upload a new version.', OLD.version;
  END IF;
  IF NEW.activated_at IS DISTINCT FROM OLD.activated_at AND current_setting('app.software', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Use Re-activate to put an older version back in production';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'RD_CHECKED' THEN
      IF OLD.status <> 'TESTING' THEN RAISE EXCEPTION 'Only a version in testing can be R&D-checked'; END IF;
      IF NOT (public.in_department(ARRAY['R&D']) OR v_admin) THEN
        RAISE EXCEPTION 'The R&D check is done by R&D' USING ERRCODE = '42501';
      END IF;
      IF OLD.created_by = auth.uid() THEN
        RAISE EXCEPTION 'You uploaded v%, so someone else in R&D has to check it', OLD.version USING ERRCODE = '42501';
      END IF;
      IF NEW.test_report_path IS NULL OR NEW.issue_list_path IS NULL THEN
        RAISE EXCEPTION 'Upload the testing report and the issue list before the R&D check of v%', NEW.version;
      END IF;
      NEW.rd_checked_by := auth.uid(); NEW.rd_checked_at := now();
    ELSIF NEW.status = 'APPROVED' THEN
      IF OLD.status <> 'RD_CHECKED' THEN RAISE EXCEPTION 'v% needs the R&D check before approval', OLD.version; END IF;
      IF NOT public.can_approve() THEN
        RAISE EXCEPTION 'Only Management or Admin approve software for production' USING ERRCODE = '42501';
      END IF;
      NEW.approved_by := auth.uid(); NEW.approved_at := now(); NEW.activated_at := now();
    ELSIF NEW.status = 'REJECTED' THEN
      IF OLD.status NOT IN ('TESTING', 'RD_CHECKED') THEN RAISE EXCEPTION 'Only a version not yet approved can be rejected'; END IF;
      IF NOT (public.can_approve() OR ((public.in_department(ARRAY['R&D']) OR v_admin) AND OLD.created_by IS DISTINCT FROM auth.uid())) THEN
        RAISE EXCEPTION 'Rejected by the R&D checker or Management' USING ERRCODE = '42501';
      END IF;
      IF NULLIF(btrim(NEW.decision_note), '') IS NULL THEN RAISE EXCEPTION 'Write why v% is rejected', NEW.version; END IF;
    ELSIF NEW.status = 'TESTING' THEN
      IF OLD.status <> 'REJECTED' THEN RAISE EXCEPTION 'Only a rejected version goes back to testing'; END IF;
      NEW.rd_checked_by := NULL; NEW.rd_checked_at := NULL;
    ELSIF NEW.status = 'WITHDRAWN' AND current_setting('app.software', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'A version is withdrawn by re-activating an older one';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_software_release_guard BEFORE INSERT OR UPDATE ON public.software_releases
  FOR EACH ROW EXECUTE FUNCTION public.software_release_guard();

-- Management puts an older approved version back in production. Every approved
-- version activated after it is withdrawn, with the reason.
CREATE OR REPLACE FUNCTION public.software_release_reactivate(p_release uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.software_releases;
BEGIN
  IF NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management or Admin re-activate software' USING ERRCODE = '42501'; END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Write why the older version goes back'; END IF;
  SELECT * INTO r FROM public.software_releases WHERE id = p_release FOR UPDATE;
  IF NOT FOUND OR r.status NOT IN ('APPROVED', 'WITHDRAWN') OR r.approved_at IS NULL THEN
    RAISE EXCEPTION 'Only a version that was approved can be re-activated';
  END IF;
  PERFORM set_config('app.software', 'on', true);
  UPDATE public.software_releases SET status = 'WITHDRAWN',
         decision_note = 'Withdrawn ' || to_char(public.ist_today(), 'DD-MM-YYYY') || ': v' || r.version || ' put back. ' || btrim(p_reason)
   WHERE part_id = r.part_id AND id <> r.id AND status = 'APPROVED' AND activated_at > COALESCE(r.activated_at, '-infinity');
  UPDATE public.software_releases SET status = 'APPROVED', activated_at = now(),
         decision_note = 'Re-activated ' || to_char(public.ist_today(), 'DD-MM-YYYY') || ': ' || btrim(p_reason)
   WHERE id = r.id;
  PERFORM set_config('app.software', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.software_release_reactivate(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.software_release_reactivate(uuid, text) TO authenticated;

ALTER TABLE public.software_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY software_releases_read ON public.software_releases FOR SELECT TO authenticated USING (public.can_edit_plm());
CREATE POLICY software_releases_insert ON public.software_releases FOR INSERT TO authenticated WITH CHECK (public.can_edit_plm());
CREATE POLICY software_releases_update ON public.software_releases FOR UPDATE TO authenticated USING (public.can_edit_plm()) WITH CHECK (public.can_edit_plm());
CREATE POLICY software_releases_delete ON public.software_releases FOR DELETE TO authenticated USING (public.can_edit_plm() AND status = 'TESTING');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_releases TO authenticated;

-- R&D's full history, with names.
CREATE VIEW public.software_release_history AS
SELECT r.*, p.part_code, p.name AS part_name, p.model_id, p.brand,
       cu.full_name AS created_by_name, ru.full_name AS rd_checked_by_name, au.full_name AS approved_by_name,
       (r.status = 'APPROVED' AND r.activated_at = max(r.activated_at) FILTER (WHERE r.status = 'APPROVED') OVER (PARTITION BY r.part_id)) AS in_production
  FROM public.software_releases r
  JOIN public.parts p ON p.id = r.part_id
  LEFT JOIN public.user_accounts cu ON cu.id = r.created_by
  LEFT JOIN public.user_accounts ru ON ru.id = r.rd_checked_by
  LEFT JOIN public.user_accounts au ON au.id = r.approved_by
 WHERE public.can_edit_plm();
GRANT SELECT ON public.software_release_history TO authenticated;

-- What everyone else may see: the version in production, its date and checksum.
CREATE VIEW public.software_in_production AS
SELECT DISTINCT ON (r.part_id) r.part_id, r.version, r.activated_at, r.approved_at, r.sha256, r.file_size
  FROM public.software_releases r
 WHERE r.status = 'APPROVED' AND public.has_role()
 ORDER BY r.part_id, r.activated_at DESC;
GRANT SELECT ON public.software_in_production TO authenticated;

-- R&D's firmware version follows: the brand codes' versions in production.
CREATE OR REPLACE FUNCTION public.software_release_to_plm() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_prod uuid; v_list text;
BEGIN
  SELECT m.plm_product_id INTO v_prod FROM public.parts b JOIN public.parts m ON m.id = b.model_id
   WHERE b.id = COALESCE(NEW.part_id, OLD.part_id);
  IF v_prod IS NULL THEN RETURN NULL; END IF;
  SELECT string_agg(p.brand || ' v' || s.version, ', ' ORDER BY p.brand) INTO v_list
    FROM public.parts m JOIN public.parts p ON p.model_id = m.id
    JOIN LATERAL (SELECT version FROM public.software_releases x WHERE x.part_id = p.id AND x.status = 'APPROVED'
                   ORDER BY activated_at DESC LIMIT 1) s ON true
   WHERE m.plm_product_id = v_prod;
  UPDATE public.plm_products SET firmware_version = v_list WHERE id = v_prod AND firmware_version IS DISTINCT FROM v_list;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_software_release_to_plm AFTER INSERT OR UPDATE OF status, activated_at OR DELETE ON public.software_releases
  FOR EACH ROW EXECUTE FUNCTION public.software_release_to_plm();
