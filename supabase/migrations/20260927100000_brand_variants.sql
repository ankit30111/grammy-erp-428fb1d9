-- Branding: a part printed for a brand is its own part, and the brand passes upward.
--
--   P-423  plain tube, bought            [✓] Branding: CR, PH       (ticked by Management)
--   P-423-CR / P-423-PH                  printed tube, made in-house, BOM = P-423 x 1
--   SA-009 contains P-423  ->            SA-009-CR / SA-009-PH, BOM = SA-009's with the printed tube
--   MI-001-CR uses SA-009  ->            the line is kept on SA-009-CR automatically
--
-- One rule: printing fixes the brand, the brand passes up the BOM, common parts stay common.
-- Brand versions are owned by the system (sync_brand_variants); people edit the base part only.

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS branded_from uuid REFERENCES public.parts(id),
  ADD COLUMN IF NOT EXISTS branding_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand_relevant boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.parts.branded_from IS 'Brand version: the base part it is made from (brand in parts.brand). Kept by the system.';
COMMENT ON COLUMN public.parts.branding_required IS 'This part is printed per brand before use (brands in part_brands).';
COMMENT ON COLUMN public.parts.brand_relevant IS 'Maintained: this base part is printed, or contains a printed part, so it is built per brand.';

CREATE UNIQUE INDEX IF NOT EXISTS parts_brand_version_key
  ON public.parts(branded_from, brand) WHERE branded_from IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.part_brands (
  part_id    uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  brand      text NOT NULL REFERENCES public.brands(letter),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (part_id, brand)
);
ALTER TABLE public.part_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS part_brands_read ON public.part_brands;
CREATE POLICY part_brands_read ON public.part_brands FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.part_brands FROM authenticated, anon;

-- What the last sync could not do, for people to fix. Rebuilt on every sync.
CREATE TABLE IF NOT EXISTS public.brand_sync_issues (
  id         bigserial PRIMARY KEY,
  part_id    uuid REFERENCES public.parts(id) ON DELETE CASCADE,
  part_code  text,
  kind       text NOT NULL,      -- GAP, PARTIAL, COLLISION, CONFLICT
  brand      text,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_sync_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_sync_issues_read ON public.brand_sync_issues;
CREATE POLICY brand_sync_issues_read ON public.brand_sync_issues FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.brand_sync_issues FROM authenticated, anon;

-- ---------------------------------------------------------------------------
-- Part rules: the brand of a brand version is kept; branding fields change only
-- through set_part_branding / the sync.
CREATE OR REPLACE FUNCTION public.parts_enforce_category()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_kind public.part_source_type; v_tier text;
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
    NEW.made_in_house := false;   -- a made-here letter needs no exception
  END IF;
  IF NOT v_sync AND ((TG_OP = 'INSERT' AND NEW.made_in_house) OR (TG_OP = 'UPDATE' AND NEW.made_in_house IS DISTINCT FROM OLD.made_in_house)) THEN
    IF auth.uid() IS NOT NULL AND NOT public.can_approve() THEN
      RAISE EXCEPTION 'Only Management or Admin can mark a purchase code as made in-house' USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.source_type := CASE WHEN NEW.made_in_house THEN 'ASSEMBLED_STOCKED'::public.part_source_type ELSE v_kind END;
  NEW.part_code := upper(btrim(NEW.part_code));
  NEW.brand := CASE WHEN v_tier = 'FINISHED' THEN right(NEW.part_code, 2)
                    WHEN NEW.branded_from IS NOT NULL THEN NEW.brand END;
  IF TG_OP = 'INSERT' OR NEW.part_code IS DISTINCT FROM OLD.part_code THEN
    IF v_tier = 'FINISHED' THEN
      IF NEW.part_code !~ ('^' || NEW.category || '-[A-Z0-9]+-[A-Z]{2}$') THEN
        RAISE EXCEPTION 'A finished-good code is category-model-brand, e.g. %-06C-PH. "%" is not.', NEW.category, NEW.part_code;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.brands WHERE letter = NEW.brand) THEN
        RAISE EXCEPTION '"%" is not a registered brand. Add it on the create form first.', NEW.brand;
      END IF;
    ELSIF NEW.part_code !~ ('^' || NEW.category || '-[A-Z0-9][A-Z0-9-]*$') THEN
      RAISE EXCEPTION 'Part code "%" must start with "%-"', NEW.part_code, NEW.category;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- The sync creates brand versions as approved, whoever triggered it.
CREATE OR REPLACE FUNCTION public.master_approval_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Migrations and imports run without a signed-in user and keep what they set.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  -- Brand versions follow their approved base part.
  IF coalesce(current_setting('app.brand_sync', true), '') = 'on' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.submitted_by := auth.uid();
    NEW.rejection_reason := NULL;
    IF public.can_approve() THEN
      NEW.approval_status := 'APPROVED'; NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    ELSE
      NEW.approval_status := 'PENDING'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('app.approving', true), '') = 'on' THEN RETURN NEW; END IF;

  NEW.approval_status := OLD.approval_status;
  NEW.submitted_by := OLD.submitted_by;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.rejection_reason := OLD.rejection_reason;

  -- Fixing a rejected record sends it back for approval.
  IF OLD.approval_status = 'REJECTED' AND NOT public.can_approve() THEN
    NEW.approval_status := 'PENDING'; NEW.submitted_by := auth.uid(); NEW.rejection_reason := NULL;
  END IF;

  -- Removing master data is Management's call - except withdrawing one's own
  -- request that has not been approved yet.
  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT public.can_approve()
     AND OLD.approval_status = 'APPROVED' THEN
    RAISE EXCEPTION 'Only Management or Admin can remove an approved record' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

-- ---------------------------------------------------------------------------
-- BOM rules for brands.
--   * A brand version's BOM belongs to the system: change the base part's BOM.
--   * A branded part only goes into a product of the same brand.
CREATE OR REPLACE FUNCTION public.bom_brand_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE pa record; ch record; bn text; pn text;
BEGIN
  IF coalesce(current_setting('app.brand_sync', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT p.part_code, p.brand, p.branded_from, b.part_code AS base_code INTO pa
    FROM public.parts p LEFT JOIN public.parts b ON b.id = p.branded_from
   WHERE p.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.parent_part_id ELSE NEW.parent_part_id END;
  IF pa.branded_from IS NOT NULL THEN
    RAISE EXCEPTION '% is the brand version of % and its BOM is kept by the system. Change the BOM of % instead.',
      pa.part_code, pa.base_code, pa.base_code USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  SELECT part_code, brand, branded_from, source_type INTO ch FROM public.parts WHERE id = NEW.child_part_id;
  IF ch.brand IS NOT NULL AND (ch.branded_from IS NOT NULL OR ch.source_type = 'FINISHED_GOOD')
     AND pa.brand IS DISTINCT FROM ch.brand THEN
    SELECT name INTO bn FROM public.brands WHERE letter = ch.brand;
    SELECT name INTO pn FROM public.brands WHERE letter = pa.brand;
    RAISE EXCEPTION '% is the % version and can only go into a % product, not %.',
      ch.part_code, coalesce(bn, ch.brand), coalesce(bn, ch.brand),
      coalesce(pa.part_code || CASE WHEN pn IS NOT NULL THEN ' (' || pn || ')' ELSE ' (no brand)' END, 'this BOM')
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_bom_brand_guard ON public.bom;
CREATE TRIGGER trg_bom_brand_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bom
  FOR EACH ROW EXECUTE FUNCTION public.bom_brand_guard();

-- ---------------------------------------------------------------------------
-- The engine. Recomputes every brand version from scratch; safe to run any time.
CREATE OR REPLACE FUNCTION public.sync_brand_variants()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  r record; v_id uuid; v_lines jsonb; v_n int; v_iter int := 0;
  v_created int := 0; v_off int := 0; v_fg int := 0; v_missing text; v_bname text;
BEGIN
  IF coalesce(current_setting('app.brand_sync', true), '') = 'on' THEN RETURN NULL; END IF;
  -- Nothing branded anywhere: nothing to do (keeps every other save fast).
  IF NOT EXISTS (SELECT 1 FROM public.parts WHERE branding_required OR branded_from IS NOT NULL OR brand_relevant) THEN
    DELETE FROM public.brand_sync_issues WHERE true;
    RETURN jsonb_build_object('skipped', true);
  END IF;

  PERFORM set_config('app.brand_sync', 'on', true);
  PERFORM set_config('app.approving', 'on', true);

  CREATE TEMP TABLE IF NOT EXISTS _relv (part_id uuid PRIMARY KEY, kind text, brands text[]) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS _want (base_id uuid, brand text, code text, name text, kind text,
                                         PRIMARY KEY (base_id, brand)) ON COMMIT DROP;
  DELETE FROM _relv WHERE true;
  DELETE FROM _want WHERE true;
  DELETE FROM public.brand_sync_issues WHERE true;

  -- 1. Printed parts: the brands ticked on them.
  INSERT INTO _relv
  SELECT p.id, 'PRINT',
         coalesce((SELECT array_agg(pb.brand ORDER BY pb.brand)
                     FROM public.part_brands pb JOIN public.brands b ON b.letter = pb.brand AND b.is_active
                    WHERE pb.part_id = p.id), '{}')
    FROM public.parts p
   WHERE p.branding_required AND p.branded_from IS NULL AND p.is_active AND p.source_type <> 'FINISHED_GOOD';

  -- 2. Assemblies that contain a printed part (at any depth): the brands every
  --    printed part inside them has. Repeat until nothing changes.
  LOOP
    v_iter := v_iter + 1;
    WITH ch AS (
      SELECT b.parent_part_id AS pid, rv.part_id AS cid, rv.brands
        FROM public.bom b
        JOIN _relv rv ON rv.part_id = b.child_part_id
        JOIN public.parts pp ON pp.id = b.parent_part_id
       WHERE b.is_active AND pp.branded_from IS NULL AND pp.is_active
         AND pp.source_type = 'ASSEMBLED_STOCKED' AND NOT pp.branding_required
    ), nchild AS (
      SELECT pid, count(DISTINCT cid) AS n FROM ch GROUP BY pid
    ), inter AS (
      SELECT ch.pid, x AS brand FROM ch, unnest(ch.brands) x
       GROUP BY ch.pid, x
      HAVING count(DISTINCT ch.cid) = (SELECT n FROM nchild WHERE nchild.pid = ch.pid)
    ), calc AS (
      SELECT nchild.pid, coalesce((SELECT array_agg(i.brand ORDER BY i.brand) FROM inter i WHERE i.pid = nchild.pid), '{}') AS brands
        FROM nchild
    )
    INSERT INTO _relv (part_id, kind, brands)
    SELECT pid, 'ASSEMBLY', brands FROM calc
    ON CONFLICT (part_id) DO UPDATE SET brands = EXCLUDED.brands
     WHERE _relv.kind = 'ASSEMBLY' AND _relv.brands IS DISTINCT FROM EXCLUDED.brands;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXIT WHEN v_n = 0 OR v_iter > 20;
  END LOOP;

  -- An assembly missing a brand that only some of its printed parts have.
  INSERT INTO public.brand_sync_issues (part_id, part_code, kind, brand, message)
  SELECT pp.id, pp.part_code, 'PARTIAL', x,
         format('%s has no %s version: %s inside it is not printed for %s.', pp.part_code, x,
                string_agg(DISTINCT cp.part_code, ', '), x)
    FROM _relv ra
    JOIN public.parts pp ON pp.id = ra.part_id
    JOIN public.bom b ON b.parent_part_id = ra.part_id AND b.is_active
    JOIN _relv rc ON rc.part_id = b.child_part_id
    JOIN public.parts cp ON cp.id = rc.part_id
    CROSS JOIN LATERAL (
      SELECT DISTINCT y FROM public.bom b2 JOIN _relv r2 ON r2.part_id = b2.child_part_id, unnest(r2.brands) y
       WHERE b2.parent_part_id = ra.part_id AND b2.is_active
    ) u(x)
   WHERE ra.kind = 'ASSEMBLY' AND NOT (u.x = ANY (ra.brands)) AND NOT (u.x = ANY (rc.brands))
   GROUP BY pp.id, pp.part_code, x;

  -- A part printed after assembly that also has printed parts inside is ambiguous.
  INSERT INTO public.brand_sync_issues (part_id, part_code, kind, message)
  SELECT DISTINCT p.id, p.part_code, 'CONFLICT',
         format('%s is ticked for branding and also contains printed parts. Tick branding on only one of them.', p.part_code)
    FROM _relv rv JOIN public.parts p ON p.id = rv.part_id
    JOIN public.bom b ON b.parent_part_id = rv.part_id AND b.is_active
    JOIN _relv rc ON rc.part_id = b.child_part_id
   WHERE rv.kind = 'PRINT';

  -- 3. The brand versions that should exist.
  INSERT INTO _want (base_id, brand, code, name, kind)
  SELECT p.id, x, p.part_code || '-' || x, p.name || ' · ' || br.name, rv.kind
    FROM _relv rv JOIN public.parts p ON p.id = rv.part_id, unnest(rv.brands) x
    JOIN public.brands br ON br.letter = x;

  FOR r IN
    SELECT w.*, v.id AS vid, bp.category, bp.uom, bp.pqc_checklist_url, bp.plant_id,
           (SELECT tier FROM public.part_categories c WHERE c.prefix = bp.category) AS tier
      FROM _want w
      JOIN public.parts bp ON bp.id = w.base_id
      LEFT JOIN public.parts v ON v.branded_from = w.base_id AND v.brand = w.brand
  LOOP
    IF r.vid IS NULL THEN
      IF EXISTS (SELECT 1 FROM public.parts WHERE part_code = r.code) THEN
        INSERT INTO public.brand_sync_issues (part_id, part_code, kind, brand, message)
        VALUES (r.base_id, r.code, 'COLLISION', r.brand,
                format('%s already exists as a separate part, so the %s version of this part could not be created.', r.code, r.brand));
        DELETE FROM _want WHERE base_id = r.base_id AND brand = r.brand;
        CONTINUE;
      END IF;
      INSERT INTO public.parts (part_code, name, category, uom, made_in_house, branded_from, brand,
                                approval_status, is_active, pqc_checklist_url, plant_id, created_by)
      VALUES (r.code, r.name, r.category, r.uom, r.tier = 'PURCHASE', r.base_id, r.brand,
              'APPROVED', true, r.pqc_checklist_url, r.plant_id, auth.uid());
      v_created := v_created + 1;
    ELSE
      UPDATE public.parts SET name = r.name, uom = r.uom, is_active = true
       WHERE id = r.vid AND (name IS DISTINCT FROM r.name OR uom IS DISTINCT FROM r.uom OR NOT is_active);
    END IF;
  END LOOP;

  -- 4. Their BOMs: printed part = the plain part x 1; assembly = the base BOM with
  --    every printed/branded part swapped for its version of the same brand.
  FOR r IN
    SELECT w.*, v.id AS vid, bp.uom AS base_uom
      FROM _want w
      JOIN public.parts v ON v.branded_from = w.base_id AND v.brand = w.brand
      JOIN public.parts bp ON bp.id = w.base_id
  LOOP
    IF r.kind = 'PRINT' THEN
      v_lines := jsonb_build_array(jsonb_build_object('child_part_id', r.base_id, 'quantity', 1,
                                                      'uom', coalesce(r.base_uom, 'PCS'), 'is_critical', true));
    ELSE
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'child_part_id', coalesce(cv.id, b.child_part_id),
               'quantity', b.quantity, 'uom', b.uom, 'is_critical', b.is_critical,
               'bulk', b.issue_mode = 'BULK')), '[]'::jsonb)
        INTO v_lines
        FROM public.bom b
        LEFT JOIN _relv rc ON rc.part_id = b.child_part_id
        LEFT JOIN public.parts cv ON rc.part_id IS NOT NULL AND cv.branded_from = b.child_part_id AND cv.brand = r.brand
       WHERE b.parent_part_id = r.base_id AND b.is_active;
    END IF;
    PERFORM public.apply_bom(r.vid, v_lines);
  END LOOP;

  -- 5. Versions no longer wanted stop being offered (history and stock stay).
  UPDATE public.parts v SET is_active = false
   WHERE v.branded_from IS NOT NULL AND v.is_active
     AND NOT EXISTS (SELECT 1 FROM _want w WHERE w.base_id = v.branded_from AND w.brand = v.brand);
  GET DIAGNOSTICS v_off = ROW_COUNT;

  -- 6. Finished goods: a printed or brand-built part is kept on the version of
  --    the product's own brand. A retired version goes back to its base part.
  UPDATE public.bom b SET child_part_id = v.branded_from
    FROM public.parts v, public.parts fg
   WHERE b.child_part_id = v.id AND v.branded_from IS NOT NULL AND NOT v.is_active
     AND b.is_active AND fg.id = b.parent_part_id AND fg.source_type = 'FINISHED_GOOD'
     AND NOT EXISTS (SELECT 1 FROM public.bom x WHERE x.parent_part_id = b.parent_part_id
                        AND x.child_part_id = v.branded_from AND x.is_active);

  FOR r IN
    SELECT b.id AS bom_id, b.parent_part_id, fg.part_code AS fg_code, fg.brand, c.id AS cid, c.part_code AS child_code,
           v.id AS vid
      FROM public.bom b
      JOIN public.parts fg ON fg.id = b.parent_part_id AND fg.source_type = 'FINISHED_GOOD' AND fg.brand IS NOT NULL
      JOIN public.parts c ON c.id = b.child_part_id AND c.branded_from IS NULL
      JOIN _relv rc ON rc.part_id = c.id
      LEFT JOIN public.parts v ON v.branded_from = c.id AND v.brand = fg.brand AND v.is_active
     WHERE b.is_active
  LOOP
    IF r.vid IS NULL THEN
      -- Which printed parts under it lack this brand.
      WITH RECURSIVE t(pid) AS (
        SELECT r.cid
        UNION
        SELECT b2.child_part_id FROM public.bom b2 JOIN t ON b2.parent_part_id = t.pid
          JOIN _relv r2 ON r2.part_id = b2.child_part_id
         WHERE b2.is_active
      )
      SELECT string_agg(DISTINCT p.part_code, ', ') INTO v_missing
        FROM t JOIN _relv rr ON rr.part_id = t.pid AND rr.kind = 'PRINT' AND NOT (r.brand = ANY (rr.brands))
        JOIN public.parts p ON p.id = t.pid;
      SELECT name INTO v_bname FROM public.brands WHERE letter = r.brand;
      INSERT INTO public.brand_sync_issues (part_id, part_code, kind, brand, message)
      VALUES (r.parent_part_id, r.fg_code, 'GAP', r.brand,
              format('%s uses %s, which is printed per brand, but there is no %s version. Tick %s under Branding on %s.',
                     r.fg_code, r.child_code, coalesce(v_bname, r.brand), r.brand, coalesce(v_missing, r.child_code)));
    ELSE
      IF EXISTS (SELECT 1 FROM public.bom x WHERE x.parent_part_id = r.parent_part_id AND x.child_part_id = r.vid AND x.is_active) THEN
        DELETE FROM public.bom WHERE id = r.bom_id;
      ELSE
        UPDATE public.bom SET child_part_id = r.vid WHERE id = r.bom_id;
      END IF;
      v_fg := v_fg + 1;
    END IF;
  END LOOP;

  -- 7. Which base parts are built per brand.
  UPDATE public.parts p SET brand_relevant = EXISTS (SELECT 1 FROM _relv rv WHERE rv.part_id = p.id)
   WHERE p.branded_from IS NULL
     AND p.brand_relevant IS DISTINCT FROM EXISTS (SELECT 1 FROM _relv rv WHERE rv.part_id = p.id);

  PERFORM set_config('app.approving', 'off', true);
  PERFORM set_config('app.brand_sync', 'off', true);
  RETURN jsonb_build_object('created', v_created, 'retired', v_off, 'product_lines', v_fg,
                            'issues', (SELECT count(*) FROM public.brand_sync_issues));
END $function$;

-- Run the sync after anything that can change the answer.
CREATE OR REPLACE FUNCTION public.trg_brand_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.sync_brand_variants();
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS trg_bom_brand_sync ON public.bom;
CREATE TRIGGER trg_bom_brand_sync AFTER INSERT OR UPDATE OR DELETE ON public.bom
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_brand_sync();
DROP TRIGGER IF EXISTS trg_part_brands_sync ON public.part_brands;
CREATE TRIGGER trg_part_brands_sync AFTER INSERT OR UPDATE OR DELETE ON public.part_brands
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_brand_sync();
DROP TRIGGER IF EXISTS trg_parts_brand_sync ON public.parts;
CREATE TRIGGER trg_parts_brand_sync AFTER UPDATE OF branding_required, name, uom, is_active ON public.parts
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_brand_sync();

-- ---------------------------------------------------------------------------
-- The tick box. Management and Admin.
CREATE OR REPLACE FUNCTION public.set_part_branding(p_part_id uuid, p_required boolean, p_brands text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p public.parts; v_bad text; v_result jsonb;
BEGIN
  IF NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can change branding' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.parts WHERE id = p_part_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Part not found'; END IF;
  IF p.branded_from IS NOT NULL THEN
    RAISE EXCEPTION '% is already a brand version. Set branding on the base part.', p.part_code;
  END IF;
  IF p.source_type = 'FINISHED_GOOD' THEN
    RAISE EXCEPTION 'A finished good already carries its brand in its code';
  END IF;
  SELECT string_agg(x, ', ') INTO v_bad FROM unnest(coalesce(p_brands, '{}')) x
   WHERE NOT EXISTS (SELECT 1 FROM public.brands b WHERE b.letter = upper(x) AND b.is_active);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Not an active brand: %', v_bad; END IF;
  IF p_required AND coalesce(array_length(p_brands, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Pick at least one brand';
  END IF;

  PERFORM set_config('app.brand_sync', 'on', true);
  PERFORM set_config('app.approving', 'on', true);
  UPDATE public.parts SET branding_required = coalesce(p_required, false) WHERE id = p_part_id;
  DELETE FROM public.part_brands WHERE part_id = p_part_id
     AND (NOT coalesce(p_required, false) OR NOT (brand = ANY (SELECT upper(x) FROM unnest(p_brands) x)));
  IF p_required THEN
    INSERT INTO public.part_brands (part_id, brand)
    SELECT p_part_id, upper(x) FROM unnest(p_brands) x ON CONFLICT DO NOTHING;
  END IF;
  PERFORM set_config('app.approving', 'off', true);
  PERFORM set_config('app.brand_sync', 'off', true);

  v_result := public.sync_brand_variants();
  RETURN coalesce(v_result, '{}'::jsonb);
END $function$;
GRANT EXECUTE ON FUNCTION public.set_part_branding(uuid, boolean, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_brand_variants() TO authenticated;

-- A brand version is removed by unticking its brand, not by deleting it.
CREATE OR REPLACE FUNCTION public.guard_brand_version_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF OLD.branded_from IS NOT NULL AND coalesce(current_setting('app.brand_sync', true), '') <> 'on'
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION '% is a brand version. Untick its brand under Branding on the base part instead.', OLD.part_code;
  END IF;
  RETURN OLD;
END $function$;
DROP TRIGGER IF EXISTS trg_guard_brand_version_delete ON public.parts;
CREATE TRIGGER trg_guard_brand_version_delete BEFORE DELETE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.guard_brand_version_delete();

-- ---------------------------------------------------------------------------
-- Scheduling: never commit what branding makes impossible.
CREATE OR REPLACE FUNCTION public.schedule_projection_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p record; v_msg text; v_versions text;
BEGIN
  SELECT source_type, part_code, is_active, brand_relevant, branded_from INTO p
    FROM public.parts WHERE id = NEW.part_id;
  IF NOT p.is_active THEN
    RAISE EXCEPTION '% is no longer active, so it cannot be scheduled', p.part_code;
  END IF;
  IF NEW.projection_id IS NULL THEN
    IF p.source_type = 'FINISHED_GOOD' THEN
      RAISE EXCEPTION '% is a finished good: schedule it from a customer projection', p.part_code;
    END IF;
    IF p.source_type IS DISTINCT FROM 'ASSEMBLED_STOCKED' THEN
      RAISE EXCEPTION '% is not built here, so it cannot be scheduled', p.part_code;
    END IF;
  END IF;
  IF p.brand_relevant AND p.branded_from IS NULL THEN
    SELECT string_agg(part_code, ', ' ORDER BY part_code) INTO v_versions
      FROM public.parts WHERE branded_from = NEW.part_id AND is_active;
    RAISE EXCEPTION '% is printed per brand (or has a printed part inside), so it is built per brand. Schedule %.',
      p.part_code, coalesce(v_versions, 'its brand version - tick the brand under Branding first');
  END IF;
  IF p.source_type = 'ASSEMBLED_STOCKED' AND NOT EXISTS (
    SELECT 1 FROM public.bom b WHERE b.parent_part_id = NEW.part_id AND b.is_active
  ) THEN
    RAISE EXCEPTION '% has no BOM yet. Add its bill of materials before scheduling it', p.part_code;
  END IF;
  IF p.source_type = 'FINISHED_GOOD' THEN
    SELECT string_agg(message, ' ') INTO v_msg FROM public.brand_sync_issues
     WHERE part_id = NEW.part_id AND kind = 'GAP';
    IF v_msg IS NULL AND EXISTS (
      SELECT 1 FROM public.bom b JOIN public.parts c ON c.id = b.child_part_id
       WHERE b.parent_part_id = NEW.part_id AND b.is_active AND c.brand_relevant AND c.branded_from IS NULL
    ) THEN
      v_msg := p.part_code || ' uses a part that is printed per brand, and its brand version is missing. Check Branding on its parts.';
    END IF;
    IF v_msg IS NOT NULL THEN
      RAISE EXCEPTION '%', v_msg;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- ---------------------------------------------------------------------------
-- Scheduling with nested sub-assembly vouchers: an item may name the part it is
-- being built for ("parent_part_id"), e.g. printed tubes for the Croma mic that
-- is itself being built for the Croma finished good.
CREATE OR REPLACE FUNCTION public.issue_child_vouchers(
  p_plant_id uuid, p_root_part uuid, p_root_order uuid, p_default_date date, p_items jsonb
) RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE s jsonb; v_map jsonb := '{}'::jsonb; v_out jsonb := '[]'::jsonb; v_res jsonb;
  v_parent_part uuid; v_parent_order uuid; v_code text;
BEGIN
  FOR s IN SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    v_parent_part := coalesce(nullif(s->>'parent_part_id', '')::uuid, p_root_part);
    v_parent_order := CASE WHEN v_parent_part = p_root_part THEN p_root_order
                           ELSE (v_map->>v_parent_part::text)::uuid END;
    IF v_parent_order IS NULL THEN
      RAISE EXCEPTION 'A sub-assembly is listed before the voucher it is built for';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.bom b
       WHERE b.parent_part_id = v_parent_part AND b.child_part_id = (s->>'part_id')::uuid AND b.is_active
    ) THEN
      SELECT part_code INTO v_code FROM public.parts WHERE id = (s->>'part_id')::uuid;
      RAISE EXCEPTION '% is not on the BOM it is being built for', coalesce(v_code, 'That sub-assembly');
    END IF;
    v_res := public.schedule_subassembly(
      p_plant_id, (s->>'part_id')::uuid, (s->>'quantity')::numeric,
      coalesce(nullif(s->>'date', '')::date, p_default_date),
      nullif(s->>'line_id', '')::uuid, v_parent_order, NULL);
    v_map := v_map || jsonb_build_object(s->>'part_id', v_res->>'order_id');
    v_out := v_out || v_res;
  END LOOP;
  RETURN v_out;
END $function$;

CREATE OR REPLACE FUNCTION public.schedule_finished_good(
  p_plant_id uuid, p_projection_id uuid, p_quantity numeric, p_date date,
  p_line_id uuid DEFAULT NULL, p_subassemblies jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  pr      public.projections%ROWTYPE;
  v_left  numeric;
  v_sched uuid;
  v_order public.production_orders%ROWTYPE;
  v_subs  jsonb;
BEGIN
  SELECT * INTO pr FROM public.projections WHERE id = p_projection_id;
  IF pr.id IS NULL THEN
    RAISE EXCEPTION 'Projection not found';
  END IF;
  v_left := pr.quantity - coalesce(pr.scheduled_quantity, 0);
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be more than zero';
  END IF;
  IF p_quantity > v_left THEN
    RAISE EXCEPTION 'Only % left to schedule on this projection', v_left;
  END IF;

  INSERT INTO public.production_schedules (plant_id, projection_id, part_id, production_line_id,
    scheduled_date, quantity, status, created_by)
  VALUES (p_plant_id, pr.id, pr.part_id, p_line_id, p_date, p_quantity, 'PLANNED', auth.uid())
  RETURNING id INTO v_sched;

  INSERT INTO public.production_orders (plant_id, production_schedule_id, projection_id, part_id,
    quantity, planned_date, voucher_number, status, created_by)
  VALUES (p_plant_id, v_sched, pr.id, pr.part_id, p_quantity, p_date, '', 'PLANNED', auth.uid())
  RETURNING * INTO v_order;

  v_subs := public.issue_child_vouchers(p_plant_id, pr.part_id, v_order.id, p_date, p_subassemblies);

  RETURN jsonb_build_object('schedule_id', v_sched, 'order_id', v_order.id,
                            'voucher_number', v_order.voucher_number, 'subassemblies', v_subs);
END $function$;

-- A sub-assembly voucher together with the vouchers for what goes into it.
CREATE OR REPLACE FUNCTION public.schedule_subassembly_tree(
  p_plant_id uuid, p_part_id uuid, p_quantity numeric, p_date date,
  p_line_id uuid DEFAULT NULL, p_parent_order_id uuid DEFAULT NULL, p_children jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v_root jsonb;
BEGIN
  v_root := public.schedule_subassembly(p_plant_id, p_part_id, p_quantity, p_date, p_line_id, p_parent_order_id, NULL);
  RETURN v_root || jsonb_build_object('subassemblies',
    public.issue_child_vouchers(p_plant_id, p_part_id, (v_root->>'order_id')::uuid, p_date, p_children));
END $function$;

GRANT EXECUTE ON FUNCTION public.issue_child_vouchers(uuid, uuid, uuid, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_subassembly_tree(uuid, uuid, numeric, date, uuid, uuid, jsonb) TO authenticated;
