-- Software, as agreed 16 Oct 2026 (empty table, so reshaped in place):
--
--   Base software   on the model, no brand, internal only:  B0.1, B0.2 … B1.0
--   Brand software  on each brand code, what is flashed:    1.0, 1.1 … 2.0
--                   records the base it is built on, the BOM version (model
--                   version) it is made for, and its brand settings: EQ, BT name,
--                   voice prompt.
--   The brand software stays linked to its BOM version until a newer one is
--   uploaded: an ECN that moves the brand to v1.1 does not change its software.
--   Base and brand can be worked on at the same time.
--
-- No locks yet (process still being settled): files can be replaced at any step,
-- the uploader may check, documents are reminders. What stays: R&D does the R&D
-- check, Management / Admin approves, a rejection has a reason, and the approved
-- brand version activated last is the one in production.

ALTER TABLE public.software_releases ALTER COLUMN part_id DROP NOT NULL;
ALTER TABLE public.software_releases
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'BRAND' CHECK (kind IN ('BASE', 'BRAND')),
  ADD COLUMN IF NOT EXISTS model_id uuid REFERENCES public.parts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS bom_version_id uuid REFERENCES public.item_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS base_release_id uuid REFERENCES public.software_releases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eq_profile text,
  ADD COLUMN IF NOT EXISTS bt_name text,
  ADD COLUMN IF NOT EXISTS voice_prompt text;
ALTER TABLE public.software_releases DROP CONSTRAINT IF EXISTS software_releases_kind_shape;
ALTER TABLE public.software_releases ADD CONSTRAINT software_releases_kind_shape CHECK (
  (kind = 'BASE' AND part_id IS NULL AND base_release_id IS NULL) OR (kind = 'BRAND' AND part_id IS NOT NULL));

DROP INDEX IF EXISTS public.software_releases_version_uq;
CREATE UNIQUE INDEX software_releases_brand_version_uq ON public.software_releases (part_id, lower(btrim(version))) WHERE kind = 'BRAND';
CREATE UNIQUE INDEX software_releases_base_version_uq ON public.software_releases (model_id, lower(btrim(version))) WHERE kind = 'BASE';
CREATE INDEX IF NOT EXISTS software_releases_model_idx ON public.software_releases (model_id, kind);

CREATE OR REPLACE FUNCTION public.software_release_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_admin boolean := EXISTS (SELECT 1 FROM public.user_accounts WHERE id = auth.uid() AND role = 'admin' AND is_active);
        v_model uuid;
BEGIN
  NEW.version := regexp_replace(btrim(NEW.version), '^[vVbB]\s*(?=[0-9])', '');
  IF TG_OP = 'INSERT' THEN
    IF NEW.kind = 'BRAND' THEN
      SELECT model_id INTO v_model FROM public.parts WHERE id = NEW.part_id AND source_type = 'FINISHED_GOOD';
      IF v_model IS NULL THEN RAISE EXCEPTION 'Brand software is uploaded on a brand code (JA-006-PH)'; END IF;
      NEW.model_id := v_model;
    ELSIF NOT EXISTS (SELECT 1 FROM public.parts WHERE id = NEW.model_id AND source_type = 'MODEL') THEN
      RAISE EXCEPTION 'Base software is uploaded on the model (JA-006)';
    END IF;
    NEW.status := 'TESTING';
    NEW.rd_checked_by := NULL; NEW.rd_checked_at := NULL; NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.activated_at := NULL;
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  ELSE
    NEW.updated_at := now(); NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
    IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.part_id IS DISTINCT FROM OLD.part_id OR NEW.model_id IS DISTINCT FROM OLD.model_id THEN
      RAISE EXCEPTION 'A version stays with its brand code or model; upload it again for another one';
    END IF;
    IF NEW.activated_at IS DISTINCT FROM OLD.activated_at AND current_setting('app.software', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Use Put back in production to re-activate an older version';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'RD_CHECKED' THEN
        IF NOT (public.in_department(ARRAY['R&D']) OR v_admin) THEN RAISE EXCEPTION 'The R&D check is done by R&D' USING ERRCODE = '42501'; END IF;
        NEW.rd_checked_by := auth.uid(); NEW.rd_checked_at := now();
      ELSIF NEW.status = 'APPROVED' AND OLD.status <> 'WITHDRAWN' THEN
        IF NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management or Admin approve software' USING ERRCODE = '42501'; END IF;
        NEW.approved_by := auth.uid(); NEW.approved_at := now();
        IF NEW.kind = 'BRAND' THEN NEW.activated_at := now(); END IF;
      ELSIF NEW.status = 'REJECTED' THEN
        IF NOT (public.can_edit_plm()) THEN RAISE EXCEPTION 'Rejected by R&D or Management' USING ERRCODE = '42501'; END IF;
        IF NULLIF(btrim(NEW.decision_note), '') IS NULL THEN RAISE EXCEPTION 'Write why v% is rejected', NEW.version; END IF;
      ELSIF NEW.status = 'TESTING' THEN
        NEW.rd_checked_by := NULL; NEW.rd_checked_at := NULL; NEW.approved_by := NULL; NEW.approved_at := NULL;
        IF current_setting('app.software', true) IS DISTINCT FROM 'on' THEN NEW.activated_at := OLD.activated_at; END IF;
      ELSIF NEW.status = 'WITHDRAWN' AND current_setting('app.software', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'A version is withdrawn by putting an older one back in production';
      END IF;
    END IF;
  END IF;
  -- The base a brand version is built on is a base of the same model.
  IF NEW.base_release_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.software_releases b WHERE b.id = NEW.base_release_id AND b.kind = 'BASE' AND b.model_id = NEW.model_id) THEN
    RAISE EXCEPTION 'Choose a base software of this model';
  END IF;
  IF NEW.bom_version_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.item_versions v WHERE v.id = NEW.bom_version_id AND v.item_id = NEW.model_id) THEN
    RAISE EXCEPTION 'Choose a BOM version of this model';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.software_release_reactivate(p_release uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.software_releases;
BEGIN
  IF NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management or Admin re-activate software' USING ERRCODE = '42501'; END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Write why the older version goes back'; END IF;
  SELECT * INTO r FROM public.software_releases WHERE id = p_release FOR UPDATE;
  IF NOT FOUND OR r.kind <> 'BRAND' OR r.status NOT IN ('APPROVED', 'WITHDRAWN') OR r.approved_at IS NULL THEN
    RAISE EXCEPTION 'Only a brand version that was approved can be put back in production';
  END IF;
  PERFORM set_config('app.software', 'on', true);
  UPDATE public.software_releases SET status = 'WITHDRAWN',
         decision_note = 'Withdrawn ' || to_char(public.ist_today(), 'DD-MM-YYYY') || ': v' || r.version || ' put back. ' || btrim(p_reason)
   WHERE part_id = r.part_id AND id <> r.id AND status = 'APPROVED' AND activated_at > COALESCE(r.activated_at, '-infinity');
  UPDATE public.software_releases SET status = 'APPROVED', activated_at = now(),
         decision_note = 'Put back ' || to_char(public.ist_today(), 'DD-MM-YYYY') || ': ' || btrim(p_reason)
   WHERE id = r.id;
  PERFORM set_config('app.software', 'off', true);
END $$;

DROP VIEW IF EXISTS public.software_release_history;
CREATE VIEW public.software_release_history AS
SELECT r.*, p.part_code, p.brand, p.model_version AS brand_bom_version,
       bv.version AS bom_version, br.version AS base_version,
       cu.full_name AS created_by_name, ru.full_name AS rd_checked_by_name, au.full_name AS approved_by_name,
       (r.kind = 'BRAND' AND r.status = 'APPROVED'
        AND r.activated_at = max(r.activated_at) FILTER (WHERE r.status = 'APPROVED') OVER (PARTITION BY r.part_id)) AS in_production
  FROM public.software_releases r
  LEFT JOIN public.parts p ON p.id = r.part_id
  LEFT JOIN public.item_versions bv ON bv.id = r.bom_version_id
  LEFT JOIN public.software_releases br ON br.id = r.base_release_id
  LEFT JOIN public.user_accounts cu ON cu.id = r.created_by
  LEFT JOIN public.user_accounts ru ON ru.id = r.rd_checked_by
  LEFT JOIN public.user_accounts au ON au.id = r.approved_by
 WHERE public.can_edit_plm();
GRANT SELECT ON public.software_release_history TO authenticated;

DROP VIEW IF EXISTS public.software_in_production;
CREATE VIEW public.software_in_production AS
SELECT DISTINCT ON (r.part_id) r.part_id, r.version, r.activated_at, r.approved_at, r.sha256, r.file_size,
       bv.version AS bom_version
  FROM public.software_releases r
  LEFT JOIN public.item_versions bv ON bv.id = r.bom_version_id
 WHERE r.kind = 'BRAND' AND r.status = 'APPROVED' AND public.has_role()
 ORDER BY r.part_id, r.activated_at DESC;
GRANT SELECT ON public.software_in_production TO authenticated;

-- R&D's firmware field: brand versions in production.
CREATE OR REPLACE FUNCTION public.software_release_to_plm() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_prod uuid; v_list text;
BEGIN
  SELECT plm_product_id INTO v_prod FROM public.parts WHERE id = COALESCE(NEW.model_id, OLD.model_id);
  IF v_prod IS NULL THEN RETURN NULL; END IF;
  SELECT string_agg(p.brand || ' v' || s.version, ', ' ORDER BY p.brand) INTO v_list
    FROM public.parts m JOIN public.parts p ON p.model_id = m.id
    JOIN LATERAL (SELECT version FROM public.software_releases x WHERE x.part_id = p.id AND x.kind = 'BRAND' AND x.status = 'APPROVED'
                   ORDER BY activated_at DESC LIMIT 1) s ON true
   WHERE m.plm_product_id = v_prod;
  UPDATE public.plm_products SET firmware_version = v_list WHERE id = v_prod AND firmware_version IS DISTINCT FROM v_list;
  RETURN NULL;
END $$;
