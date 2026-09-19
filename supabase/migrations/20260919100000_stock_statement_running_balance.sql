-- The statement reads as a running balance, the way an auditor reads a ledger.
--
-- The first version listed the movements and then, separately, where the stock is
-- now. Both were right and it balanced, but it did not answer the question Ankit
-- actually asked, which is what the number was after each step:
--
--     100,000 received
--      -1,000 IQC rejected            ->  99,000
--      -9,000 the store never got     ->  90,000
--      -8,500 issued to production    ->  81,500
--        +100 production got 100 less ->  81,600
--
-- Reading down that column is the point. It shows which department the quantity
-- changed hands at, so when a piece is missing you can say where it stopped being
-- somebody's responsibility, rather than inferring it from two separate tables.
--
-- The running line follows the usable material heading for the main store, so:
--
--   * a GRN receipt starts it,
--   * an IQC rejection takes quantity OFF it (the goods are ours, but they are in
--     the reject store now, not available to production),
--   * IQC passing material INTO the main store changes nothing - those are the
--     same pieces already counted at receipt, just in a different room,
--   * everything after that moves it by the ledger delta.
--
-- It therefore closes on the main-store balance by construction, and the rows that
-- are elsewhere - reject store, the production floor, the short quantity - are
-- listed under it so the grand total still reconciles to everything received.

DROP FUNCTION IF EXISTS public.part_stock_statement(uuid, uuid);

CREATE OR REPLACE FUNCTION public.part_stock_statement(
  p_part_id  uuid,
  p_plant_id uuid
) RETURNS TABLE (
  seq             int,
  section         text,
  event_at        timestamptz,
  label           text,
  department      text,
  quantity        numeric,
  running_balance numeric,
  is_unexplained  boolean,
  note            text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_received  numeric := 0;
  v_running   numeric := 0;
  v_main      numeric := 0;
  v_reject    numeric := 0;
  v_quar      numeric := 0;
  v_with_prod numeric := 0;
  v_short     numeric := 0;
  v_seq       int := 0;
  r           record;
BEGIN
  IF NOT public.in_plant(p_plant_id) THEN
    RAISE EXCEPTION 'Not permitted to read stock for this plant';
  END IF;

  FOR r IN
    SELECT
      l.created_at,
      l.movement_type,
      l.reason_code,
      l.qty_delta,
      loc.code AS loc_code,
      -- The effect on the running line. The two *_OUT halves of a quarantine move
      -- are dropped below; of the pair that remains, only the rejection changes
      -- the line, because passing IQC moves the same pieces into the main store
      -- rather than adding any.
      CASE
        WHEN l.movement_type IN ('GRN_RECEIPT','RECEIPT','OPENING') THEN l.qty_delta
        WHEN l.movement_type = 'IQC_REJECT_IN'                      THEN -l.qty_delta
        WHEN l.movement_type = 'IQC_ACCEPT_IN'                      THEN 0
        ELSE l.qty_delta
      END AS effect,
      CASE
        WHEN l.movement_type IN ('GRN_RECEIPT','RECEIPT')  THEN 'Received from the vendor'
        WHEN l.movement_type = 'OPENING'                   THEN 'Opening stock'
        WHEN l.movement_type = 'IQC_REJECT_IN'             THEN 'Rejected by IQC, moved to the reject store'
        WHEN l.movement_type = 'IQC_ACCEPT_IN'             THEN 'Passed IQC into the main store'
        WHEN l.reason_code = 'STORE_PHYSICAL_VARIANCE'     THEN 'Store counted short - never reached the store'
        WHEN l.reason_code = 'STORE_RECOUNT'               THEN 'Store recount correction'
        WHEN l.reason_code = 'KIT_FEEDBACK_ACCEPTED'       THEN 'Production counted a difference, store accepted it'
        WHEN l.movement_type = 'ISSUED_TO_PRODUCTION'      THEN 'Issued to production'
        WHEN l.movement_type IN ('PRODUCTION_RETURN','KIT_RETURN','PRODUCTION_FEEDBACK_RETURN')
                                                           THEN 'Returned by production'
        WHEN l.movement_type = 'SCRAP'                     THEN 'Scrapped'
        WHEN l.movement_type = 'VENDOR_RETURN'             THEN 'Returned to the vendor'
        ELSE 'Adjustment'
      END AS label,
      CASE
        WHEN l.movement_type IN ('GRN_RECEIPT','RECEIPT')  THEN 'Store - goods inward'
        WHEN l.movement_type LIKE 'IQC%'                   THEN 'Quality - IQC'
        WHEN l.reason_code = 'STORE_PHYSICAL_VARIANCE'     THEN 'Store - receiving'
        WHEN l.reason_code = 'STORE_RECOUNT'               THEN 'Store'
        WHEN l.reason_code = 'KIT_FEEDBACK_ACCEPTED'       THEN 'Production, accepted by Store'
        WHEN l.movement_type = 'ISSUED_TO_PRODUCTION'      THEN 'Store to Production'
        WHEN l.movement_type IN ('PRODUCTION_RETURN','KIT_RETURN','PRODUCTION_FEEDBACK_RETURN')
                                                           THEN 'Production'
        ELSE 'Store'
      END AS dept,
      (l.reason_code = 'STORE_PHYSICAL_VARIANCE' AND l.qty_delta < 0) AS unexplained,
      CASE
        WHEN l.movement_type IN ('GRN_RECEIPT','RECEIPT','OPENING') THEN 1
        WHEN l.movement_type = 'IQC_REJECT_IN'                      THEN 2
        WHEN l.movement_type = 'IQC_ACCEPT_IN'                      THEN 3
        ELSE 4
      END AS tiebreak
    FROM public.stock_ledger l
    JOIN public.stock_locations loc ON loc.id = l.location_id
    WHERE l.part_id = p_part_id AND l.plant_id = p_plant_id
      -- The out-of-quarantine halves are the same pieces as the in-halves. Showing
      -- both would print every IQC decision twice, once as a negative.
      AND l.movement_type NOT IN ('IQC_ACCEPT_OUT','IQC_REJECT_OUT')
    ORDER BY l.created_at, tiebreak, l.id
  LOOP
    v_running := v_running + r.effect;
    v_seq := v_seq + 1;

    IF r.movement_type IN ('GRN_RECEIPT','RECEIPT','OPENING') THEN
      v_received := v_received + r.qty_delta;
    END IF;

    RETURN QUERY SELECT
      v_seq, 'FLOW'::text, r.created_at, r.label, r.dept,
      r.effect, v_running, r.unexplained,
      CASE
        WHEN r.movement_type = 'IQC_ACCEPT_IN'
          THEN format('%s moved from quarantine into the main store - the same pieces, so the running total does not change',
                      to_char(r.qty_delta, 'FM999,999,999'))
        WHEN r.reason_code = 'STORE_PHYSICAL_VARIANCE' AND r.qty_delta < 0
          THEN 'Nobody has ruled on this yet - it is open on Purchase Discrepancies'
        ELSE NULL
      END;
  END LOOP;

  -- Where the rest of it sits. These are not deductions from the line above; they
  -- are the other places the same material went.
  SELECT coalesce(sum(l.qty_delta) FILTER (WHERE loc.code = 'MAIN'), 0),
         coalesce(sum(l.qty_delta) FILTER (WHERE loc.code = 'REJECT'), 0),
         coalesce(sum(l.qty_delta) FILTER (WHERE loc.code = 'QUAR'), 0)
    INTO v_main, v_reject, v_quar
    FROM public.stock_ledger l
    JOIN public.stock_locations loc ON loc.id = l.location_id
   WHERE l.part_id = p_part_id AND l.plant_id = p_plant_id;

  SELECT coalesce(-sum(l.qty_delta), 0) INTO v_with_prod
    FROM public.stock_ledger l
   WHERE l.part_id = p_part_id AND l.plant_id = p_plant_id
     AND (l.movement_type IN ('ISSUED_TO_PRODUCTION','PRODUCTION_RETURN','KIT_RETURN',
                              'PRODUCTION_FEEDBACK_RETURN')
          OR l.reason_code = 'KIT_FEEDBACK_ACCEPTED');

  SELECT coalesce(-sum(l.qty_delta), 0) INTO v_short
    FROM public.stock_ledger l
   WHERE l.part_id = p_part_id AND l.plant_id = p_plant_id
     AND l.reason_code = 'STORE_PHYSICAL_VARIANCE' AND l.qty_delta < 0;

  v_seq := v_seq + 1;
  RETURN QUERY SELECT v_seq, 'ELSEWHERE'::text, NULL::timestamptz,
    'In the main store'::text, 'Store'::text, v_main, NULL::numeric, false,
    'The closing figure of the running column above'::text;

  IF v_quar <> 0 THEN
    v_seq := v_seq + 1;
    RETURN QUERY SELECT v_seq, 'ELSEWHERE'::text, NULL::timestamptz,
      'Still in quarantine'::text, 'Quality - IQC'::text, v_quar, NULL::numeric, false,
      'Received but not yet inspected'::text;
  END IF;

  IF v_reject <> 0 THEN
    v_seq := v_seq + 1;
    RETURN QUERY SELECT v_seq, 'ELSEWHERE'::text, NULL::timestamptz,
      'In the reject store'::text, 'Quality - IQC'::text, v_reject, NULL::numeric, false,
      'Ours, but not available to production'::text;
  END IF;

  IF v_with_prod <> 0 THEN
    v_seq := v_seq + 1;
    RETURN QUERY SELECT v_seq, 'ELSEWHERE'::text, NULL::timestamptz,
      'On the production floor'::text, 'Production'::text, v_with_prod, NULL::numeric, false,
      'Issued and not yet returned'::text;
  END IF;

  IF v_short <> 0 THEN
    v_seq := v_seq + 1;
    RETURN QUERY SELECT v_seq, 'ELSEWHERE'::text, NULL::timestamptz,
      'Short - not accounted for'::text, 'Store - receiving'::text, v_short, NULL::numeric, true,
      'Counted short at receiving, and nobody has ruled on it yet'::text;
  END IF;

  v_seq := v_seq + 1;
  RETURN QUERY SELECT v_seq, 'CHECK'::text, NULL::timestamptz,
    'Accounted for'::text, NULL::text,
    v_main + v_quar + v_reject + v_with_prod + v_short, NULL::numeric, false,
    CASE WHEN v_main + v_quar + v_reject + v_with_prod + v_short = v_received
         THEN format('Balances against the %s received', to_char(v_received, 'FM999,999,999'))
         ELSE format('Does NOT balance against the %s received - there is movement this statement does not classify',
                     to_char(v_received, 'FM999,999,999')) END;
END;
$$;

REVOKE ALL ON FUNCTION public.part_stock_statement(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.part_stock_statement(uuid, uuid) TO authenticated;
