-- Three things the battery packs need.
--
-- 1. MADE IN-HOUSE EXCEPTION
--    A part's type comes from its code letter. The battery packs are built here
--    but have carried O codes for years - in Tally, in BOMs, on labels - so the
--    code stays and the part is marked made_in_house: it becomes a stocked
--    sub-assembly (BOM, CIR, PQC) while every other O part stays purchased.
--    Only Management or Admin can set the flag, and only on a purchase-letter
--    part (a sub-assembly letter already means made here).
--
-- 2. BUY IN ONE UNIT, USE IN ANOTHER
--    parts.uom is the unit the part is stocked, issued and used in on a BOM.
--    purchase_uom / purchase_factor say how it is bought:
--        1 purchase_uom = purchase_factor x uom      (1 ROLL = 50000 MM)
--    Default: bought in its own unit, factor 1.
--
-- 3. BULK BOM LINES
--    Solder and the like are on the BOM but are not issued per set: the line
--    gets a packet with each kit and more when it runs out. Such a line is
--    issue_mode = 'BULK' and has no quantity per set, so no calculation that
--    multiplies QPS by a quantity (holds, shortages, kits) counts it.

-- 1 -------------------------------------------------------------------------
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS made_in_house boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.parts.made_in_house IS
  'Exception: a purchase-letter code (e.g. O-073 battery pack) that is built here. Treated as a sub-assembly.';

CREATE OR REPLACE FUNCTION public.parts_enforce_category() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_kind public.part_source_type; v_tier text;
BEGIN
  SELECT kind, tier INTO v_kind, v_tier FROM public.part_categories WHERE prefix = NEW.category;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part category "%" is not in the part code registry. Add it under Parts first.', NEW.category;
  END IF;

  IF NEW.made_in_house AND v_tier <> 'PURCHASE' THEN
    NEW.made_in_house := false;   -- a made-here letter needs no exception
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.made_in_house) OR (TG_OP = 'UPDATE' AND NEW.made_in_house IS DISTINCT FROM OLD.made_in_house) THEN
    IF auth.uid() IS NOT NULL AND NOT public.can_approve() THEN
      RAISE EXCEPTION 'Only Management or Admin can mark a purchase code as made in-house' USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.source_type := CASE WHEN NEW.made_in_house THEN 'ASSEMBLED_STOCKED'::public.part_source_type ELSE v_kind END;
  NEW.part_code := upper(btrim(NEW.part_code));
  NEW.brand := CASE WHEN v_tier = 'FINISHED' THEN right(NEW.part_code, 2) END;
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
END $$;

-- 2 -------------------------------------------------------------------------
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS purchase_uom    text,
  ADD COLUMN IF NOT EXISTS purchase_factor numeric NOT NULL DEFAULT 1;
ALTER TABLE public.parts DROP CONSTRAINT IF EXISTS parts_purchase_factor_positive;
ALTER TABLE public.parts ADD CONSTRAINT parts_purchase_factor_positive CHECK (purchase_factor > 0);
COMMENT ON COLUMN public.parts.uom IS 'Stock unit: how the part is stored, issued and counted on a BOM line.';
COMMENT ON COLUMN public.parts.purchase_uom IS 'Unit it is bought in. NULL = same as uom.';
COMMENT ON COLUMN public.parts.purchase_factor IS '1 purchase_uom = purchase_factor x uom (1 ROLL = 50000 MM).';

-- 3 -------------------------------------------------------------------------
ALTER TABLE public.bom ADD COLUMN IF NOT EXISTS issue_mode text NOT NULL DEFAULT 'PER_SET';
ALTER TABLE public.bom ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE public.bom DROP CONSTRAINT IF EXISTS bom_quantity_check;
ALTER TABLE public.bom DROP CONSTRAINT IF EXISTS bom_issue_mode_quantity;
ALTER TABLE public.bom ADD CONSTRAINT bom_issue_mode_quantity CHECK (
  (issue_mode = 'PER_SET' AND quantity > 0) OR (issue_mode = 'BULK' AND quantity IS NULL));

-- save_bom / apply_bom carry issue_mode. A line with "bulk": true has no QPS.
CREATE OR REPLACE FUNCTION public.apply_bom(p_parent uuid, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_added int; v_changed int; v_removed int;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _bom_next (child_part_id uuid PRIMARY KEY, quantity numeric, uom text,
                                             is_critical boolean, issue_mode text) ON COMMIT DROP;
  -- WHERE true: pg_safeupdate refuses a DELETE without WHERE on API calls.
  DELETE FROM _bom_next WHERE true;
  INSERT INTO _bom_next
  SELECT (l->>'child_part_id')::uuid,
         CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN NULL ELSE (l->>'quantity')::numeric END,
         coalesce(nullif(l->>'uom', ''), 'PCS'),
         coalesce((l->>'is_critical')::boolean, false),
         CASE WHEN coalesce((l->>'bulk')::boolean, false) THEN 'BULK' ELSE 'PER_SET' END
    FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l;

  DELETE FROM public.bom b WHERE b.parent_part_id = p_parent AND b.is_active
     AND NOT EXISTS (SELECT 1 FROM _bom_next n WHERE n.child_part_id = b.child_part_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  UPDATE public.bom b SET quantity = n.quantity, uom = n.uom, is_critical = n.is_critical, issue_mode = n.issue_mode
    FROM _bom_next n
   WHERE b.parent_part_id = p_parent AND b.is_active AND b.child_part_id = n.child_part_id
     AND (b.quantity IS DISTINCT FROM n.quantity OR b.is_critical IS DISTINCT FROM n.is_critical
          OR b.uom IS DISTINCT FROM n.uom OR b.issue_mode IS DISTINCT FROM n.issue_mode);
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  INSERT INTO public.bom (parent_part_id, child_part_id, quantity, uom, is_critical, issue_mode, created_by)
  SELECT p_parent, n.child_part_id, n.quantity, n.uom, n.is_critical, n.issue_mode, auth.uid()
    FROM _bom_next n
   WHERE NOT EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = p_parent AND b.is_active
                                                  AND b.child_part_id = n.child_part_id);
  GET DIAGNOSTICS v_added = ROW_COUNT;
  RETURN jsonb_build_object('added', v_added, 'changed', v_changed, 'removed', v_removed);
END $$;
REVOKE ALL ON FUNCTION public.apply_bom(uuid, jsonb) FROM PUBLIC, authenticated, anon;

CREATE OR REPLACE FUNCTION public.save_bom(p_parent uuid, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_req uuid; v_result jsonb;
BEGIN
  IF NOT public.can_edit_masters() THEN
    RAISE EXCEPTION 'Only R&D, Management or Admin can change a bill of materials' USING ERRCODE = '42501';
  END IF;
  IF (SELECT source_type FROM public.parts WHERE id = p_parent) = 'PURCHASED' THEN
    RAISE EXCEPTION 'A purchased part cannot have a bill of materials';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
              WHERE (l->>'child_part_id')::uuid = p_parent
                 OR (NOT coalesce((l->>'bulk')::boolean, false) AND coalesce((l->>'quantity')::numeric, 0) <= 0)) THEN
    RAISE EXCEPTION 'Every line needs a quantity above zero (or is marked bulk), and a part cannot be inside itself';
  END IF;

  IF public.can_approve() THEN
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
  RETURN jsonb_build_object('applied', false, 'request_id', v_req);
END $$;
GRANT EXECUTE ON FUNCTION public.save_bom(uuid, jsonb) TO authenticated;
