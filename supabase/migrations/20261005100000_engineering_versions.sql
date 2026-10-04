-- R&D owns the BOM. One engineering BOM, versioned, as a tree.
--
--   item            a model (JA-006) or a sub-assembly (SA-012, O-081 battery pack)
--   item_versions   1.0, 1.1 ... of an item; DRAFT until Management releases it
--   version_lines   the lines of a version. A line whose part is itself an item
--                   (a sub-assembly) points at the version of it that it uses,
--                   so the whole product opens level by level.
--                   brands: null = every brand; else only those brands (a
--                   Philips box, a blue handle inside the top panel).
--   ecns            an engineering change: one number, one reason, holding the
--                   draft versions it makes (the product, and any sub-assembly
--                   changed with it). Released together.
--
-- Production keeps its own BOM table (bom), written from these on release:
-- a brand code gets its model version's lines for that brand; a sub-assembly
-- gets its lines for every brand in bom, and the per-brand ones in
-- bom_brand_lines, from which the brand versions (SA-010-PH) are built.

-- 0. What this replaces ------------------------------------------------------
DROP TRIGGER IF EXISTS trg_model_version_to_rnd ON public.model_versions;
DROP FUNCTION IF EXISTS public.model_version_to_rnd();
DROP FUNCTION IF EXISTS public.plm_sync_bom_from_model(uuid, jsonb);
DROP TRIGGER IF EXISTS trg_plm_gate4_publish ON public.plm_gates;
DROP FUNCTION IF EXISTS public.plm_gate4_publish();
DROP FUNCTION IF EXISTS public.plm_publish_bom(uuid);
DROP FUNCTION IF EXISTS public.plm_bom_from_production(uuid);
DROP FUNCTION IF EXISTS public.model_version_save(uuid, jsonb);
DROP FUNCTION IF EXISTS public.model_version_release(uuid);
DROP FUNCTION IF EXISTS public.model_raise_ecn(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.model_version_discard(uuid);
DROP FUNCTION IF EXISTS public.model_version_reason(uuid, text);
DROP FUNCTION IF EXISTS public.model_brand_lines(uuid, uuid);
DROP FUNCTION IF EXISTS public.model_clean_lines(uuid, jsonb);

-- 1. ECNs ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ecns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ecn_no text NOT NULL UNIQUE DEFAULT ('ECN-' || lpad(nextval('public.seq_ecn')::text, 4, '0')),
  title text NOT NULL CHECK (btrim(title) <> ''),
  reason text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'RELEASED', 'CANCELLED')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_by uuid,
  released_at timestamptz
);
COMMENT ON TABLE public.ecns IS 'Engineering change: one number and reason for the draft versions it makes (a product, and sub-assemblies changed with it). Released together by Management.';
ALTER TABLE public.ecns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ecns_read ON public.ecns;
CREATE POLICY ecns_read ON public.ecns FOR SELECT USING (public.has_role());
REVOKE ALL ON public.ecns FROM anon;
GRANT SELECT ON public.ecns TO authenticated;

-- 2. Versions of any item --------------------------------------------------------
ALTER TABLE public.model_versions RENAME TO item_versions;
ALTER TABLE public.item_versions RENAME COLUMN model_id TO item_id;
ALTER TABLE public.item_versions RENAME COLUMN reason TO note;
ALTER TABLE public.item_versions ADD COLUMN IF NOT EXISTS ecn_id uuid REFERENCES public.ecns(id);
ALTER TABLE public.item_versions DROP COLUMN IF EXISTS ecn_no;
ALTER INDEX IF EXISTS public.model_versions_one_draft RENAME TO item_versions_one_draft;
ALTER TABLE public.item_versions RENAME CONSTRAINT model_versions_model_id_fkey TO item_versions_item_id_fkey;
ALTER TABLE public.item_versions RENAME CONSTRAINT model_versions_based_on_fkey TO item_versions_based_on_fkey;
ALTER TABLE public.item_versions RENAME CONSTRAINT model_versions_kind_check TO item_versions_kind_check;
ALTER TABLE public.item_versions RENAME CONSTRAINT model_versions_major_check TO item_versions_major_check;
ALTER TABLE public.item_versions RENAME CONSTRAINT model_versions_minor_check TO item_versions_minor_check;
ALTER TABLE public.item_versions RENAME CONSTRAINT model_versions_pkey TO item_versions_pkey;
ALTER TABLE public.item_versions RENAME CONSTRAINT model_versions_model_id_major_minor_key TO item_versions_item_id_major_minor_key;
ALTER TABLE public.item_versions DROP CONSTRAINT IF EXISTS model_versions_status_check;
ALTER TABLE public.item_versions ADD CONSTRAINT item_versions_status_check CHECK (status IN ('DRAFT', 'RELEASED'));
CREATE INDEX IF NOT EXISTS item_versions_ecn_idx ON public.item_versions(ecn_id);
COMMENT ON TABLE public.item_versions IS 'Engineering versions of a model or a sub-assembly (1.0, 1.1 by ECN, 2.0 redesign). Lines in version_lines.';
DROP POLICY IF EXISTS model_versions_read ON public.item_versions;
DROP POLICY IF EXISTS item_versions_read ON public.item_versions;
CREATE POLICY item_versions_read ON public.item_versions FOR SELECT USING (public.has_role());

-- Only a model or a sub-assembly (a made part, not a brand version) has versions.
CREATE OR REPLACE FUNCTION public.item_versions_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE p record;
BEGIN
  SELECT part_code, source_type, branded_from INTO p FROM public.parts WHERE id = NEW.item_id;
  IF p.source_type NOT IN ('MODEL', 'ASSEMBLED_STOCKED', 'ASSEMBLED_INLINE') OR p.branded_from IS NOT NULL THEN
    RAISE EXCEPTION '% is not a model or a sub-assembly, so it has no engineering versions', p.part_code;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'RELEASED' AND coalesce(current_setting('app.versioning', true), '') <> 'on' THEN
    RAISE EXCEPTION 'v% of % is released and cannot change', OLD.version, p.part_code;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_item_versions_guard ON public.item_versions;
CREATE TRIGGER trg_item_versions_guard BEFORE INSERT OR UPDATE ON public.item_versions
  FOR EACH ROW EXECUTE FUNCTION public.item_versions_guard();

-- 3. Lines -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.version_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.item_versions(id) ON DELETE CASCADE,
  sort int NOT NULL DEFAULT 0,
  part_id uuid REFERENCES public.parts(id),
  description text,
  quantity numeric,
  bulk boolean NOT NULL DEFAULT false,
  is_critical boolean NOT NULL DEFAULT false,
  brands text[],
  child_version_id uuid REFERENCES public.item_versions(id),
  change_type text NOT NULL DEFAULT 'NEW' CHECK (change_type IN ('NEW', 'CARRY_OVER', 'CHANGED')),
  replaces_part_id uuid REFERENCES public.parts(id),
  design_status text NOT NULL DEFAULT 'OPEN' CHECK (design_status IN ('OPEN', 'WIP', 'CLOSED')),
  sample_status text NOT NULL DEFAULT 'OPEN' CHECK (sample_status IN ('OPEN', 'WIP', 'CLOSED')),
  approval_status text NOT NULL DEFAULT 'OPEN' CHECK (approval_status IN ('OPEN', 'WIP', 'CLOSED')),
  release_status text NOT NULL DEFAULT 'OPEN' CHECK (release_status IN ('OPEN', 'WIP', 'CLOSED')),
  design_done boolean GENERATED ALWAYS AS (design_status = 'CLOSED') STORED,
  sample_done boolean GENERATED ALWAYS AS (sample_status = 'CLOSED') STORED,
  approval_done boolean GENERATED ALWAYS AS (approval_status = 'CLOSED') STORED,
  release_done boolean GENERATED ALWAYS AS (release_status = 'CLOSED') STORED,
  design_at timestamptz, sample_at timestamptz, approval_at timestamptz, release_at timestamptz,
  vendor_note text,
  quoted_price numeric,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CHECK (part_id IS NOT NULL OR nullif(btrim(description), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS version_lines_version_idx ON public.version_lines(version_id);
CREATE INDEX IF NOT EXISTS version_lines_part_idx ON public.version_lines(part_id);
CREATE INDEX IF NOT EXISTS version_lines_child_idx ON public.version_lines(child_version_id);
COMMENT ON TABLE public.version_lines IS 'Lines of an engineering version. A sub-assembly line points at the version of it used (child_version_id). brands null = every brand. Steps Design/Sample/Approval/Release are R&D''s progress.';
ALTER TABLE public.version_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS version_lines_read ON public.version_lines;
CREATE POLICY version_lines_read ON public.version_lines FOR SELECT USING (public.has_role());
DROP POLICY IF EXISTS version_lines_write ON public.version_lines;
CREATE POLICY version_lines_write ON public.version_lines FOR ALL USING (public.can_edit_plm()) WITH CHECK (public.can_edit_plm());
REVOKE ALL ON public.version_lines FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.version_lines TO authenticated;

-- An item's version that a line uses: in the same ECN if it is being changed
-- there, else the latest released one.
CREATE OR REPLACE FUNCTION public.item_version_for(p_item uuid, p_ecn uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT id FROM public.item_versions
   WHERE item_id = p_item
   ORDER BY (p_ecn IS NOT NULL AND ecn_id = p_ecn AND status = 'DRAFT') DESC,
            (status = 'RELEASED') DESC, major DESC, minor DESC
   LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.version_lines_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v record; p record; v_open int; v_what text; v_bad text;
  v_free boolean := coalesce(current_setting('app.versioning', true), '') = 'on';
BEGIN
  SELECT iv.*, it.part_code AS item_code INTO v
    FROM public.item_versions iv JOIN public.parts it ON it.id = iv.item_id
   WHERE iv.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
  IF v.status <> 'DRAFT' AND NOT v_free THEN
    RAISE EXCEPTION 'v% of % is released. Raise an ECN to change it.', v.version, v.item_code;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  IF NEW.part_id IS NOT NULL THEN
    SELECT part_code, source_type, branded_from INTO p FROM public.parts WHERE id = NEW.part_id;
    IF p.source_type IN ('MODEL', 'FINISHED_GOOD') THEN
      RAISE EXCEPTION '% is a product, not a part of one', p.part_code;
    END IF;
    IF p.branded_from IS NOT NULL THEN
      RAISE EXCEPTION '% is a brand version. Use its base part and mark the line for that brand.', p.part_code;
    END IF;
    IF NEW.part_id = v.item_id THEN RAISE EXCEPTION '% cannot be inside itself', p.part_code; END IF;
    -- A sub-assembly line points at a version of it.
    IF EXISTS (SELECT 1 FROM public.item_versions WHERE item_id = NEW.part_id) THEN
      IF NEW.child_version_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.item_versions WHERE id = NEW.child_version_id AND item_id = NEW.part_id) THEN
        NEW.child_version_id := public.item_version_for(NEW.part_id, v.ecn_id);
      END IF;
    ELSE
      NEW.child_version_id := NULL;
    END IF;
  ELSE
    NEW.child_version_id := NULL;
  END IF;

  IF NEW.brands IS NOT NULL THEN
    NEW.brands := (SELECT array_agg(DISTINCT upper(btrim(b)) ORDER BY upper(btrim(b))) FROM unnest(NEW.brands) b WHERE btrim(b) <> '');
    SELECT string_agg(b, ', ') INTO v_bad FROM unnest(NEW.brands) b
     WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE letter = b);
    IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Not a registered brand: %', v_bad; END IF;
  END IF;
  IF NEW.bulk THEN NEW.quantity := NULL; END IF;

  -- Steps: carry-over lines are already released; closing needs the step before.
  IF NEW.change_type = 'CARRY_OVER' AND TG_OP = 'INSERT' THEN
    NEW.design_status := 'CLOSED'; NEW.sample_status := 'CLOSED'; NEW.approval_status := 'CLOSED'; NEW.release_status := 'CLOSED';
  END IF;
  v_what := coalesce((SELECT part_code FROM public.parts WHERE id = NEW.part_id), NEW.description);
  IF TG_OP = 'UPDATE' THEN
    IF OLD.design_status = 'CLOSED' AND NEW.design_status <> 'CLOSED' AND NEW.sample_status = 'CLOSED' THEN NEW.sample_status := 'WIP'; END IF;
    IF OLD.sample_status = 'CLOSED' AND NEW.sample_status <> 'CLOSED' AND NEW.approval_status = 'CLOSED' THEN NEW.approval_status := 'WIP'; END IF;
    IF OLD.approval_status = 'CLOSED' AND NEW.approval_status <> 'CLOSED' AND NEW.release_status = 'CLOSED' THEN NEW.release_status := 'WIP'; END IF;
  END IF;
  IF NEW.sample_status = 'CLOSED' AND NEW.design_status <> 'CLOSED' THEN RAISE EXCEPTION '%: close Design before closing Sample', v_what; END IF;
  IF NEW.approval_status = 'CLOSED' AND NEW.sample_status <> 'CLOSED' THEN RAISE EXCEPTION '%: close Sample before closing Approval', v_what; END IF;
  IF NEW.release_status = 'CLOSED' AND NEW.approval_status <> 'CLOSED' THEN RAISE EXCEPTION '%: close Approval before closing Release', v_what; END IF;
  IF NEW.release_status = 'CLOSED' AND NEW.part_id IS NULL THEN
    RAISE EXCEPTION 'Give "%" its part code before closing Release', NEW.description;
  END IF;
  IF NEW.approval_status = 'CLOSED' AND (TG_OP = 'INSERT' OR OLD.approval_status <> 'CLOSED') THEN
    SELECT count(*) INTO v_open FROM public.plm_tests WHERE bom_line_id = NEW.id AND result <> 'PASS';
    IF v_open > 0 THEN RAISE EXCEPTION '% has % part test(s) not passed: Approval cannot close yet', v_what, v_open; END IF;
  END IF;
  NEW.design_at := CASE WHEN NEW.design_status = 'CLOSED' THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.design_at END, now()) END;
  NEW.sample_at := CASE WHEN NEW.sample_status = 'CLOSED' THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.sample_at END, now()) END;
  NEW.approval_at := CASE WHEN NEW.approval_status = 'CLOSED' THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.approval_at END, now()) END;
  NEW.release_at := CASE WHEN NEW.release_status = 'CLOSED' THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.release_at END, now()) END;
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_version_lines_rules ON public.version_lines;
CREATE TRIGGER trg_version_lines_rules BEFORE INSERT OR UPDATE OR DELETE ON public.version_lines
  FOR EACH ROW EXECUTE FUNCTION public.version_lines_rules();

-- 4. Per-brand lines of a sub-assembly in production -----------------------------
CREATE TABLE IF NOT EXISTS public.bom_brand_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  child_part_id uuid NOT NULL REFERENCES public.parts(id),
  brand text NOT NULL REFERENCES public.brands(letter),
  quantity numeric,
  issue_mode text NOT NULL DEFAULT 'PER_SET' CHECK (issue_mode IN ('PER_SET', 'BULK')),
  is_critical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_part_id, child_part_id, brand)
);
COMMENT ON TABLE public.bom_brand_lines IS 'Lines of a sub-assembly for one brand only (from its released version). The brand version (SA-010-PH) gets the shared bom lines plus these.';
ALTER TABLE public.bom_brand_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bom_brand_lines_read ON public.bom_brand_lines;
CREATE POLICY bom_brand_lines_read ON public.bom_brand_lines FOR SELECT USING (public.has_role());
REVOKE ALL ON public.bom_brand_lines FROM anon;
GRANT SELECT ON public.bom_brand_lines TO authenticated;

-- 5. Tests and issues hang off version lines -------------------------------------
ALTER TABLE public.plm_tests DROP CONSTRAINT IF EXISTS plm_tests_bom_line_id_fkey;
ALTER TABLE public.plm_issues DROP CONSTRAINT IF EXISTS plm_issues_bom_line_id_fkey;
DELETE FROM public.plm_tests WHERE bom_line_id IS NOT NULL;
UPDATE public.plm_issues SET bom_line_id = NULL WHERE bom_line_id IS NOT NULL;
ALTER TABLE public.plm_tests ADD CONSTRAINT plm_tests_bom_line_id_fkey FOREIGN KEY (bom_line_id) REFERENCES public.version_lines(id) ON DELETE CASCADE;
ALTER TABLE public.plm_issues ADD CONSTRAINT plm_issues_bom_line_id_fkey FOREIGN KEY (bom_line_id) REFERENCES public.version_lines(id) ON DELETE SET NULL;

DROP TABLE IF EXISTS public.plm_bom_lines CASCADE;
DROP FUNCTION IF EXISTS public.plm_bom_line_rules();
DROP FUNCTION IF EXISTS public.plm_bom_changed();

-- 6. Today's data ---------------------------------------------------------------------
SELECT set_config('app.versioning', 'on', true);

-- 6a. Every sub-assembly made here with a BOM: v1.0, released, as built today.
INSERT INTO public.item_versions (item_id, major, minor, kind, note, status, released_at)
SELECT p.id, 1, 0, 'INITIAL', 'From the production BOM in use', 'RELEASED', now()
  FROM public.parts p
 WHERE p.source_type IN ('ASSEMBLED_STOCKED', 'ASSEMBLED_INLINE') AND p.branded_from IS NULL
   AND EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = p.id AND b.is_active)
   AND NOT EXISTS (SELECT 1 FROM public.item_versions v WHERE v.item_id = p.id);

INSERT INTO public.version_lines (version_id, sort, part_id, quantity, bulk, is_critical, change_type)
SELECT v.id, row_number() OVER (PARTITION BY v.id ORDER BY c.part_code),
       coalesce(c.branded_from, c.id), b.quantity, b.issue_mode = 'BULK', b.is_critical, 'CARRY_OVER'
  FROM public.item_versions v
  JOIN public.parts sa ON sa.id = v.item_id AND sa.source_type <> 'MODEL'
  JOIN public.bom b ON b.parent_part_id = sa.id AND b.is_active
  JOIN public.parts c ON c.id = b.child_part_id
 WHERE NOT EXISTS (SELECT 1 FROM public.version_lines l WHERE l.version_id = v.id);

UPDATE public.parts p SET model_version = '1.0'
 WHERE EXISTS (SELECT 1 FROM public.item_versions v WHERE v.item_id = p.id AND v.status = 'RELEASED')
   AND p.source_type <> 'MODEL';

-- 6b. Each model's v1.0: the full BOM of its brands. A line every brand has
--     the same way is for all brands; otherwise it is for the brands that have
--     it (that is how the Philips top panel and the Aiwa box sit in one BOM).
WITH m AS (
  SELECT id FROM public.parts WHERE source_type = 'MODEL'
), fg AS (
  SELECT b.id, b.model_id, b.brand FROM public.parts b
   WHERE b.source_type = 'FINISHED_GOOD' AND b.model_id IN (SELECT id FROM m) AND b.is_active
), nb AS (
  SELECT model_id, array_agg(DISTINCT brand ORDER BY brand) AS all_brands FROM fg GROUP BY 1
), l AS (
  SELECT fg.model_id, fg.brand, coalesce(c.branded_from, c.id) AS part_id, bl.quantity,
         bl.issue_mode = 'BULK' AS bulk, bl.is_critical
    FROM fg JOIN public.bom bl ON bl.parent_part_id = fg.id AND bl.is_active
    JOIN public.parts c ON c.id = bl.child_part_id
), g AS (
  SELECT l.model_id, l.part_id, l.quantity, l.bulk, bool_or(l.is_critical) AS crit,
         array_agg(DISTINCT l.brand ORDER BY l.brand) AS brands
    FROM l GROUP BY 1, 2, 3, 4
)
INSERT INTO public.version_lines (version_id, sort, part_id, quantity, bulk, is_critical, brands, change_type)
SELECT v.id, row_number() OVER (PARTITION BY v.id ORDER BY (g.brands = nb.all_brands) DESC, p.part_code, g.brands),
       g.part_id, g.quantity, g.bulk, g.crit,
       CASE WHEN g.brands = nb.all_brands THEN NULL ELSE g.brands END, 'CARRY_OVER'
  FROM g JOIN nb ON nb.model_id = g.model_id
  JOIN public.item_versions v ON v.item_id = g.model_id AND v.major = 1 AND v.minor = 0
  JOIN public.parts p ON p.id = g.part_id;

UPDATE public.item_versions v SET status = 'RELEASED', released_at = now(),
       note = 'From the production BOMs in use'
 WHERE EXISTS (SELECT 1 FROM public.version_lines l WHERE l.version_id = v.id)
   AND v.status = 'DRAFT'
   AND (SELECT source_type FROM public.parts WHERE id = v.item_id) = 'MODEL';
UPDATE public.parts p SET model_version = '1.0'
 WHERE p.source_type = 'MODEL' AND EXISTS (SELECT 1 FROM public.item_versions v WHERE v.item_id = p.id AND v.status = 'RELEASED');

-- 6c. Check: each brand code's BOM, rebuilt from its model's v1.0, is exactly
--     the BOM in use. If not, nothing above is kept.
DO $$
DECLARE v_diff text;
BEGIN
  WITH fg AS (
    SELECT b.id, b.part_code, b.brand, b.model_id FROM public.parts b
     WHERE b.source_type = 'FINISHED_GOOD' AND b.model_id IS NOT NULL AND b.is_active
  ), want AS (
    SELECT fg.part_code, l.part_id, l.quantity, l.bulk
      FROM fg JOIN public.item_versions v ON v.item_id = fg.model_id AND v.status = 'RELEASED'
      JOIN public.version_lines l ON l.version_id = v.id AND (l.brands IS NULL OR fg.brand = ANY (l.brands))
  ), have AS (
    SELECT fg.part_code, coalesce(c.branded_from, c.id) AS part_id, b.quantity, b.issue_mode = 'BULK' AS bulk
      FROM fg JOIN public.bom b ON b.parent_part_id = fg.id AND b.is_active JOIN public.parts c ON c.id = b.child_part_id
  )
  SELECT string_agg(part_code || ':' || n, ', ') INTO v_diff FROM (
    SELECT part_code, count(*) n FROM ((SELECT * FROM want EXCEPT SELECT * FROM have) UNION ALL (SELECT * FROM have EXCEPT SELECT * FROM want)) d
     GROUP BY 1) x;
  IF v_diff IS NOT NULL THEN RAISE EXCEPTION 'Versions do not rebuild the BOMs in use: %', v_diff; END IF;
END $$;

ALTER TABLE public.item_versions DROP COLUMN IF EXISTS lines;
SELECT set_config('app.versioning', 'off', true);
