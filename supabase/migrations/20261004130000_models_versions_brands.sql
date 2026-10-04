-- Model -> version -> brand.
--
--   JA-006            the model: category JA, number 006. Its identity, in parts.
--     v1.0, v1.1 ...  its master BOM per version. A hardware change is an ECN and
--                     makes the next minor version; a redesign is the next major.
--       JA-006-PH     a brand code: built on one version of the model, plus its
--       JA-006-CR     own cosmetic lines (box, stickers, logo, manual).
--
-- A brand's production BOM stays in bom, as before, so nothing that builds,
-- issues or schedules changes. The model's BOM per version is in model_versions;
-- moving a brand to a newer version applies the difference between the two
-- versions to the brand's BOM and leaves its cosmetic lines alone.

-- 1. Columns ---------------------------------------------------------------
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS model_id uuid REFERENCES public.parts(id),
  ADD COLUMN IF NOT EXISTS model_version text;
CREATE INDEX IF NOT EXISTS parts_model_id_idx ON public.parts(model_id);
COMMENT ON COLUMN public.parts.model_id IS 'Brand code -> its model (JA-006-PH -> JA-006). Set from the code.';
COMMENT ON COLUMN public.parts.model_version IS 'Brand code: the model version it is built on. Model: its latest released version.';

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS model_version text;
COMMENT ON COLUMN public.production_orders.model_version IS 'Model version the finished good was on when the voucher was made.';

-- 2. Versions --------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.seq_ecn;
CREATE TABLE IF NOT EXISTS public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  major int NOT NULL CHECK (major >= 1),
  minor int NOT NULL CHECK (minor >= 0),
  version text GENERATED ALWAYS AS (major::text || '.' || minor::text) STORED,
  kind text NOT NULL CHECK (kind IN ('INITIAL', 'ECN', 'MAJOR')),
  ecn_no text UNIQUE,
  reason text,
  based_on uuid REFERENCES public.model_versions(id),
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'RELEASED')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  released_by uuid,
  released_at timestamptz,
  UNIQUE (model_id, major, minor)
);
CREATE UNIQUE INDEX IF NOT EXISTS model_versions_one_draft ON public.model_versions(model_id) WHERE status = 'DRAFT';
COMMENT ON TABLE public.model_versions IS 'Master BOM of a model per version (1.0, 1.1 by ECN, 2.0 redesign). Lines are base parts; brands add cosmetics.';
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS model_versions_read ON public.model_versions;
CREATE POLICY model_versions_read ON public.model_versions FOR SELECT USING (public.has_role());
REVOKE ALL ON public.model_versions FROM anon;
GRANT SELECT ON public.model_versions TO authenticated;

-- 3. Codes: a model is CAT-NUMBER, a brand code CAT-NUMBER-BR ---------------
CREATE OR REPLACE FUNCTION public.parts_enforce_category()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_kind public.part_source_type; v_tier text; v_model boolean := false;
  v_sync boolean := coalesce(current_setting('app.brand_sync', true), '') = 'on';
BEGIN
  SELECT kind, tier INTO v_kind, v_tier FROM public.part_categories WHERE prefix = NEW.category;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part category "%" is not in the part code registry. Add it under Parts first.', NEW.category;
  END IF;

  IF NOT v_sync AND auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' AND (NEW.branded_from IS NOT NULL OR NEW.branding_required) THEN
      RAISE EXCEPTION 'Brand versions are created from the base part''s Branding setting' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.branded_from IS DISTINCT FROM OLD.branded_from
                             OR NEW.branding_required IS DISTINCT FROM OLD.branding_required
                             OR NEW.brand_relevant IS DISTINCT FROM OLD.brand_relevant
                             OR (OLD.branded_from IS NOT NULL AND NEW.brand IS DISTINCT FROM OLD.brand)
                             OR (OLD.branded_from IS NOT NULL AND NEW.part_code IS DISTINCT FROM OLD.part_code)) THEN
      RAISE EXCEPTION 'Branding is changed from the Branding section of the base part' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.made_in_house AND v_tier <> 'PURCHASE' THEN
    NEW.made_in_house := false;
  END IF;
  IF NOT v_sync AND ((TG_OP = 'INSERT' AND NEW.made_in_house) OR (TG_OP = 'UPDATE' AND NEW.made_in_house IS DISTINCT FROM OLD.made_in_house)) THEN
    IF auth.uid() IS NOT NULL AND NOT public.can_approve() THEN
      RAISE EXCEPTION 'Only Management or Admin can mark a purchase code as made in-house' USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.part_code := upper(btrim(NEW.part_code));
  v_model := v_tier = 'FINISHED' AND NEW.part_code ~ ('^' || NEW.category || '-[A-Z0-9]+$');
  NEW.source_type := CASE WHEN v_model THEN 'MODEL'::public.part_source_type
                          WHEN NEW.made_in_house THEN 'ASSEMBLED_STOCKED'::public.part_source_type ELSE v_kind END;
  NEW.brand := CASE WHEN v_model THEN NULL
                    WHEN v_tier = 'FINISHED' THEN right(NEW.part_code, 2)
                    WHEN NEW.branded_from IS NOT NULL THEN NEW.brand END;
  IF TG_OP = 'INSERT' OR NEW.part_code IS DISTINCT FROM OLD.part_code THEN
    IF v_tier = 'FINISHED' AND NOT v_model THEN
      IF NEW.part_code !~ ('^' || NEW.category || '-[A-Z0-9]+-[A-Z]{2}$') THEN
        RAISE EXCEPTION 'A finished-good code is category-model-brand, e.g. %-06C-PH; a model is category-number, e.g. %-016. "%" is neither.',
          NEW.category, NEW.category, NEW.part_code;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.brands WHERE letter = NEW.brand) THEN
        RAISE EXCEPTION '"%" is not a registered brand. Add it on the create form first.', NEW.brand;
      END IF;
    ELSIF v_tier <> 'FINISHED' AND NEW.part_code !~ ('^' || NEW.category || '-[A-Z0-9][A-Z0-9-]*$') THEN
      RAISE EXCEPTION 'Part code "%" must start with "%-"', NEW.part_code, NEW.category;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.source_type = 'MODEL') IS DISTINCT FROM (NEW.source_type = 'MODEL') THEN
    RAISE EXCEPTION 'A model cannot become a brand code or the other way round. Create the other one instead.';
  END IF;
  RETURN NEW;
END $function$;

-- Next model number of a category. Each category counts on its own. The
-- category's next_sequence is a floor, for numbers given out before the ERP.
CREATE OR REPLACE FUNCTION public.model_next_code(p_category text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_cat text := upper(btrim(p_category)); v_seq int; v_code text;
BEGIN
  SELECT next_sequence INTO v_seq FROM public.part_categories WHERE prefix = v_cat AND tier = 'FINISHED' AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'No finished-good category "%"', v_cat; END IF;
  SELECT greatest(v_seq, coalesce(max((regexp_match(part_code, '^' || v_cat || '-([0-9]+)(-|$)'))[1]::int), 0) + 1)
    INTO v_seq FROM public.parts WHERE category = v_cat;
  LOOP
    v_code := v_cat || '-' || lpad(v_seq::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.parts WHERE part_code = v_code OR part_code LIKE v_code || '-%')
          AND NOT EXISTS (SELECT 1 FROM public.plm_products WHERE product_code = v_code);
    v_seq := v_seq + 1;
  END LOOP;
  RETURN v_code;
END $function$;
REVOKE ALL ON FUNCTION public.model_next_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.model_next_code(text) TO authenticated;

-- 4. Brand code -> its model, created if it does not exist yet --------------
CREATE OR REPLACE FUNCTION public.parts_link_model()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_code text; v_model uuid; v_num int; v_cat text;
BEGIN
  IF NEW.source_type = 'MODEL' THEN
    NEW.model_id := NULL;
    NEW.approval_status := 'APPROVED';   -- an identity, not a master to approve
    v_num := (regexp_match(NEW.part_code, '^[A-Z]{2}-([0-9]+)$'))[1]::int;
    IF v_num IS NOT NULL THEN
      UPDATE public.part_categories SET next_sequence = v_num + 1, updated_at = now()
       WHERE prefix = NEW.category AND next_sequence <= v_num;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.source_type <> 'FINISHED_GOOD' OR NEW.branded_from IS NOT NULL THEN
    NEW.model_id := NULL; NEW.model_version := NULL;
    RETURN NEW;
  END IF;

  v_code := substring(NEW.part_code FROM '^(.*)-[A-Z]{2}$');
  SELECT id INTO v_model FROM public.parts WHERE part_code = v_code;
  IF v_model IS NULL THEN
    SELECT name INTO v_cat FROM public.part_categories WHERE prefix = NEW.category;
    INSERT INTO public.parts (part_code, name, category, uom, plm_product_id)
    VALUES (v_code, coalesce(v_cat, NEW.category) || ' ' || substring(v_code FROM '-(.*)$'), NEW.category, 'PCS', NEW.plm_product_id)
    RETURNING id INTO v_model;
    INSERT INTO public.model_versions (model_id, major, minor, kind, reason)
    VALUES (v_model, 1, 0, 'INITIAL', 'First version');
  END IF;
  IF TG_OP = 'INSERT' OR NEW.model_id IS DISTINCT FROM v_model THEN
    NEW.model_id := v_model;
    NEW.model_version := coalesce(
      (SELECT version FROM public.model_versions WHERE model_id = v_model AND status = 'RELEASED' ORDER BY major DESC, minor DESC LIMIT 1),
      (SELECT version FROM public.model_versions WHERE model_id = v_model ORDER BY major DESC, minor DESC LIMIT 1));
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_parts_zz_link_model ON public.parts;
CREATE TRIGGER trg_parts_zz_link_model BEFORE INSERT OR UPDATE OF part_code, category ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.parts_link_model();

-- A model's BOM is per version, never in bom; a model never goes into a BOM.
CREATE OR REPLACE FUNCTION public.bom_parent_must_be_made()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE st public.part_source_type;
BEGIN
  SELECT source_type INTO st FROM public.parts WHERE id = NEW.parent_part_id;
  IF st = 'PURCHASED' THEN
    RAISE EXCEPTION 'A purchased part cannot have a bill of materials';
  END IF;
  IF st = 'MODEL' THEN
    RAISE EXCEPTION 'A model''s BOM is kept per version. Change it on the Models page (an ECN once it is released).';
  END IF;
  IF (SELECT source_type FROM public.parts WHERE id = NEW.child_part_id) = 'MODEL' THEN
    RAISE EXCEPTION 'A model is not a part; put a brand code into the BOM instead';
  END IF;
  RETURN NEW;
END; $function$;

-- 5. Vouchers record the model version -------------------------------------
CREATE OR REPLACE FUNCTION public.production_order_model_version()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.part_id IS DISTINCT FROM OLD.part_id THEN
    NEW.model_version := (SELECT model_version FROM public.parts WHERE id = NEW.part_id AND source_type = 'FINISHED_GOOD');
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_production_order_model_version ON public.production_orders;
CREATE TRIGGER trg_production_order_model_version BEFORE INSERT OR UPDATE OF part_id ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.production_order_model_version();

-- 6. Working with versions ---------------------------------------------------
-- Lines are kept as base parts: a brand's printed version is swapped in on the
-- brand code. Same shape as save_bom: child_part_id, quantity, bulk, is_critical.
CREATE OR REPLACE FUNCTION public.model_clean_lines(p_model uuid, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_out jsonb; v_dup text; v_bad text;
BEGIN
  IF jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'BOM lines must be a list'; END IF;
  SELECT string_agg(p.part_code, ', ') INTO v_bad
    FROM jsonb_array_elements(p_lines) l JOIN public.parts p ON p.id = (l->>'child_part_id')::uuid
   WHERE p.source_type IN ('MODEL', 'FINISHED_GOOD') OR p.id = p_model;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Not a part that goes into a model: %', v_bad; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_lines) l
              WHERE NOT coalesce((l->>'bulk')::boolean, false) AND coalesce((l->>'quantity')::numeric, 0) <= 0) THEN
    RAISE EXCEPTION 'Every line needs a quantity above zero (or is marked bulk)';
  END IF;
  WITH n AS (
    SELECT coalesce(p.branded_from, p.id) AS child, l
      FROM jsonb_array_elements(p_lines) l JOIN public.parts p ON p.id = (l->>'child_part_id')::uuid)
  SELECT string_agg(DISTINCT b.part_code, ', ') INTO v_dup
    FROM (SELECT child FROM n GROUP BY 1 HAVING count(*) > 1) d JOIN public.parts b ON b.id = d.child;
  IF v_dup IS NOT NULL THEN RAISE EXCEPTION 'Listed twice (counting brand versions as their base part): %', v_dup; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'child_part_id', coalesce(p.branded_from, p.id),
           'quantity', CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN NULL ELSE (l->>'quantity')::numeric END,
           'bulk', coalesce((l->>'bulk')::boolean, false),
           'is_critical', coalesce((l->>'is_critical')::boolean, false)) ORDER BY b.part_code), '[]'::jsonb)
    INTO v_out
    FROM jsonb_array_elements(p_lines) l JOIN public.parts p ON p.id = (l->>'child_part_id')::uuid
    JOIN public.parts b ON b.id = coalesce(p.branded_from, p.id);
  RETURN v_out;
END $function$;

CREATE OR REPLACE FUNCTION public.model_create(p_category text, p_code text, p_name text,
  p_plm_product uuid DEFAULT NULL, p_copy_from uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_id uuid; v_code text := upper(btrim(coalesce(p_code, ''))); v_cat text := upper(btrim(p_category));
BEGIN
  IF NOT (public.can_edit_masters() OR public.can_edit_plm()) THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can create a model' USING ERRCODE = '42501';
  END IF;
  IF v_code = '' THEN v_code := public.model_next_code(v_cat); END IF;
  IF v_code !~ ('^' || v_cat || '-[A-Z0-9]+$') THEN
    RAISE EXCEPTION 'A model code is category-number, e.g. %-016. "%" is not.', v_cat, v_code;
  END IF;
  IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = v_code OR part_code LIKE v_code || '-%') THEN
    RAISE EXCEPTION '% is already used', v_code;
  END IF;
  INSERT INTO public.parts (part_code, name, category, uom, plm_product_id)
  VALUES (v_code, coalesce(nullif(btrim(p_name), ''), v_code), v_cat, 'PCS', p_plm_product)
  RETURNING id INTO v_id;
  INSERT INTO public.model_versions (model_id, major, minor, kind, reason, based_on, lines)
  VALUES (v_id, 1, 0, 'INITIAL', 'First version', p_copy_from,
          coalesce((SELECT lines FROM public.model_versions WHERE id = p_copy_from), '[]'::jsonb));
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.model_version_save(p_version uuid, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v record; v_lines jsonb;
BEGIN
  IF NOT (public.can_edit_masters() OR public.can_edit_plm()) THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can change a model''s BOM' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.model_versions WHERE id = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found'; END IF;
  IF v.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'v% is released and cannot change. Raise an ECN for the change.', v.version;
  END IF;
  v_lines := public.model_clean_lines(v.model_id, p_lines);
  UPDATE public.model_versions SET lines = v_lines, updated_at = now() WHERE id = p_version;
  RETURN jsonb_build_object('lines', jsonb_array_length(v_lines));
END $function$;

CREATE OR REPLACE FUNCTION public.model_version_release(p_version uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v record;
BEGIN
  IF NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin release a model version' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.model_versions WHERE id = p_version FOR UPDATE;
  IF NOT FOUND OR v.status <> 'DRAFT' THEN RAISE EXCEPTION 'Only a draft version is released'; END IF;
  IF jsonb_array_length(v.lines) = 0 THEN RAISE EXCEPTION 'v% has no BOM lines yet', v.version; END IF;
  IF v.kind <> 'INITIAL' AND coalesce(btrim(v.reason), '') = '' THEN
    RAISE EXCEPTION 'Write the reason for % before releasing it', coalesce(v.ecn_no, 'this version');
  END IF;
  UPDATE public.model_versions SET status = 'RELEASED', released_by = auth.uid(), released_at = now(), updated_at = now()
   WHERE id = p_version;
  PERFORM set_config('app.approving', 'on', true);
  UPDATE public.parts SET model_version = v.version WHERE id = v.model_id;
  PERFORM set_config('app.approving', 'off', true);
END $function$;

CREATE OR REPLACE FUNCTION public.model_raise_ecn(p_model uuid, p_reason text, p_major boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_last record; v_id uuid;
BEGIN
  IF NOT (public.can_edit_masters() OR public.can_edit_plm()) THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can raise an ECN' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.model_versions WHERE model_id = p_model AND status = 'DRAFT') THEN
    RAISE EXCEPTION 'This model already has a version in draft. Finish or discard it first.';
  END IF;
  SELECT * INTO v_last FROM public.model_versions WHERE model_id = p_model AND status = 'RELEASED'
   ORDER BY major DESC, minor DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release the first version before raising an ECN on it'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'Write what changes and why'; END IF;
  INSERT INTO public.model_versions (model_id, major, minor, kind, ecn_no, reason, based_on, lines)
  VALUES (p_model,
          CASE WHEN p_major THEN (SELECT max(major) + 1 FROM public.model_versions WHERE model_id = p_model) ELSE v_last.major END,
          CASE WHEN p_major THEN 0 ELSE (SELECT max(minor) + 1 FROM public.model_versions WHERE model_id = p_model AND major = v_last.major) END,
          CASE WHEN p_major THEN 'MAJOR' ELSE 'ECN' END,
          'ECN-' || lpad(nextval('public.seq_ecn')::text, 4, '0'),
          btrim(p_reason), v_last.id, v_last.lines)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.model_version_discard(p_version uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v record;
BEGIN
  IF NOT (public.can_edit_masters() OR public.can_edit_plm()) THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can discard a draft' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.model_versions WHERE id = p_version;
  IF NOT FOUND OR v.status <> 'DRAFT' OR v.kind = 'INITIAL' THEN
    RAISE EXCEPTION 'Only a drafted ECN or redesign can be discarded';
  END IF;
  DELETE FROM public.model_versions WHERE id = p_version;
END $function$;

-- The brand's BOM after moving it to a version: lines the model dropped go,
-- lines it added come, quantities it changed follow. A brand line that the
-- model never had (its cosmetics) is left alone, and so is a quantity the
-- brand had deliberately different from the old version.
CREATE OR REPLACE FUNCTION public.model_brand_lines(p_brand uuid, p_target uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH br AS (SELECT * FROM public.parts WHERE id = p_brand),
  fromv AS (
    SELECT (l->>'child_part_id')::uuid AS k, l
      FROM br JOIN public.model_versions v ON v.model_id = br.model_id AND v.version = br.model_version
      CROSS JOIN jsonb_array_elements(v.lines) l
     WHERE v.id <> p_target),
  tov AS (SELECT (l->>'child_part_id')::uuid AS k, l FROM public.model_versions v, jsonb_array_elements(v.lines) l WHERE v.id = p_target),
  cur AS (
    SELECT coalesce(c.branded_from, c.id) AS k, b.child_part_id, b.quantity, b.issue_mode = 'BULK' AS bulk, b.is_critical
      FROM public.bom b JOIN public.parts c ON c.id = b.child_part_id
     WHERE b.parent_part_id = p_brand AND b.is_active),
  kept AS (
    SELECT jsonb_build_object('child_part_id', cur.child_part_id,
             'quantity', CASE WHEN t.k IS NOT NULL AND (f.k IS NULL OR f.l IS DISTINCT FROM t.l)
                              THEN (t.l->>'quantity')::numeric ELSE cur.quantity END,
             'bulk', CASE WHEN t.k IS NOT NULL AND (f.k IS NULL OR f.l IS DISTINCT FROM t.l)
                          THEN coalesce((t.l->>'bulk')::boolean, false) ELSE cur.bulk END,
             'is_critical', CASE WHEN t.k IS NOT NULL THEN coalesce((t.l->>'is_critical')::boolean, false) OR cur.is_critical ELSE cur.is_critical END) AS line
      FROM cur LEFT JOIN fromv f ON f.k = cur.k LEFT JOIN tov t ON t.k = cur.k
     WHERE NOT (f.k IS NOT NULL AND t.k IS NULL)),
  added AS (
    SELECT t.l AS line FROM tov t WHERE NOT EXISTS (SELECT 1 FROM cur WHERE cur.k = t.k))
  SELECT coalesce(jsonb_agg(line), '[]'::jsonb) FROM (SELECT line FROM kept UNION ALL SELECT line FROM added) x
$function$;

CREATE OR REPLACE FUNCTION public.model_move_brand(p_brand uuid, p_version uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE br record; v record; v_res jsonb;
BEGIN
  SELECT * INTO br FROM public.parts WHERE id = p_brand AND source_type = 'FINISHED_GOOD';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not a brand code'; END IF;
  SELECT * INTO v FROM public.model_versions WHERE id = p_version;
  IF NOT FOUND OR v.model_id IS DISTINCT FROM br.model_id THEN RAISE EXCEPTION 'That version is not of % ''s model', br.part_code; END IF;
  IF v.status <> 'RELEASED' AND NOT (v.kind = 'INITIAL' AND br.model_version IS NOT DISTINCT FROM v.version) THEN
    RAISE EXCEPTION 'v% is still a draft. Release it before moving brands onto it.', v.version;
  END IF;
  IF NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin move a brand to another version' USING ERRCODE = '42501';
  END IF;
  -- Management moving the brand is the approval, so it applies even when the
  -- R&D product is frozen (save_bom would turn it into a change request).
  v_res := public.apply_bom(p_brand, public.model_brand_lines(p_brand, p_version)) || jsonb_build_object('applied', true);
  PERFORM set_config('app.approving', 'on', true);
  UPDATE public.parts SET model_version = v.version WHERE id = p_brand;
  PERFORM set_config('app.approving', 'off', true);
  RETURN v_res;
END $function$;

-- A new brand code on a model, its BOM started from the model version.
CREATE OR REPLACE FUNCTION public.model_add_brand(p_model uuid, p_brand text, p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE m record; v_id uuid; v_code text; v_res jsonb := '{}'::jsonb; v_ver text; v_lines jsonb;
BEGIN
  IF NOT (public.can_edit_masters() OR public.can_edit_plm()) THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can add a brand' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO m FROM public.parts WHERE id = p_model AND source_type = 'MODEL';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not a model'; END IF;
  v_code := m.part_code || '-' || upper(btrim(p_brand));
  IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = v_code) THEN RAISE EXCEPTION '% already exists', v_code; END IF;
  INSERT INTO public.parts (part_code, name, category, uom, plm_product_id)
  VALUES (v_code, coalesce(nullif(btrim(p_name), ''), m.name), m.category, 'PCS', m.plm_product_id)
  RETURNING id INTO v_id;
  SELECT mv.version, mv.lines INTO v_ver, v_lines FROM public.model_versions mv, public.parts p
   WHERE p.id = v_id AND mv.model_id = p_model AND mv.version = p.model_version;
  IF coalesce(jsonb_array_length(v_lines), 0) > 0 THEN
    v_res := CASE WHEN public.can_approve() THEN public.apply_bom(v_id, v_lines) || jsonb_build_object('applied', true)
                  ELSE public.save_bom(v_id, v_lines) END;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'part_code', v_code, 'version', v_ver, 'bom', v_res);
END $function$;

-- Existing brand code whose BOM is empty: start it from its version.
CREATE OR REPLACE FUNCTION public.model_fill_brand(p_brand uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE br record; v_lines jsonb;
BEGIN
  SELECT * INTO br FROM public.parts WHERE id = p_brand AND source_type = 'FINISHED_GOOD';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not a brand code'; END IF;
  IF EXISTS (SELECT 1 FROM public.bom WHERE parent_part_id = p_brand AND is_active) THEN
    RAISE EXCEPTION '% already has a BOM', br.part_code;
  END IF;
  SELECT lines INTO v_lines FROM public.model_versions WHERE model_id = br.model_id AND version = br.model_version;
  IF coalesce(jsonb_array_length(v_lines), 0) = 0 THEN RETURN jsonb_build_object('applied', false, 'empty', true); END IF;
  RETURN public.save_bom(p_brand, v_lines);
END $function$;

REVOKE ALL ON FUNCTION public.model_clean_lines(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.model_brand_lines(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.model_brand_lines(uuid, uuid) TO authenticated;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['model_create(text,text,text,uuid,uuid)', 'model_version_save(uuid,jsonb)',
    'model_version_release(uuid)', 'model_raise_ecn(uuid,text,boolean)', 'model_version_discard(uuid)',
    'model_move_brand(uuid,uuid)', 'model_add_brand(uuid,text,text)', 'model_fill_brand(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- 7. R&D: a project's ID is its model number, and the model is in parts -----
CREATE OR REPLACE FUNCTION public.plm_product_model()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_cat text; v_model uuid; v_owner uuid;
BEGIN
  v_cat := substring(NEW.product_code FROM '^([A-Z]{2})-[A-Z0-9]+$');
  IF v_cat IS NULL OR NOT EXISTS (SELECT 1 FROM public.part_categories WHERE prefix = v_cat AND tier = 'FINISHED') THEN
    RETURN NULL;
  END IF;
  SELECT id, plm_product_id INTO v_model, v_owner FROM public.parts WHERE part_code = NEW.product_code AND source_type = 'MODEL';
  IF v_model IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = NEW.product_code) THEN RETURN NULL; END IF;
    INSERT INTO public.parts (part_code, name, category, uom, plm_product_id)
    VALUES (NEW.product_code, NEW.name, v_cat, 'PCS', NEW.id) RETURNING id INTO v_model;
    INSERT INTO public.model_versions (model_id, major, minor, kind, reason) VALUES (v_model, 1, 0, 'INITIAL', 'First version');
  ELSIF v_owner IS NULL THEN
    PERFORM set_config('app.approving', 'on', true);
    UPDATE public.parts SET plm_product_id = NEW.id WHERE id = v_model;
    PERFORM set_config('app.approving', 'off', true);
  END IF;
  RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS trg_plm_product_model ON public.plm_products;
CREATE TRIGGER trg_plm_product_model AFTER INSERT OR UPDATE OF product_code ON public.plm_products
  FOR EACH ROW EXECUTE FUNCTION public.plm_product_model();

-- Publishing R&D's BOM: to the model's version when the product has a model.
-- Before release that is v1.0's draft; after, R&D's BOM becomes an ECN draft
-- that Management releases.
CREATE OR REPLACE FUNCTION public.plm_publish_bom(p_product uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_lines jsonb; v_fg record; v_out jsonb := '[]'::jsonb; v_missing text; v_model record; v_ver uuid;
BEGIN
  IF NOT public.can_edit_plm() AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Only R&D can publish the BOM' USING ERRCODE = '42501';
  END IF;
  SELECT string_agg(description, ', ') INTO v_missing FROM public.plm_bom_lines WHERE product_id = p_product AND part_id IS NULL;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'These lines have no part code yet: %', v_missing; END IF;
  SELECT jsonb_agg(jsonb_build_object('child_part_id', part_id, 'quantity', quantity, 'bulk', bulk, 'is_critical', is_critical))
    INTO v_lines FROM public.plm_bom_lines WHERE product_id = p_product;
  IF v_lines IS NULL THEN RAISE EXCEPTION 'The BOM is empty'; END IF;

  SELECT id, part_code INTO v_model FROM public.parts
   WHERE plm_product_id = p_product AND source_type = 'MODEL' AND is_active ORDER BY created_at LIMIT 1;
  IF v_model.id IS NOT NULL THEN
    SELECT id INTO v_ver FROM public.model_versions WHERE model_id = v_model.id AND status = 'DRAFT';
    IF v_ver IS NULL AND NOT EXISTS (SELECT 1 FROM public.model_versions WHERE model_id = v_model.id) THEN
      INSERT INTO public.model_versions (model_id, major, minor, kind, reason) VALUES (v_model.id, 1, 0, 'INITIAL', 'First version')
      RETURNING id INTO v_ver;
    ELSIF v_ver IS NULL THEN
      v_ver := public.model_raise_ecn(v_model.id, 'BOM published from R&D ' || (SELECT product_code FROM public.plm_products WHERE id = p_product));
    END IF;
    UPDATE public.model_versions SET lines = public.model_clean_lines(v_model.id, v_lines), updated_at = now() WHERE id = v_ver;
    UPDATE public.plm_products SET bom_published_at = now() WHERE id = p_product;
    RETURN jsonb_build_array(jsonb_build_object('part_code', v_model.part_code,
      'result', jsonb_build_object('applied', true, 'version', (SELECT version FROM public.model_versions WHERE id = v_ver))));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.parts WHERE plm_product_id = p_product AND is_active AND source_type = 'FINISHED_GOOD') THEN
    RAISE EXCEPTION 'Create or link the finished-good code first';
  END IF;
  FOR v_fg IN SELECT id, part_code FROM public.parts WHERE plm_product_id = p_product AND is_active AND source_type = 'FINISHED_GOOD' LOOP
    v_out := v_out || jsonb_build_object('part_code', v_fg.part_code, 'result', public.save_bom(v_fg.id, v_lines));
  END LOOP;
  UPDATE public.plm_products SET bom_published_at = now() WHERE id = p_product;
  RETURN v_out;
END $function$;

-- 8. Today's finished goods into models -------------------------------------
-- Category numbers already given out before the ERP: JA up to 015, SB up to 024.
UPDATE public.part_categories SET next_sequence = greatest(next_sequence, 16) WHERE prefix = 'JA';
UPDATE public.part_categories SET next_sequence = greatest(next_sequence, 25) WHERE prefix = 'SB';
UPDATE public.part_categories SET next_sequence = greatest(next_sequence, 3)  WHERE prefix = 'MI';

-- R&D IDs to model numbers where the mapping is certain.
UPDATE public.plm_products SET product_code = m.new
  FROM (VALUES ('J6C', 'JA-06C'), ('M2SM', 'MI-002'), ('J9', 'JA-009'), ('J10', 'JA-010'),
               ('J11', 'JA-011'), ('J12', 'JA-012'), ('J13', 'JA-013')) m(old, new)
 WHERE plm_products.product_code = m.old
   AND NOT EXISTS (SELECT 1 FROM public.plm_products x WHERE x.product_code = m.new);
-- (The trigger above created models JA-06C, MI-002, JA-009..JA-013 with an empty v1.0.)

-- JA-006 and MI-001 kept their R&D IDs, so their models come from the brand codes.
UPDATE public.parts SET part_code = part_code WHERE source_type = 'FINISHED_GOOD' AND branded_from IS NULL;
UPDATE public.parts m SET plm_product_id = pr.id
  FROM public.plm_products pr WHERE m.source_type = 'MODEL' AND m.part_code = pr.product_code AND m.plm_product_id IS NULL;

-- Names: the category and number; the brand codes keep their sales names.
UPDATE public.parts m SET name = c.name || ' ' || substring(m.part_code FROM '-(.*)$')
  FROM public.part_categories c
 WHERE m.source_type = 'MODEL' AND c.prefix = m.category
   AND EXISTS (SELECT 1 FROM public.parts b WHERE b.model_id = m.id);

-- v1.0 of each model: the lines all its brands share, minus packaging, stickers,
-- logos and manuals (those are the brand layer). Left as a draft so R&D checks
-- the split before Management releases it.
WITH b AS (
  SELECT fg.model_id, fg.id AS fg, coalesce(c.branded_from, c.id) AS k, bl.quantity, bl.issue_mode = 'BULK' AS bulk, bl.is_critical
    FROM public.parts fg JOIN public.bom bl ON bl.parent_part_id = fg.id AND bl.is_active
    JOIN public.parts c ON c.id = bl.child_part_id
   WHERE fg.source_type = 'FINISHED_GOOD' AND fg.model_id IS NOT NULL),
nb AS (SELECT model_id, count(DISTINCT fg) n FROM b GROUP BY 1),
common AS (
  SELECT b.model_id, b.k,
         mode() WITHIN GROUP (ORDER BY coalesce(b.quantity, -1)) AS q,
         bool_or(b.bulk) AS bulk, bool_or(b.is_critical) AS crit
    FROM b JOIN nb USING (model_id)
   GROUP BY b.model_id, b.k, nb.n HAVING count(DISTINCT b.fg) = nb.n),
hw AS (
  SELECT c.* FROM common c JOIN public.parts p ON p.id = c.k
   WHERE p.category NOT IN ('B', 'S')
     AND NOT (NOT p.branding_required
              AND p.name ~* '(logo|monogram|qsg|warranty|manual|philips|croma|aiwa|swiss military|\mbox\M)')),
agg AS (
  SELECT hw.model_id, jsonb_agg(jsonb_build_object('child_part_id', hw.k,
           'quantity', CASE WHEN hw.bulk OR hw.q < 0 THEN NULL ELSE hw.q END,
           'bulk', hw.bulk OR hw.q < 0, 'is_critical', hw.crit) ORDER BY p.part_code) AS lines
    FROM hw JOIN public.parts p ON p.id = hw.k GROUP BY hw.model_id)
UPDATE public.model_versions v SET lines = agg.lines, reason = 'First version, from the brand BOMs in use (check the split)', updated_at = now()
  FROM agg WHERE v.model_id = agg.model_id AND v.major = 1 AND v.minor = 0 AND v.status = 'DRAFT';

-- A model never gets bom rows, not even an empty save.
CREATE OR REPLACE FUNCTION public.save_bom(p_parent uuid, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_req uuid; v_result jsonb; v_frozen boolean;
BEGIN
  IF NOT public.can_edit_masters() THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can change a bill of materials' USING ERRCODE = '42501';
  END IF;
  IF (SELECT source_type FROM public.parts WHERE id = p_parent) = 'PURCHASED' THEN
    RAISE EXCEPTION 'A purchased part cannot have a bill of materials';
  END IF;
  IF (SELECT source_type FROM public.parts WHERE id = p_parent) = 'MODEL' THEN
    RAISE EXCEPTION 'A model''s BOM is kept per version. Change it on the Models page (an ECN once it is released).';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
              WHERE (l->>'child_part_id')::uuid = p_parent
                 OR (NOT coalesce((l->>'bulk')::boolean, false) AND coalesce((l->>'quantity')::numeric, 0) <= 0)) THEN
    RAISE EXCEPTION 'Every line needs a quantity above zero (or is marked bulk), and a part cannot be inside itself';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.parts p JOIN public.plm_products pr ON pr.id = p.plm_product_id
                  WHERE p.id = p_parent AND pr.stage = 6)
    INTO v_frozen;

  IF public.can_approve() AND NOT v_frozen THEN
    v_result := public.apply_bom(p_parent, p_lines);
    RETURN v_result || jsonb_build_object('applied', true);
  END IF;

  UPDATE public.bom_change_requests
     SET lines = p_lines, submitted_by = auth.uid(), submitted_at = now()
   WHERE parent_part_id = p_parent AND status = 'PENDING'
  RETURNING id INTO v_req;
  IF v_req IS NULL THEN
    INSERT INTO public.bom_change_requests (parent_part_id, lines) VALUES (p_parent, p_lines)
    RETURNING id INTO v_req;
  END IF;
  RETURN jsonb_build_object('applied', false, 'request_id', v_req, 'frozen', v_frozen);
END $function$;

SELECT setval('public.seq_ecn', 1, false);

-- The reason of a draft ECN can be reworded until it is released.
CREATE OR REPLACE FUNCTION public.model_version_reason(p_version uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NOT (public.can_edit_masters() OR public.can_edit_plm()) THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can change an ECN' USING ERRCODE = '42501';
  END IF;
  UPDATE public.model_versions SET reason = nullif(btrim(p_reason), ''), updated_at = now()
   WHERE id = p_version AND status = 'DRAFT';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a draft''s reason can change'; END IF;
END $function$;
REVOKE ALL ON FUNCTION public.model_version_reason(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.model_version_reason(uuid, text) TO authenticated;
