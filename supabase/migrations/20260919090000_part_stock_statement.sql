-- Where every piece went, from the ledger, so it cannot fail to add up.
--
-- Store > Inventory Diagnostics reported "Discrepancy: -8,900 units" on Z-015.
-- There is no discrepancy. The screen invented its own arithmetic:
--
--     Total GRN Receipts 99,000  -  Production Dispatches 8,500
--       = Expected 90,500  vs  Current 81,600  =  -8,900
--
-- Three things wrong with that, and they compound:
--
--   * "Total GRN Receipts 99,000" is not what was received. 100,000 arrived;
--     99,000 is what IQC passed. The label and the number disagree.
--   * It subtracts exactly two of the eight kinds of movement in the ledger and
--     calls whatever is left over a discrepancy. The 9,000 the store counted
--     short and the +100 kit-feedback correction are simply not in the sum.
--   * So the "discrepancy" is not a finding about the stock. It is the size of
--     what the screen forgot to look at. A reconciliation that can be wrong about
--     its own arithmetic will be believed the day it matters.
--
-- The ledger already holds the whole story for Z-015:
--
--     +100,000  GRN receipt into quarantine
--      -99,000  out of quarantine   /  +99,000 into main store   (IQC passed)
--       -1,000  out of quarantine   /   +1,000 into reject store (IQC rejected)
--       -9,000  main store          store counted short at receiving
--         -500  main store          issued to production
--       -8,000  main store          issued to production
--         +100  main store          kit feedback accepted
--
-- which closes exactly: 81,600 in main + 1,000 in reject + 8,400 still on the
-- production floor + 9,000 short = 100,000 received.
--
-- So this function does not compute a balance. It classifies every ledger row
-- into a stage with a department and lets the arithmetic close by construction.
-- Anything it does not recognise lands in an explicit "other" stage rather than
-- being dropped, because a row silently left out of the sum is precisely how the
-- old screen produced a number nobody could explain.

CREATE OR REPLACE FUNCTION public.part_stock_statement(
  p_part_id  uuid,
  p_plant_id uuid
) RETURNS TABLE (
  seq            int,
  section        text,
  label          text,
  department     text,
  quantity       numeric,
  is_unexplained boolean,
  note           text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_received   numeric := 0;
  v_on_site    numeric := 0;
  v_with_prod  numeric := 0;
  v_short      numeric := 0;
  v_seq        int := 0;
  r            record;
BEGIN
  IF NOT public.in_plant(p_plant_id) THEN
    RAISE EXCEPTION 'Not permitted to read stock for this plant';
  END IF;

  -- The classification runs inline, below, rather than into a temp table: a
  -- STABLE function may not CREATE TABLE, and this should stay STABLE so callers
  -- can treat it as an ordinary read.

  SELECT coalesce(sum(l.qty_delta), 0) INTO v_received
    FROM public.stock_ledger l
   WHERE l.part_id = p_part_id AND l.plant_id = p_plant_id
     AND l.movement_type IN ('GRN_RECEIPT', 'RECEIPT', 'OPENING')
     AND l.qty_delta > 0;

  SELECT coalesce(sum(l.qty_delta), 0) INTO v_on_site
    FROM public.stock_ledger l
   WHERE l.part_id = p_part_id AND l.plant_id = p_plant_id;

  -- Material that left the stores but is still ours: issued to the floor, less
  -- anything returned or corrected back by accepted kit feedback.
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

  -- ---- what came in -------------------------------------------------------
  v_seq := v_seq + 1;
  RETURN QUERY SELECT v_seq, 'RECEIVED'::text, 'Received'::text,
                      'Store - goods inward'::text, v_received, false,
                      'Everything that has ever entered this plant for this part'::text;

  -- ---- what happened to it ------------------------------------------------
  FOR r IN
    -- Aliased `dept`, not `department`: the OUT parameter of that name makes an
    -- unqualified reference ambiguous and PL/pgSQL refuses rather than guessing.
    SELECT stage, dept, sum(qty_delta) AS net,
           sum(qty_delta) FILTER (WHERE qty_delta > 0) AS moved_in,
           unexplained, min(ord) AS ord
    FROM (
      SELECT
        CASE
          WHEN l.movement_type IN ('GRN_RECEIPT', 'RECEIPT')      THEN 'Received from vendor'
          WHEN l.movement_type = 'OPENING'                        THEN 'Opening stock'
          WHEN l.movement_type IN ('IQC_ACCEPT_IN','IQC_ACCEPT_OUT') THEN 'Passed IQC into the main store'
          WHEN l.movement_type IN ('IQC_REJECT_IN','IQC_REJECT_OUT') THEN 'Rejected by IQC'
          WHEN l.movement_type = 'ISSUED_TO_PRODUCTION'           THEN 'Issued to production'
          WHEN l.movement_type IN ('PRODUCTION_RETURN','KIT_RETURN','PRODUCTION_FEEDBACK_RETURN')
                                                                  THEN 'Returned by production'
          WHEN l.reason_code = 'STORE_PHYSICAL_VARIANCE'          THEN 'Short at store receiving'
          WHEN l.reason_code = 'STORE_RECOUNT'                    THEN 'Store recount correction'
          WHEN l.reason_code = 'KIT_FEEDBACK_ACCEPTED'            THEN 'Kit feedback correction'
          WHEN l.movement_type = 'SCRAP'                          THEN 'Scrapped'
          WHEN l.movement_type = 'VENDOR_RETURN'                  THEN 'Returned to vendor'
          ELSE 'Other adjustments'
        END AS stage,
        CASE
          WHEN l.movement_type IN ('GRN_RECEIPT','RECEIPT')       THEN 'Store - goods inward'
          WHEN l.movement_type LIKE 'IQC%'                        THEN 'Quality - IQC'
          WHEN l.movement_type = 'ISSUED_TO_PRODUCTION'           THEN 'Store to Production'
          WHEN l.movement_type IN ('PRODUCTION_RETURN','KIT_RETURN','PRODUCTION_FEEDBACK_RETURN')
                                                                  THEN 'Production'
          WHEN l.reason_code IN ('STORE_PHYSICAL_VARIANCE','STORE_RECOUNT','KIT_FEEDBACK_ACCEPTED')
                                                                  THEN 'Store'
          ELSE 'Unclassified'
        END AS dept,
        (l.reason_code = 'STORE_PHYSICAL_VARIANCE' AND l.qty_delta < 0) AS unexplained,
        l.qty_delta,
        CASE
          WHEN l.movement_type IN ('GRN_RECEIPT','RECEIPT','OPENING') THEN 1
          WHEN l.movement_type LIKE 'IQC%'                            THEN 2
          WHEN l.reason_code = 'STORE_PHYSICAL_VARIANCE'              THEN 3
          WHEN l.movement_type = 'ISSUED_TO_PRODUCTION'               THEN 4
          ELSE 5
        END AS ord
      FROM public.stock_ledger l
      WHERE l.part_id = p_part_id AND l.plant_id = p_plant_id
    ) s
    GROUP BY stage, dept, unexplained
    ORDER BY min(ord), stage
  LOOP
    CONTINUE WHEN r.stage IN ('Received from vendor', 'Opening stock');
    v_seq := v_seq + 1;
    -- An internal transfer nets to zero across locations - IQC takes 1,000 out
    -- of quarantine and puts the same 1,000 into the reject store. Reporting the
    -- net would print "Rejected by IQC: 0", which is the one number on this line
    -- nobody wants. The quantity that ARRIVED is what happened, so that is shown,
    -- with a note that the total held did not change.
    RETURN QUERY SELECT v_seq, 'MOVEMENT'::text, r.stage, r.dept,
                        CASE WHEN r.net = 0 THEN coalesce(r.moved_in, 0) ELSE r.net END,
                        r.unexplained,
                        CASE WHEN r.net = 0
                             THEN 'Moved between locations - the total held did not change'
                             ELSE NULL END;
  END LOOP;

  -- ---- where it is now ----------------------------------------------------
  FOR r IN
    SELECT loc.code::text AS code, loc.name::text AS name, sum(l.qty_delta) AS qty
      FROM public.stock_ledger l
      JOIN public.stock_locations loc ON loc.id = l.location_id
     WHERE l.part_id = p_part_id AND l.plant_id = p_plant_id
     GROUP BY loc.code, loc.name
     HAVING sum(l.qty_delta) <> 0
     ORDER BY loc.code
  LOOP
    v_seq := v_seq + 1;
    RETURN QUERY SELECT v_seq, 'WHERE'::text, r.name, 'Store'::text, r.qty, false, NULL::text;
  END LOOP;

  IF v_with_prod <> 0 THEN
    v_seq := v_seq + 1;
    RETURN QUERY SELECT v_seq, 'WHERE'::text, 'On the production floor'::text,
                        'Production'::text, v_with_prod, false,
                        'Issued and not yet returned - still ours, just not in a store'::text;
  END IF;

  IF v_short <> 0 THEN
    v_seq := v_seq + 1;
    RETURN QUERY SELECT v_seq, 'WHERE'::text, 'Short - not accounted for'::text,
                        'Store'::text, v_short, true,
                        'Counted short at receiving. Open on Purchase Discrepancies until somebody rules on it'::text;
  END IF;

  -- ---- the check ----------------------------------------------------------
  -- v_on_site is the sum of every ledger row, so it IS the stock on site. The
  -- check is that received equals what is on site plus what is on the floor plus
  -- what is short. It cannot be fudged: every term comes from the same rows.
  v_seq := v_seq + 1;
  RETURN QUERY SELECT v_seq, 'CHECK'::text, 'Accounted for'::text, NULL::text,
                      v_on_site + v_with_prod + v_short, false,
                      CASE WHEN v_on_site + v_with_prod + v_short = v_received
                           THEN 'Balances against everything received'
                           ELSE 'Does NOT balance - there are movements this statement does not classify' END;
END;
$$;

REVOKE ALL ON FUNCTION public.part_stock_statement(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.part_stock_statement(uuid, uuid) TO authenticated;
