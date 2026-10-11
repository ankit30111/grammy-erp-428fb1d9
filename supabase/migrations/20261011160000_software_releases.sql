-- Software testing and release, run from R&D for every product:
--   1. software file uploaded   2. version   3. testing report (file)
--   4. issue list (file)        5. approved for production (Management / Admin)
-- Approved releases show on the finished goods of the model; the newest approved
-- one is the software in production. Replaces the named-software list of
-- 11 Oct (empty), which treated software as a list of chips rather than files.

DROP VIEW IF EXISTS public.model_software_history;
DROP TABLE IF EXISTS public.model_software_versions;
DROP TABLE IF EXISTS public.model_software;
DROP FUNCTION IF EXISTS public.model_software_check();
DROP FUNCTION IF EXISTS public.model_software_versions_touch();

CREATE TABLE IF NOT EXISTS public.software_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  version text NOT NULL CHECK (btrim(version) <> ''),
  file_path text NOT NULL,
  file_name text NOT NULL,
  test_report_path text,
  test_report_name text,
  issue_list_path text,
  issue_list_name text,
  details text,
  status text NOT NULL DEFAULT 'TESTING' CHECK (status IN ('TESTING', 'APPROVED', 'REJECTED')),
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS software_releases_version_uq ON public.software_releases (model_id, lower(btrim(version)));
CREATE INDEX IF NOT EXISTS software_releases_model_idx ON public.software_releases (model_id, status);

CREATE OR REPLACE FUNCTION public.software_release_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  NEW.version := regexp_replace(btrim(NEW.version), '^[vV](?=[0-9])', '');
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.parts WHERE id = NEW.model_id AND source_type = 'MODEL') THEN
      RAISE EXCEPTION 'Software is released for a model (JA-006), not a brand code or part';
    END IF;
    NEW.status := 'TESTING'; NEW.decided_by := NULL; NEW.decided_at := NULL;
    RETURN NEW;
  END IF;

  NEW.updated_at := now(); NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  -- A decided release keeps its files and version: what was approved is what runs.
  IF OLD.status <> 'TESTING' AND (NEW.version IS DISTINCT FROM OLD.version OR NEW.file_path IS DISTINCT FROM OLD.file_path
       OR NEW.test_report_path IS DISTINCT FROM OLD.test_report_path OR NEW.issue_list_path IS DISTINCT FROM OLD.issue_list_path) THEN
    RAISE EXCEPTION 'v% is already %, its files cannot change. Upload a new version.', OLD.version, lower(OLD.status);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.can_approve() THEN
      RAISE EXCEPTION 'Only Management or Admin approve software for production' USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'APPROVED' AND (NEW.test_report_path IS NULL OR NEW.issue_list_path IS NULL) THEN
      RAISE EXCEPTION 'Upload the testing report and the issue list before approving v%', NEW.version;
    END IF;
    IF NEW.status = 'REJECTED' AND NULLIF(btrim(NEW.decision_note), '') IS NULL THEN
      RAISE EXCEPTION 'Write why v% is rejected', NEW.version;
    END IF;
    IF NEW.status = 'TESTING' THEN NEW.decided_by := NULL; NEW.decided_at := NULL;
    ELSE NEW.decided_by := auth.uid(); NEW.decided_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_software_release_guard ON public.software_releases;
CREATE TRIGGER trg_software_release_guard BEFORE INSERT OR UPDATE ON public.software_releases
  FOR EACH ROW EXECUTE FUNCTION public.software_release_guard();

-- R&D's "firmware version (frozen)" follows the software in production.
CREATE OR REPLACE FUNCTION public.software_release_to_plm() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_prod uuid; v_ver text;
BEGIN
  SELECT plm_product_id INTO v_prod FROM public.parts WHERE id = COALESCE(NEW.model_id, OLD.model_id);
  IF v_prod IS NULL THEN RETURN NULL; END IF;
  SELECT version INTO v_ver FROM public.software_releases
   WHERE model_id = COALESCE(NEW.model_id, OLD.model_id) AND status = 'APPROVED'
   ORDER BY decided_at DESC LIMIT 1;
  UPDATE public.plm_products SET firmware_version = v_ver WHERE id = v_prod AND firmware_version IS DISTINCT FROM v_ver;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_software_release_to_plm ON public.software_releases;
CREATE TRIGGER trg_software_release_to_plm AFTER INSERT OR UPDATE OF status OR DELETE ON public.software_releases
  FOR EACH ROW EXECUTE FUNCTION public.software_release_to_plm();

ALTER TABLE public.software_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS software_releases_read ON public.software_releases;
DROP POLICY IF EXISTS software_releases_insert ON public.software_releases;
DROP POLICY IF EXISTS software_releases_update ON public.software_releases;
DROP POLICY IF EXISTS software_releases_delete ON public.software_releases;
CREATE POLICY software_releases_read ON public.software_releases FOR SELECT TO authenticated USING (public.has_role());
CREATE POLICY software_releases_insert ON public.software_releases FOR INSERT TO authenticated WITH CHECK (public.can_edit_plm());
CREATE POLICY software_releases_update ON public.software_releases FOR UPDATE TO authenticated USING (public.can_edit_plm()) WITH CHECK (public.can_edit_plm());
-- Only a release still in testing can be removed; approved ones are history.
CREATE POLICY software_releases_delete ON public.software_releases FOR DELETE TO authenticated USING (public.can_edit_plm() AND status = 'TESTING');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.software_releases TO authenticated;

-- Names for the history (logins are readable only by their owner).
CREATE OR REPLACE VIEW public.software_release_history AS
SELECT r.*, m.part_code AS model_code,
       cu.full_name AS created_by_name, du.full_name AS decided_by_name, uu.full_name AS updated_by_name,
       (r.status = 'APPROVED' AND r.decided_at = max(r.decided_at) FILTER (WHERE r.status = 'APPROVED') OVER (PARTITION BY r.model_id)) AS in_production
  FROM public.software_releases r
  JOIN public.parts m ON m.id = r.model_id
  LEFT JOIN public.user_accounts cu ON cu.id = r.created_by
  LEFT JOIN public.user_accounts du ON du.id = r.decided_by
  LEFT JOIN public.user_accounts uu ON uu.id = r.updated_by
 WHERE public.has_role();
GRANT SELECT ON public.software_release_history TO authenticated;
