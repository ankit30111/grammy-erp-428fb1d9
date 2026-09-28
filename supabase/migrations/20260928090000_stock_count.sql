-- Stock count / opening stock.
--
-- The store enters what is physically on the shelf; the adjustment is worked out
-- here, against the ledger as it stands at the moment of posting. Working it out
-- on the screen would use a balance that may have moved since the page loaded
-- (a GRN, a kit issue) and post the wrong difference.
--
-- p_lines: [{ "part_id": uuid, "counted": number, "reason": text, "remarks": text }]
CREATE OR REPLACE FUNCTION public.post_stock_count(p_plant_id uuid, p_lines jsonb, p_reference text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  l jsonb; v_main uuid; v_part record; v_counted numeric; v_before numeric; v_delta numeric;
  v_ref text := coalesce(nullif(btrim(p_reference), ''), 'CNT-' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD-HH24MI'));
  v_reason text; v_type text; v_posted int := 0; v_same int := 0; v_opening int := 0;
BEGIN
  IF NOT public.in_plant(p_plant_id) THEN
    RAISE EXCEPTION 'Not permitted to post stock for this plant' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_main FROM public.stock_locations WHERE plant_id = p_plant_id AND code = 'MAIN' AND is_active;
  IF v_main IS NULL THEN RAISE EXCEPTION 'No main store is set up for this plant'; END IF;
  IF jsonb_typeof(p_lines) <> 'array' THEN RAISE EXCEPTION 'Lines must be a list'; END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT id, part_code, source_type, is_active INTO v_part FROM public.parts WHERE id = (l->>'part_id')::uuid;
    IF v_part.id IS NULL THEN RAISE EXCEPTION 'Unknown part in the count'; END IF;
    IF v_part.source_type = 'FINISHED_GOOD' THEN
      RAISE EXCEPTION '% is a finished good; its stock is kept in Finished Goods, not the main store', v_part.part_code;
    END IF;
    v_counted := (l->>'counted')::numeric;
    IF v_counted IS NULL OR v_counted < 0 THEN
      RAISE EXCEPTION 'Count for % must be zero or more', v_part.part_code;
    END IF;

    -- Lock the part's ledger rows for this location so two counts cannot interleave.
    PERFORM 1 FROM public.stock_ledger
     WHERE plant_id = p_plant_id AND part_id = v_part.id AND location_id = v_main FOR UPDATE;
    SELECT coalesce(sum(qty_delta), 0) INTO v_before FROM public.stock_ledger
     WHERE plant_id = p_plant_id AND part_id = v_part.id AND location_id = v_main;

    v_delta := v_counted - v_before;
    IF v_delta = 0 THEN v_same := v_same + 1; CONTINUE; END IF;

    v_reason := upper(coalesce(nullif(btrim(l->>'reason'), ''), 'OTHER'));
    -- The first stock ever booked for a part in this store is its opening stock.
    v_type := CASE WHEN v_reason = 'OPENING_STOCK' AND NOT EXISTS (
                SELECT 1 FROM public.stock_ledger WHERE plant_id = p_plant_id AND part_id = v_part.id AND location_id = v_main
              ) THEN 'OPENING_STOCK' ELSE 'STOCK_RECONCILIATION' END;
    IF v_type = 'OPENING_STOCK' THEN v_opening := v_opening + 1; END IF;

    INSERT INTO public.stock_ledger (plant_id, part_id, location_id, qty_delta, balance_after,
      movement_type, reason_code, reference_type, reference_id, reference_number, notes, created_by)
    VALUES (p_plant_id, v_part.id, v_main, v_delta, v_counted,
      v_type, v_reason, 'STOCK_COUNT', gen_random_uuid(), v_ref,
      format('Counted %s, system %s, adjusted %s%s', v_counted, v_before,
             CASE WHEN v_delta > 0 THEN '+' ELSE '' END || v_delta,
             CASE WHEN nullif(btrim(l->>'remarks'), '') IS NOT NULL THEN '. ' || btrim(l->>'remarks') ELSE '' END),
      auth.uid());
    v_posted := v_posted + 1;
  END LOOP;

  RETURN jsonb_build_object('reference', v_ref, 'posted', v_posted, 'unchanged', v_same, 'opening', v_opening);
END $function$;

GRANT EXECUTE ON FUNCTION public.post_stock_count(uuid, jsonb, text) TO authenticated;
