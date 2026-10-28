-- ECN: part replacement and correction across every product, with Management approval.
--
--   Types        BOM_CHANGE   (existing: change one product's BOM on its BOM tab)
--                REPLACEMENT  (part changed: new part code; old part phased out)
--                CORRECTION   (wrong code was entered; nothing physical changed)
--   Approval     R&D prepares and sends -> Management approves (or sends it back).
--   Effect       From release, all production uses the new part. Only when using up the
--                old stock is confirmed does it wait for a date (released automatically).
--   Old part     REPLACEMENT -> PHASE_OUT (OBSOLETE once nothing uses it and no stock)
--                CORRECTION  -> OBSOLETE. Neither can be ordered on a PO again.

-- 1. ECN header ------------------------------------------------------------------
ALTER TABLE public.ecns DROP CONSTRAINT IF EXISTS ecns_status_check;
ALTER TABLE public.ecns ADD CONSTRAINT ecns_status_check
  CHECK (status = ANY (ARRAY['DRAFT','SUBMITTED','APPROVED','RELEASED','CANCELLED']));
ALTER TABLE public.ecns
  ADD COLUMN IF NOT EXISTS change_type text NOT NULL DEFAULT 'BOM_CHANGE'
    CHECK (change_type IN ('BOM_CHANGE','REPLACEMENT','CORRECTION')),
  ADD COLUMN IF NOT EXISTS old_part_id uuid REFERENCES public.parts(id),
  ADD COLUMN IF NOT EXISTS new_part_id uuid REFERENCES public.parts(id),
  ADD COLUMN IF NOT EXISTS new_quantity numeric CHECK (new_quantity IS NULL OR new_quantity > 0),
  ADD COLUMN IF NOT EXISTS new_part_created boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_old_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS old_stock_action text CHECK (old_stock_action IN ('REWORK','RETURN','SCRAP','SPARES','USE_ELSEWHERE','NONE')),
  ADD COLUMN IF NOT EXISTS old_stock_note text,
  ADD COLUMN IF NOT EXISTS release_brands uuid[],
  ADD COLUMN IF NOT EXISTS submitted_by uuid, ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_note text, ADD COLUMN IF NOT EXISTS returned_by uuid, ADD COLUMN IF NOT EXISTS returned_at timestamptz;

-- Production BOMs that have no engineering version (older sub-assemblies, or a brand code
-- whose BOM was edited by hand): the part is swapped in them directly on release.
CREATE TABLE IF NOT EXISTS public.ecn_bom_swaps (
  ecn_id uuid NOT NULL REFERENCES public.ecns(id) ON DELETE CASCADE,
  parent_part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  PRIMARY KEY (ecn_id, parent_part_id)
);
ALTER TABLE public.ecn_bom_swaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ecn_bom_swaps_read ON public.ecn_bom_swaps;
CREATE POLICY ecn_bom_swaps_read ON public.ecn_bom_swaps FOR SELECT TO authenticated USING (public.has_role('rnd') OR public.can_approve());
GRANT SELECT ON public.ecn_bom_swaps TO authenticated;

-- 2. Part life cycle ---------------------------------------------------------------
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS lifecycle text NOT NULL DEFAULT 'ACTIVE' CHECK (lifecycle IN ('ACTIVE','PHASE_OUT','OBSOLETE')),
  ADD COLUMN IF NOT EXISTS replaced_by uuid REFERENCES public.parts(id),
  ADD COLUMN IF NOT EXISTS replaced_by_ecn uuid REFERENCES public.ecns(id);
GRANT SELECT (lifecycle, replaced_by, replaced_by_ecn) ON public.parts TO authenticated;

-- A replaced part cannot be ordered again.
CREATE OR REPLACE FUNCTION public.po_item_part_active() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.part_id IS NOT DISTINCT FROM OLD.part_id THEN RETURN NEW; END IF;
  SELECT x.part_code, x.lifecycle, r.part_code AS by_code, e.ecn_no INTO p
    FROM public.parts x LEFT JOIN public.parts r ON r.id = x.replaced_by LEFT JOIN public.ecns e ON e.id = x.replaced_by_ecn
   WHERE x.id = NEW.part_id;
  IF p.lifecycle IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION '% is replaced by % and cannot be ordered. Order % instead.',
      p.part_code, coalesce(p.by_code, 'another part') || coalesce(' (' || p.ecn_no || ')', ''), coalesce(p.by_code, 'the new part');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_po_item_part_active ON public.purchase_order_items;
CREATE TRIGGER trg_po_item_part_active BEFORE INSERT OR UPDATE OF part_id ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.po_item_part_active();

-- 3. Where the part is used, and what is in hand ---------------------------------------
CREATE OR REPLACE FUNCTION public.ecn_part_where_used(p_part uuid)
RETURNS TABLE(kind text, item_id uuid, part_code text, name text, source_type text, version text,
              usage text, busy_in text, brand_codes text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH latest AS (
    SELECT DISTINCT ON (iv.item_id) iv.id, iv.item_id, iv.version
      FROM public.item_versions iv WHERE iv.status = 'RELEASED' ORDER BY iv.item_id, iv.major DESC, iv.minor DESC
  ), v AS (
    SELECT 'VERSION'::text AS kind, lt.item_id, p.part_code, p.name, p.source_type::text, lt.version,
           string_agg(CASE WHEN l.bulk THEN 'bulk' ELSE trim(to_char(l.quantity, 'FM999999990.######'), '.') END
                      || CASE WHEN l.brands IS NULL THEN '' ELSE ' for ' || array_to_string(l.brands, ', ') END, ' · ') AS usage,
           (SELECT coalesce(e.ecn_no, 'its first-version draft') FROM public.item_versions d LEFT JOIN public.ecns e ON e.id = d.ecn_id
             WHERE d.item_id = lt.item_id AND d.status = 'DRAFT' LIMIT 1) AS busy_in,
           (SELECT string_agg(f.part_code, ', ' ORDER BY f.part_code) FROM public.parts f
             WHERE f.model_id = lt.item_id AND f.source_type = 'FINISHED_GOOD' AND f.is_active) AS brand_codes
      FROM latest lt JOIN public.version_lines l ON l.version_id = lt.id
      JOIN public.parts p ON p.id = lt.item_id
     WHERE l.part_id = p_part
     GROUP BY lt.item_id, p.part_code, p.name, p.source_type, lt.version
  )
  SELECT * FROM v
  UNION ALL
  SELECT 'PRODUCTION', b.parent_part_id, p.part_code, p.name, p.source_type::text, NULL::text,
         string_agg(CASE WHEN b.issue_mode = 'BULK' THEN 'bulk' ELSE trim(to_char(b.quantity, 'FM999999990.######'), '.') END, ' · '),
         NULL::text, NULL::text
    FROM public.bom b JOIN public.parts p ON p.id = b.parent_part_id
   WHERE b.child_part_id = p_part AND b.is_active AND p.branded_from IS NULL
     AND NOT EXISTS (SELECT 1 FROM v WHERE v.item_id = b.parent_part_id OR v.item_id = p.model_id)
   GROUP BY b.parent_part_id, p.part_code, p.name, p.source_type
   ORDER BY 1 DESC, 3;
$$;

CREATE OR REPLACE FUNCTION public.ecn_part_impact(p_part uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'uom', (SELECT uom FROM public.parts WHERE id = p_part),
    'stock', coalesce((SELECT jsonb_agg(jsonb_build_object('location', l.name, 'code', l.code, 'quantity', s.quantity) ORDER BY l.code)
                         FROM public.stock_balance s JOIN public.stock_locations l ON l.id = s.location_id
                        WHERE s.part_id = p_part AND s.quantity <> 0), '[]'::jsonb),
    'open_pos', coalesce((SELECT jsonb_agg(jsonb_build_object('po_number', po.po_number, 'status', po.status,
                                  'ordered', i.quantity, 'received', coalesce(i.received_quantity, 0)) ORDER BY po.po_number)
                         FROM public.purchase_order_items i JOIN public.purchase_orders po ON po.id = i.purchase_order_id
                        WHERE i.part_id = p_part AND coalesce(i.received_quantity, 0) < i.quantity
                          AND po.status::text NOT IN ('CANCELLED','CLOSED','RECEIVED','REJECTED')), '[]'::jsonb));
$$;

-- 4. New code made from the old one (same category, unit and vendors) ----------------
CREATE OR REPLACE FUNCTION public.ecn_part_copy(p_old uuid, p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.parts; v_code text; v_id uuid;
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can make a part for an ECN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO o FROM public.parts WHERE id = p_old;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Part not found'; END IF;
  IF o.source_type::text IN ('MODEL','FINISHED_GOOD') OR o.branded_from IS NOT NULL THEN
    RAISE EXCEPTION '% is a product or a brand version; pick the part itself', o.part_code;
  END IF;
  IF coalesce(btrim(p_name), '') = '' THEN RAISE EXCEPTION 'Give the new part a name'; END IF;
  v_code := public.next_part_code(o.category, NULL);
  PERFORM set_config('app.brand_sync', 'on', true);   -- approved with the ECN that uses it
  INSERT INTO public.parts (part_code, name, category, uom, purchase_uom, purchase_factor, source_type, made_in_house,
                            sourcing_type, approval_status, plant_id, created_by)
  VALUES (v_code, btrim(p_name), o.category, o.uom, o.purchase_uom, o.purchase_factor, o.source_type, o.made_in_house,
          o.sourcing_type, 'APPROVED', o.plant_id, auth.uid())
  RETURNING id INTO v_id;
  PERFORM set_config('app.brand_sync', 'off', true);
  INSERT INTO public.part_vendors (part_id, vendor_id, is_primary)
  SELECT v_id, vendor_id, is_primary FROM public.part_vendors WHERE part_id = p_old;
  RETURN jsonb_build_object('id', v_id, 'part_code', v_code);
END $$;

-- 5. Raise: one ECN, every chosen product ---------------------------------------------
CREATE OR REPLACE FUNCTION public.ecn_raise_part_change(
  p_type text, p_title text, p_reason text, p_old uuid, p_new uuid,
  p_items uuid[], p_production uuid[], p_qty numeric, p_new_created boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; n record; v_ecn uuid; v_item uuid; v_draft uuid; v_code text; v_type text := upper(btrim(p_type));
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can raise an ECN' USING ERRCODE = '42501'; END IF;
  IF v_type NOT IN ('REPLACEMENT','CORRECTION') THEN RAISE EXCEPTION 'Type is REPLACEMENT or CORRECTION'; END IF;
  IF coalesce(btrim(p_title), '') = '' THEN RAISE EXCEPTION 'Say what changes'; END IF;
  IF p_old IS NULL OR p_new IS NULL OR p_old = p_new THEN RAISE EXCEPTION 'Pick the old part and a different new part'; END IF;
  SELECT * INTO o FROM public.parts WHERE id = p_old;
  SELECT * INTO n FROM public.parts WHERE id = p_new;
  IF n.source_type::text IN ('MODEL','FINISHED_GOOD') OR n.branded_from IS NOT NULL THEN
    RAISE EXCEPTION '% is a product or a brand version; pick the part itself', n.part_code;
  END IF;
  IF n.approval_status <> 'APPROVED' THEN RAISE EXCEPTION '% is not approved yet', n.part_code; END IF;
  IF n.lifecycle <> 'ACTIVE' OR NOT n.is_active THEN RAISE EXCEPTION '% is not an active part', n.part_code; END IF;
  IF o.uom IS DISTINCT FROM n.uom AND p_qty IS NULL THEN
    RAISE EXCEPTION '% is in % and % in %: give the new quantity', o.part_code, o.uom, n.part_code, n.uom;
  END IF;
  IF cardinality(coalesce(p_items, '{}')) + cardinality(coalesce(p_production, '{}')) = 0 THEN
    RAISE EXCEPTION 'Tick at least one product or sub-assembly';
  END IF;

  INSERT INTO public.ecns (title, reason, change_type, old_part_id, new_part_id, new_quantity, new_part_created)
  VALUES (btrim(p_title), nullif(btrim(coalesce(p_reason, '')), ''), v_type, p_old, p_new, p_qty, coalesce(p_new_created, false))
  RETURNING id INTO v_ecn;

  FOREACH v_item IN ARRAY coalesce(p_items, '{}') LOOP
    SELECT part_code INTO v_code FROM public.parts WHERE id = v_item;
    IF NOT EXISTS (SELECT 1 FROM public.version_lines WHERE version_id = public.item_latest_released(v_item) AND part_id = p_old) THEN
      RAISE EXCEPTION '% does not use % in its released version', v_code, o.part_code;
    END IF;
    v_draft := public.ecn_item_draft(v_ecn, v_item, false);
    IF EXISTS (SELECT 1 FROM public.version_lines WHERE version_id = v_draft AND part_id = p_new) THEN
      RAISE EXCEPTION '% already has % on its BOM. Change that one by hand in a BOM change ECN.', v_code, n.part_code;
    END IF;
    UPDATE public.version_lines
       SET part_id = p_new, quantity = CASE WHEN bulk THEN NULL ELSE coalesce(p_qty, quantity) END,
           change_type = 'CHANGED', replaces_part_id = p_old
     WHERE version_id = v_draft AND part_id = p_old;
    IF (SELECT source_type::text FROM public.parts WHERE id = v_item) <> 'MODEL' THEN
      PERFORM public.ecn_bump_users(v_ecn, v_item, v_draft, 1);
    END IF;
  END LOOP;

  FOREACH v_item IN ARRAY coalesce(p_production, '{}') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.bom WHERE parent_part_id = v_item AND child_part_id = p_old AND is_active) THEN
      RAISE EXCEPTION '% does not use % in its production BOM', (SELECT part_code FROM public.parts WHERE id = v_item), o.part_code;
    END IF;
    IF EXISTS (SELECT 1 FROM public.bom WHERE parent_part_id = v_item AND child_part_id = p_new AND is_active) THEN
      RAISE EXCEPTION '% already has % on its BOM', (SELECT part_code FROM public.parts WHERE id = v_item), n.part_code;
    END IF;
    INSERT INTO public.ecn_bom_swaps (ecn_id, parent_part_id) VALUES (v_ecn, v_item) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN v_ecn;
END $$;

-- 6. Approval ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ecn_submit(p_ecn uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can send an ECN' USING ERRCODE = '42501'; END IF;
  IF (SELECT status FROM public.ecns WHERE id = p_ecn) <> 'DRAFT' THEN RAISE EXCEPTION 'Only an ECN being prepared can be sent'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.item_versions WHERE ecn_id = p_ecn AND status = 'DRAFT')
     AND NOT EXISTS (SELECT 1 FROM public.ecn_bom_swaps WHERE ecn_id = p_ecn) THEN
    RAISE EXCEPTION 'This ECN changes nothing yet';
  END IF;
  UPDATE public.ecns SET status = 'SUBMITTED', submitted_by = auth.uid(), submitted_at = now() WHERE id = p_ecn;
END $$;

CREATE OR REPLACE FUNCTION public.ecn_send_back(p_ecn uuid, p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management can send an ECN back' USING ERRCODE = '42501'; END IF;
  IF (SELECT status FROM public.ecns WHERE id = p_ecn) NOT IN ('SUBMITTED','APPROVED') THEN RAISE EXCEPTION 'Only an ECN waiting for approval can be sent back'; END IF;
  IF coalesce(btrim(p_note), '') = '' THEN RAISE EXCEPTION 'Say what needs to change'; END IF;
  UPDATE public.ecns SET status = 'DRAFT', returned_note = btrim(p_note), returned_by = auth.uid(), returned_at = now(),
         approved_by = NULL, approved_at = NULL, effective_from = NULL WHERE id = p_ecn;
END $$;

-- What the old stock does; "use it up first" must be said explicitly.
CREATE OR REPLACE FUNCTION public.ecn_set_old_stock(p_ecn uuid, p_use_old boolean, p_from date, p_action text, p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can change an ECN' USING ERRCODE = '42501'; END IF;
  IF (SELECT status FROM public.ecns WHERE id = p_ecn) NOT IN ('DRAFT','SUBMITTED') THEN RAISE EXCEPTION 'Only an open ECN can change'; END IF;
  IF coalesce(p_use_old, false) AND p_from IS NULL THEN RAISE EXCEPTION 'Give the date from which the new part is used'; END IF;
  UPDATE public.ecns SET use_old_stock = coalesce(p_use_old, false),
         effective_from = CASE WHEN coalesce(p_use_old, false) THEN p_from END,
         old_stock_action = nullif(upper(btrim(coalesce(p_action, ''))), ''), old_stock_note = nullif(btrim(coalesce(p_note, '')), '')
   WHERE id = p_ecn;
END $$;

-- 7. Release (applies everything; the only path that changes production) --------------
CREATE OR REPLACE FUNCTION public.ecn_apply(p_ecn uuid, p_brands uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; v_set uuid[]; v_brands uuid[]; v_res jsonb := '{}'::jsonb; v_swapped int := 0; r record; v_used boolean; v_stock numeric;
BEGIN
  SELECT * INTO e FROM public.ecns WHERE id = p_ecn FOR UPDATE;
  IF e.status NOT IN ('DRAFT','SUBMITTED','APPROVED') THEN RAISE EXCEPTION 'Only an open ECN is released'; END IF;
  SELECT array_agg(id) INTO v_set FROM public.item_versions WHERE ecn_id = p_ecn AND status = 'DRAFT';
  v_brands := coalesce(p_brands, e.release_brands,
    (SELECT array_agg(f.id) FROM public.parts f JOIN public.item_versions iv ON iv.item_id = f.model_id AND iv.id = ANY (coalesce(v_set, '{}'))
      WHERE f.source_type = 'FINISHED_GOOD' AND f.is_active));

  PERFORM set_config('app.ecn_apply', 'on', true);
  IF cardinality(coalesce(v_set, '{}')) > 0 THEN v_res := public.versions_release(v_set, v_brands); END IF;

  -- production BOMs without a version
  PERFORM set_config('app.approving', 'on', true);
  FOR r IN SELECT s.parent_part_id FROM public.ecn_bom_swaps s WHERE s.ecn_id = p_ecn LOOP
    UPDATE public.bom b SET child_part_id = e.new_part_id,
           quantity = CASE WHEN b.issue_mode = 'BULK' THEN NULL ELSE coalesce(e.new_quantity, b.quantity) END,
           uom = (SELECT uom FROM public.parts WHERE id = e.new_part_id)
     WHERE b.parent_part_id = r.parent_part_id AND b.child_part_id = e.old_part_id AND b.is_active;
    v_swapped := v_swapped + 1;
  END LOOP;
  IF v_swapped > 0 THEN PERFORM public.sync_brand_variants(); END IF;

  -- the old part
  IF e.change_type IN ('REPLACEMENT','CORRECTION') THEN
    SELECT EXISTS (SELECT 1 FROM public.bom WHERE child_part_id = e.old_part_id AND is_active)
        OR EXISTS (SELECT 1 FROM public.version_lines l WHERE l.part_id = e.old_part_id
                     AND l.version_id IN (SELECT public.item_latest_released(iv.item_id) FROM public.item_versions iv))
      INTO v_used;
    SELECT coalesce(sum(quantity), 0) INTO v_stock FROM public.stock_balance WHERE part_id = e.old_part_id;
    UPDATE public.parts SET replaced_by = e.new_part_id, replaced_by_ecn = p_ecn,
           lifecycle = CASE WHEN e.change_type = 'CORRECTION' OR (NOT v_used AND v_stock = 0) THEN 'OBSOLETE' ELSE 'PHASE_OUT' END
     WHERE id = e.old_part_id;
  END IF;
  PERFORM set_config('app.approving', 'off', true);
  PERFORM set_config('app.ecn_apply', 'off', true);

  UPDATE public.ecns SET status = 'RELEASED', released_by = auth.uid(), released_at = now(),
         approved_by = coalesce(approved_by, auth.uid()), approved_at = coalesce(approved_at, now()), release_brands = v_brands
   WHERE id = p_ecn;
  RETURN v_res || jsonb_build_object('production_swapped', v_swapped);
END $$;
REVOKE ALL ON FUNCTION public.ecn_apply(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

-- Management approves: released at once, or on the date when using up old stock was confirmed.
CREATE OR REPLACE FUNCTION public.ecn_approve(p_ecn uuid, p_brands uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management approves an ECN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO e FROM public.ecns WHERE id = p_ecn;
  IF e.status NOT IN ('DRAFT','SUBMITTED') THEN RAISE EXCEPTION 'Only an open ECN can be approved'; END IF;
  IF e.use_old_stock AND e.effective_from > v_today THEN
    UPDATE public.ecns SET status = 'APPROVED', approved_by = auth.uid(), approved_at = now(), release_brands = p_brands WHERE id = p_ecn;
    RETURN jsonb_build_object('scheduled', e.effective_from);
  END IF;
  UPDATE public.ecns SET approved_by = auth.uid(), approved_at = now() WHERE id = p_ecn;
  RETURN public.ecn_apply(p_ecn, p_brands);
END $$;

-- The existing per-product release keeps working and goes through the same path.
CREATE OR REPLACE FUNCTION public.ecn_release(p_ecn uuid, p_brands uuid[] DEFAULT '{}'::uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.ecn_approve(p_ecn, p_brands);
END $$;

CREATE OR REPLACE FUNCTION public.ecn_release_due() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id, release_brands FROM public.ecns
            WHERE status = 'APPROVED' AND effective_from <= (now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY approved_at LOOP
    PERFORM public.ecn_apply(r.id, r.release_brands);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.ecn_release_due() FROM PUBLIC, anon, authenticated;

-- versions_release: Management, or an approved ECN being applied
DO $$
DECLARE src text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc WHERE proname = 'versions_release';
  IF position('app.ecn_apply' IN src) = 0 THEN
    src := replace(src, 'IF NOT public.can_approve() THEN RAISE EXCEPTION ''Only Management or Admin release a version''',
                        'IF NOT (public.can_approve() OR coalesce(current_setting(''app.ecn_apply'', true), '''') = ''on'') THEN RAISE EXCEPTION ''Only Management or Admin release a version''');
    EXECUTE format('CREATE OR REPLACE FUNCTION public.versions_release(p_set uuid[], p_brands uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '''' AS %L', src);
  END IF;
END $$;

-- ecn_update / ecn_cancel accept a sent ECN too; cancel also removes a new code made for it
CREATE OR REPLACE FUNCTION public.ecn_update(p_ecn uuid, p_title text, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can change an ECN' USING ERRCODE = '42501'; END IF;
  IF (SELECT status FROM public.ecns WHERE id = p_ecn) NOT IN ('DRAFT','SUBMITTED') THEN RAISE EXCEPTION 'Only an open ECN can change'; END IF;
  UPDATE public.ecns SET title = coalesce(nullif(btrim(p_title), ''), title), reason = nullif(btrim(coalesce(p_reason, '')), '') WHERE id = p_ecn;
  UPDATE public.item_versions SET note = (SELECT title FROM public.ecns WHERE id = p_ecn) WHERE ecn_id = p_ecn AND status = 'DRAFT';
END $$;

CREATE OR REPLACE FUNCTION public.ecn_cancel(p_ecn uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_made uuid[]; e record;
BEGIN
  IF NOT public.can_edit_plm() THEN RAISE EXCEPTION 'Only R&D or Management can cancel an ECN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO e FROM public.ecns WHERE id = p_ecn;
  IF e.status NOT IN ('DRAFT','SUBMITTED','APPROVED') THEN RAISE EXCEPTION 'Only an open ECN can be cancelled'; END IF;
  IF e.status = 'APPROVED' AND NOT public.can_approve() THEN RAISE EXCEPTION 'Only Management can cancel an approved ECN'; END IF;
  SELECT array_agg(iv.item_id) INTO v_made FROM public.item_versions iv
   WHERE iv.ecn_id = p_ecn AND iv.kind = 'INITIAL' AND NOT EXISTS (SELECT 1 FROM public.item_versions o WHERE o.item_id = iv.item_id AND o.id <> iv.id);
  UPDATE public.version_lines SET child_version_id = NULL
   WHERE child_version_id IN (SELECT id FROM public.item_versions WHERE ecn_id = p_ecn);
  DELETE FROM public.item_versions WHERE ecn_id = p_ecn AND status = 'DRAFT';
  IF e.new_part_created THEN
    v_made := coalesce(v_made, '{}') || e.new_part_id;
    UPDATE public.ecns SET new_part_id = NULL WHERE id = p_ecn;   -- the code made for it goes with it
  END IF;
  IF v_made IS NOT NULL THEN
    DELETE FROM public.part_vendors pv WHERE pv.part_id = ANY (v_made)
       AND NOT EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = pv.part_id OR b.child_part_id = pv.part_id)
       AND NOT EXISTS (SELECT 1 FROM public.version_lines l WHERE l.part_id = pv.part_id);
    DELETE FROM public.parts p WHERE p.id = ANY (v_made)
       AND NOT EXISTS (SELECT 1 FROM public.bom b WHERE b.parent_part_id = p.id OR b.child_part_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM public.version_lines l WHERE l.part_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM public.ecns x WHERE x.new_part_id = p.id AND x.id <> p_ecn);
  END IF;
  UPDATE public.ecns SET status = 'CANCELLED' WHERE id = p_ecn;
END $$;

REVOKE ALL ON FUNCTION public.ecn_part_where_used(uuid), public.ecn_part_impact(uuid), public.ecn_part_copy(uuid, text),
  public.ecn_raise_part_change(text, text, text, uuid, uuid, uuid[], uuid[], numeric, boolean),
  public.ecn_submit(uuid), public.ecn_send_back(uuid, text), public.ecn_set_old_stock(uuid, boolean, date, text, text),
  public.ecn_approve(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ecn_part_where_used(uuid), public.ecn_part_impact(uuid), public.ecn_part_copy(uuid, text),
  public.ecn_raise_part_change(text, text, text, uuid, uuid, uuid[], uuid[], numeric, boolean),
  public.ecn_submit(uuid), public.ecn_send_back(uuid, text), public.ecn_set_old_stock(uuid, boolean, date, text, text),
  public.ecn_approve(uuid, uuid[]) TO authenticated;

-- Approved ECNs with a later start date go live at 00:15 IST.
SELECT cron.unschedule('ecn-release-due') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ecn-release-due');
SELECT cron.schedule('ecn-release-due', '45 18 * * *', 'SELECT public.ecn_release_due()');
