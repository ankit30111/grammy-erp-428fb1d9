-- Edit a GRN after it is saved, and delete one without leaving its stock behind.
--
--   Header   vendor (GRNs without a PO), invoice number, invoice date,
--            received date, notes: always editable.
--   Lines    quantity, part (lines without a PO line), add, remove: while the
--            line is waiting for IQC. Once IQC has inspected a line its stock
--            has moved on (main store / reject), so that line stays as it is.
--   Stock    every change is posted to the ledger in quarantine, so the
--            quarantine balance always equals what the GRNs say was received.
--   Rights   store (the same people who make GRNs) or Management / Admin.

CREATE OR REPLACE FUNCTION public.grn_edit(p_grn uuid, p_header jsonb, p_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.grn%ROWTYPE;
  quar uuid;
  l jsonb;
  old public.grn_items%ROWTYPE;
  v_part uuid; v_qty numeric; v_id uuid; v_poi uuid;
  moves jsonb := '[]'::jsonb;
  keep uuid[] := '{}';
  changed int := 0;
  v_code text;
  mv jsonb;
BEGIN
  SELECT * INTO g FROM public.grn WHERE id = p_grn FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GRN not found'; END IF;
  IF NOT (public.in_plant(g.plant_id) AND (public.has_role('store') OR public.can_approve())) THEN
    RAISE EXCEPTION 'Only Store, Management or Admin can edit a GRN' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO quar FROM public.stock_locations WHERE stock_locations.plant_id = g.plant_id AND stock_locations.code = 'QUAR' AND is_active;
  IF quar IS NULL THEN RAISE EXCEPTION 'No quarantine location for this plant'; END IF;

  -- header
  IF p_header IS NOT NULL THEN
    IF p_header ? 'vendor_id' AND (p_header->>'vendor_id')::uuid IS DISTINCT FROM g.vendor_id THEN
      IF g.purchase_order_id IS NOT NULL THEN RAISE EXCEPTION 'The vendor of a GRN made against a PO comes from the PO'; END IF;
      IF NULLIF(p_header->>'vendor_id','') IS NULL THEN RAISE EXCEPTION 'Choose the vendor'; END IF;
    END IF;
    UPDATE public.grn SET
      vendor_id      = CASE WHEN p_header ? 'vendor_id' THEN (p_header->>'vendor_id')::uuid ELSE vendor_id END,
      invoice_number = CASE WHEN p_header ? 'invoice_number' THEN NULLIF(btrim(p_header->>'invoice_number'), '') ELSE invoice_number END,
      invoice_date   = CASE WHEN p_header ? 'invoice_date' THEN NULLIF(p_header->>'invoice_date', '')::date ELSE invoice_date END,
      received_date  = CASE WHEN p_header ? 'received_date' THEN COALESCE(NULLIF(p_header->>'received_date', '')::date, received_date) ELSE received_date END,
      notes          = CASE WHEN p_header ? 'notes' THEN NULLIF(btrim(p_header->>'notes'), '') ELSE notes END
    WHERE id = p_grn;
  END IF;

  IF p_lines IS NULL THEN RETURN jsonb_build_object('lines_changed', 0); END IF;
  IF jsonb_typeof(p_lines) <> 'array' THEN RAISE EXCEPTION 'p_lines must be an array'; END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_part := NULLIF(l->>'part_id','')::uuid;
    v_qty  := (l->>'received_quantity')::numeric;
    v_id   := NULLIF(l->>'id','')::uuid;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Every line needs a received quantity above 0 (remove the line instead)'; END IF;

    IF v_id IS NULL THEN
      -- a new line
      v_poi := NULLIF(l->>'purchase_order_item_id','')::uuid;
      IF g.purchase_order_id IS NOT NULL THEN
        IF v_poi IS NULL THEN RAISE EXCEPTION 'A line on a PO GRN must be a line of that PO'; END IF;
        SELECT part_id INTO v_part FROM public.purchase_order_items WHERE id = v_poi AND purchase_order_id = g.purchase_order_id;
        IF v_part IS NULL THEN RAISE EXCEPTION 'That PO line is not on this GRN''s PO'; END IF;
      ELSIF v_part IS NULL THEN RAISE EXCEPTION 'Choose the part for the new line';
      END IF;
      INSERT INTO public.grn_items (grn_id, purchase_order_item_id, part_id, received_quantity, received_uom, received_in_uom, iqc_outcome)
      VALUES (p_grn, v_poi, v_part, v_qty, NULLIF(l->>'received_uom',''), NULLIF(l->>'received_in_uom','')::numeric, 'PENDING')
      RETURNING id INTO v_id;
      SELECT part_code INTO v_code FROM public.parts WHERE id = v_part;
      moves := moves || jsonb_build_object('part_id', v_part, 'qty_delta', v_qty, 'item', v_id,
                 'notes', format('Line %s added to GRN %s', v_code, g.grn_number));
      keep := keep || v_id; changed := changed + 1;
      CONTINUE;
    END IF;

    SELECT * INTO old FROM public.grn_items WHERE id = v_id AND grn_id = p_grn FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A line is not on this GRN'; END IF;
    keep := keep || v_id;
    v_part := COALESCE(v_part, old.part_id);
    IF old.purchase_order_item_id IS NOT NULL AND v_part <> old.part_id THEN
      RAISE EXCEPTION 'The part of a PO line comes from the PO';
    END IF;
    IF v_part = old.part_id AND v_qty = old.received_quantity
       AND COALESCE(NULLIF(l->>'received_uom',''), '') = COALESCE(old.received_uom, '')
       AND COALESCE(NULLIF(l->>'received_in_uom','')::numeric, -1) = COALESCE(old.received_in_uom, -1) THEN
      CONTINUE;  -- unchanged
    END IF;
    SELECT part_code INTO v_code FROM public.parts WHERE id = old.part_id;
    IF old.iqc_outcome <> 'PENDING' OR old.store_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Line % has been inspected by IQC, so it can''t be changed here', v_code;
    END IF;

    UPDATE public.grn_items SET part_id = v_part, received_quantity = v_qty,
      received_uom = NULLIF(l->>'received_uom',''), received_in_uom = NULLIF(l->>'received_in_uom','')::numeric
    WHERE id = v_id;
    IF v_part <> old.part_id THEN
      moves := moves || jsonb_build_object('part_id', old.part_id, 'qty_delta', -old.received_quantity, 'item', v_id,
                 'notes', format('GRN %s line %s changed to another part', g.grn_number, v_code));
      moves := moves || jsonb_build_object('part_id', v_part, 'qty_delta', v_qty, 'item', v_id,
                 'notes', format('GRN %s line changed from %s', g.grn_number, v_code));
    ELSIF v_qty <> old.received_quantity THEN
      moves := moves || jsonb_build_object('part_id', v_part, 'qty_delta', v_qty - old.received_quantity, 'item', v_id,
                 'notes', format('GRN %s line %s edited: %s to %s', g.grn_number, v_code, old.received_quantity, v_qty));
    END IF;
    changed := changed + 1;
  END LOOP;

  -- lines left out are removed (only while waiting for IQC)
  FOR old IN SELECT * FROM public.grn_items WHERE grn_id = p_grn AND NOT (id = ANY (keep)) FOR UPDATE LOOP
    SELECT part_code INTO v_code FROM public.parts WHERE id = old.part_id;
    IF old.iqc_outcome <> 'PENDING' OR old.store_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Line % has been inspected by IQC, so it can''t be removed', v_code;
    END IF;
    moves := moves || jsonb_build_object('part_id', old.part_id, 'qty_delta', -old.received_quantity, 'item', old.id,
               'notes', format('Line %s removed from GRN %s', v_code, g.grn_number));
    DELETE FROM public.grn_items WHERE id = old.id;
    changed := changed + 1;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.grn_items WHERE grn_id = p_grn) THEN
    RAISE EXCEPTION 'A GRN needs at least one line. To drop the whole GRN, delete it.';
  END IF;

  -- stock: decreases first, so a part swap between lines never dips below zero
  IF jsonb_array_length(moves) > 0 THEN
    PERFORM public.post_stock_movements(COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'plant_id', g.plant_id, 'part_id', m->>'part_id', 'location_id', quar,
        'qty_delta', (m->>'qty_delta')::numeric, 'movement_type', 'GRN_RECEIPT', 'reason_code', 'GRN_EDIT',
        'reference_type', 'GRN_ITEM_RECEIPT', 'reference_id', m->>'item',
        'reference_number', g.grn_number, 'notes', m->>'notes') ORDER BY (m->>'qty_delta')::numeric)
      FROM jsonb_array_elements(moves) m), '[]'::jsonb));
  END IF;
  RETURN jsonb_build_object('lines_changed', changed);
END $$;

-- Delete a GRN that IQC has not touched; its quarantine stock goes with it.
CREATE OR REPLACE FUNCTION public.grn_delete(p_grn uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.grn%ROWTYPE; quar uuid;
BEGIN
  SELECT * INTO g FROM public.grn WHERE id = p_grn FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GRN not found'; END IF;
  IF NOT (public.in_plant(g.plant_id) AND (public.has_role('store') OR public.can_approve())) THEN
    RAISE EXCEPTION 'Only Store, Management or Admin can delete a GRN' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.grn_items WHERE grn_id = p_grn AND (iqc_outcome <> 'PENDING' OR store_confirmed_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'IQC has inspected lines of GRN %, so it can''t be deleted', g.grn_number;
  END IF;
  SELECT id INTO quar FROM public.stock_locations WHERE stock_locations.plant_id = g.plant_id AND stock_locations.code = 'QUAR' AND is_active;
  PERFORM public.post_stock_movements(COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'plant_id', g.plant_id, 'part_id', i.part_id, 'location_id', quar, 'qty_delta', -i.received_quantity,
      'movement_type', 'GRN_RECEIPT', 'reason_code', 'GRN_DELETED', 'reference_type', 'GRN_ITEM_RECEIPT',
      'reference_id', i.id, 'reference_number', g.grn_number,
      'notes', format('GRN %s deleted', g.grn_number)))
    FROM public.grn_items i WHERE i.grn_id = p_grn AND i.received_quantity > 0), '[]'::jsonb));
  DELETE FROM public.grn_items WHERE grn_id = p_grn;
  DELETE FROM public.grn WHERE id = p_grn;
END $$;

REVOKE ALL ON FUNCTION public.grn_edit(uuid, jsonb, jsonb), public.grn_delete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grn_edit(uuid, jsonb, jsonb), public.grn_delete(uuid) TO authenticated;
