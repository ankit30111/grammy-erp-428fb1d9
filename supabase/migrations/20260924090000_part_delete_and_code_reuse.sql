-- Deleting a part, and giving its code back.
--
-- "Delete" on the Parts page only set is_active = false. The part stayed in the
-- list looking exactly as before, and its code stayed taken, so creating SA-004
-- again failed with a duplicate-key error. While the part master is still being
-- set up, a code that nothing has used yet should be deletable outright and
-- issued again.
--
--   delete_part(id)
--     * nothing refers to the part (no stock, PO, GRN, plan, production,
--       quality record, and it is in no other part's BOM)
--         -> the part, its own BOM lines, vendor links and spec history go,
--            and the code is released for reuse
--     * something does refer to it
--         -> it is deactivated instead, and the caller is told where it is used
--   Being inside another part's BOM blocks both: that BOM would silently lose
--   a line. Remove it from that BOM first.
--
-- next_part_code() hands out the lowest released code of the prefix first, so
-- deleting SA-004 makes the next new sub-assembly SA-004 again. Codes that were
-- never issued (the blanks in the imported master list) are not released and
-- are not handed out.

CREATE TABLE IF NOT EXISTS public.released_part_codes (
  part_code   text PRIMARY KEY,
  prefix      text NOT NULL,
  seq         int  NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  released_by uuid
);
ALTER TABLE public.released_part_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS released_part_codes_read ON public.released_part_codes;
CREATE POLICY released_part_codes_read ON public.released_part_codes FOR SELECT USING (public.has_role(NULL::text));
GRANT SELECT ON public.released_part_codes TO authenticated;

-- Where a part is used, as readable text. Every table with a foreign key to
-- parts is checked, so a table added later is covered without editing this.
CREATE OR REPLACE FUNCTION public.part_usage(p_part_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_n bigint; v_out text[] := '{}';
BEGIN
  FOR r IN
    SELECT t.relname::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND c.confrelid = 'public.parts'::regclass
       AND c.connamespace = 'public'::regnamespace
       -- the part's own rows, removed with it
       AND t.relname NOT IN ('part_vendors', 'part_specifications', 'bom_change_requests')
       AND NOT (t.relname = 'bom' AND a.attname = 'parent_part_id')
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.tbl, r.col) INTO v_n USING p_part_id;
    IF v_n > 0 THEN
      v_out := v_out || CASE
        WHEN r.tbl = 'bom' THEN 'the BOM of ' || (
          SELECT string_agg(p.part_code, ', ' ORDER BY p.part_code)
            FROM public.bom b JOIN public.parts p ON p.id = b.parent_part_id WHERE b.child_part_id = p_part_id)
        ELSE replace(r.tbl, '_', ' ') || ' (' || v_n || ')' END;
    END IF;
  END LOOP;
  RETURN v_out;
END $$;

CREATE OR REPLACE FUNCTION public.delete_part(p_part_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.parts; v_used text[]; v_in_bom text;
BEGIN
  SELECT * INTO p FROM public.parts WHERE id = p_part_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That part no longer exists'; END IF;

  -- Management and Admin; R&D only for their own part that is still pending.
  IF NOT (public.can_approve()
          OR (public.can_edit_masters() AND p.approval_status <> 'APPROVED' AND p.submitted_by = auth.uid())) THEN
    RAISE EXCEPTION 'Only Management or Admin can delete a part' USING ERRCODE = '42501';
  END IF;

  SELECT string_agg(pp.part_code, ', ' ORDER BY pp.part_code) INTO v_in_bom
    FROM public.bom b JOIN public.parts pp ON pp.id = b.parent_part_id
   WHERE b.child_part_id = p_part_id;
  IF v_in_bom IS NOT NULL THEN
    RAISE EXCEPTION '% is in the BOM of %. Remove it from there first.', p.part_code, v_in_bom;
  END IF;

  v_used := public.part_usage(p_part_id);
  IF array_length(v_used, 1) IS NOT NULL THEN
    PERFORM set_config('app.approving', 'on', true);
    UPDATE public.parts SET is_active = false WHERE id = p_part_id;
    PERFORM set_config('app.approving', 'off', true);
    RETURN jsonb_build_object('result', 'DEACTIVATED', 'part_code', p.part_code, 'used_in', to_jsonb(v_used));
  END IF;

  DELETE FROM public.bom WHERE parent_part_id = p_part_id;
  DELETE FROM public.part_vendors WHERE part_id = p_part_id;
  DELETE FROM public.part_specifications WHERE part_id = p_part_id;
  DELETE FROM public.bom_change_requests WHERE parent_part_id = p_part_id;
  DELETE FROM public.parts WHERE id = p_part_id;

  -- Only a code in the issuer's own shape is handed out again; a hand-typed
  -- code such as P-002A is simply free to be typed again.
  IF p.part_code ~ ('^' || p.category || '-[0-9]{3,}([A-Z]{2})?$') THEN
    INSERT INTO public.released_part_codes (part_code, prefix, seq, released_by)
    VALUES (regexp_replace(p.part_code, '[A-Z]{2}$', '') , p.category,
            (regexp_match(p.part_code, '-([0-9]+)'))[1]::int, auth.uid())
    ON CONFLICT (part_code) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('result', 'DELETED', 'part_code', p.part_code);
END $$;
GRANT EXECUTE ON FUNCTION public.delete_part(uuid), public.part_usage(uuid) TO authenticated;

-- Bring a deactivated part back.
CREATE OR REPLACE FUNCTION public.reactivate_part(p_part_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.can_approve() THEN
    RAISE EXCEPTION 'Only Management or Admin can reactivate a part' USING ERRCODE = '42501';
  END IF;
  UPDATE public.parts SET is_active = true WHERE id = p_part_id;
END $$;
GRANT EXECUTE ON FUNCTION public.reactivate_part(uuid) TO authenticated;

-- Issuer: a released code of this prefix first, then the next number.
CREATE OR REPLACE FUNCTION public.next_part_code(p_prefix text, p_brand text DEFAULT NULL::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_tier text; v_seq int; v_base text; v_brand text := upper(nullif(btrim(p_brand), ''));
BEGIN
  SELECT tier, next_sequence INTO v_tier, v_seq FROM public.part_categories
   WHERE prefix = upper(p_prefix) AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active part category with prefix "%"', upper(p_prefix); END IF;

  IF v_tier = 'FINISHED' THEN
    IF v_brand IS NULL THEN RAISE EXCEPTION 'A finished good needs a brand code'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.brands WHERE letter = v_brand AND is_active) THEN
      RAISE EXCEPTION 'No active brand with code "%"', v_brand; END IF;
  ELSE
    v_brand := NULL;
  END IF;

  -- Lowest released code still free. Not removed here: the code is only
  -- really reused once a part is saved with it, and a cancelled form must not
  -- lose it. A saved part makes it "not free" and the next call skips it.
  SELECT r.part_code INTO v_base FROM public.released_part_codes r
   WHERE r.prefix = upper(p_prefix)
     AND NOT EXISTS (SELECT 1 FROM public.parts pa WHERE pa.part_code ~ ('^' || r.part_code || '[A-Z]{0,2}$'))
   ORDER BY r.seq LIMIT 1;
  IF v_base IS NOT NULL THEN
    RETURN v_base || coalesce(v_brand, '');
  END IF;

  -- One past the highest number in use. Not a counter that each call moves
  -- on: the create form asks for a code as soon as a category is picked, and
  -- a counter burnt a number every time the form was opened and closed - which
  -- is how SA-007 came to be skipped. Two people saving the same code at once
  -- is caught by the unique key and the second is asked to save again.
  SELECT coalesce(max((regexp_match(part_code, '^' || upper(p_prefix) || '-([0-9]+)'))[1]::int), 0) + 1
    INTO v_seq FROM public.parts WHERE category = upper(p_prefix);
  v_base := upper(p_prefix) || '-' || lpad(v_seq::text, 3, '0');
  RETURN v_base || coalesce(v_brand, '');
END; $function$;

-- A released code, once used again, is no longer released.
CREATE OR REPLACE FUNCTION public.parts_claim_released_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.released_part_codes
   WHERE NEW.part_code ~ ('^' || part_code || '[A-Z]{0,2}$');
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_parts_claim_released_code ON public.parts;
CREATE TRIGGER trg_parts_claim_released_code AFTER INSERT OR UPDATE OF part_code ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.parts_claim_released_code();

-- ---------------------------------------------------------------------------
-- Fix: every BOM save from the screen failed with "DELETE requires a WHERE
-- clause" (pg_safeupdate). apply_bom re-created with WHERE true.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_bom(p_parent uuid, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_added int; v_changed int; v_removed int;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _bom_next (child_part_id uuid PRIMARY KEY, quantity numeric, uom text, is_critical boolean) ON COMMIT DROP;
  -- WHERE true: Supabase runs pg_safeupdate for API calls, which refuses a
  -- DELETE without a WHERE clause - even on a temp table. Every BOM save from
  -- the screen failed on this line.
  DELETE FROM _bom_next WHERE true;
  INSERT INTO _bom_next
  SELECT (l->>'child_part_id')::uuid, (l->>'quantity')::numeric, coalesce(nullif(l->>'uom', ''), 'PCS'),
         coalesce((l->>'is_critical')::boolean, false)
    FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l;

  DELETE FROM public.bom b WHERE b.parent_part_id = p_parent AND b.is_active
     AND NOT EXISTS (SELECT 1 FROM _bom_next n WHERE n.child_part_id = b.child_part_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  UPDATE public.bom b SET quantity = n.quantity, uom = n.uom, is_critical = n.is_critical
    FROM _bom_next n
   WHERE b.parent_part_id = p_parent AND b.is_active AND b.child_part_id = n.child_part_id
     AND (b.quantity <> n.quantity OR b.is_critical IS DISTINCT FROM n.is_critical OR b.uom IS DISTINCT FROM n.uom);
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  INSERT INTO public.bom (parent_part_id, child_part_id, quantity, uom, is_critical, created_by)
  SELECT p_parent, n.child_part_id, n.quantity, n.uom, n.is_critical, auth.uid()
    FROM _bom_next n
   WHERE NOT EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = p_parent AND b.is_active
                                                  AND b.child_part_id = n.child_part_id);
  GET DIAGNOSTICS v_added = ROW_COUNT;

  RETURN jsonb_build_object('added', v_added, 'changed', v_changed, 'removed', v_removed);
END $$;
