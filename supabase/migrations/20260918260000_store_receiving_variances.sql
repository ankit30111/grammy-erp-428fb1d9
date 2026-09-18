-- The store counted 9,000 fewer than IQC passed, and nobody was told.
--
-- On GRN-202609-00005: 100,000 received, IQC accepted 99,000 and rejected 1,000,
-- and the store counted 90,000. Stock is right - the store's count is what was
-- posted - but 9,000 pieces are unaccounted for, and PPC's Purchase Discrepancies
-- > Store Discrepancies tab showed "not available after the rebuild" because it
-- was built on store_discrepancies, a table dropped with no replacement.
--
-- No new table is needed to FIND the variance: grn_items already holds
-- iqc_accepted_quantity and store_counted_quantity, so the difference is derived,
-- not stored. Storing it as well would be a second source of truth that drifts
-- from the two numbers it came from.
--
-- What IS missing is the decision. A variance is a question - did the vendor short
-- supply us, did somebody miscount, or did we lose it? - and each answer has a
-- different consequence for the PO and the vendor. That decision is the only thing
-- this migration stores.

CREATE TYPE public.variance_resolution AS ENUM (
  -- The vendor never sent them. The GRN's received figure came off the invoice,
  -- not a count; correcting it puts the quantity back on the PO as still owed and
  -- flags the line for a debit note.
  'SHORT_SUPPLY',
  -- IQC's accepted figure was wrong. The goods that reached the store are what
  -- actually passed.
  'IQC_MISCOUNT',
  -- The store's count was wrong and the material has since been found.
  'STORE_RECOUNT',
  -- Genuinely lost or damaged between IQC and the store, and we bear it.
  'WRITE_OFF'
);

CREATE TABLE public.grn_variance_resolutions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_item_id    uuid NOT NULL UNIQUE REFERENCES public.grn_items(id) ON DELETE CASCADE,
  plant_id       uuid NOT NULL REFERENCES public.plants(id),

  -- The numbers as they stood when the decision was made, so the record still
  -- makes sense after a later correction moves them.
  expected_quantity numeric NOT NULL,
  counted_quantity  numeric NOT NULL,
  variance          numeric GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,

  resolution     public.variance_resolution NOT NULL,
  remarks        text NOT NULL,
  -- Set for SHORT_SUPPLY: the quantity to claim back from the vendor.
  claim_quantity numeric,
  -- The ledger row, where the resolution moved stock.
  stock_ledger_id uuid REFERENCES public.stock_ledger(id),

  resolved_by    uuid,
  resolved_at    timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- A resolution with no explanation is how a 9,000-piece difference becomes
  -- an argument six months later.
  CONSTRAINT variance_remarks_not_blank CHECK (btrim(remarks) <> '')
);

CREATE INDEX grn_variance_plant_idx ON public.grn_variance_resolutions (plant_id, resolved_at DESC);

ALTER TABLE public.grn_variance_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY grn_variance_read ON public.grn_variance_resolutions
  FOR SELECT TO authenticated USING (public.in_plant(plant_id));

CREATE POLICY grn_variance_write ON public.grn_variance_resolutions
  FOR INSERT TO authenticated
  WITH CHECK (public.in_plant(plant_id)
              AND (public.has_role('store') OR public.has_role('purchase')));

CREATE TRIGGER trg_grn_variance_touch
  BEFORE UPDATE ON public.grn_variance_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- What the tab reads.
-- ---------------------------------------------------------------------------
-- A view rather than a table: the variance is always the difference between the
-- two live numbers, so it cannot go stale and there is nothing to keep in sync.
CREATE OR REPLACE VIEW public.store_receiving_variances AS
SELECT
  gi.id                        AS grn_item_id,
  g.plant_id,
  g.id                         AS grn_id,
  g.grn_number,
  g.received_date,
  g.invoice_number,
  v.id                         AS vendor_id,
  v.name                       AS vendor_name,
  v.vendor_code,
  po.id                        AS purchase_order_id,
  po.po_number,
  p.id                         AS part_id,
  p.part_code,
  p.name                       AS part_name,
  p.uom,
  gi.received_quantity,
  gi.iqc_accepted_quantity,
  gi.iqc_rejected_quantity,
  gi.store_counted_quantity,
  -- For a resolved line, the variance as it stood when the decision was made.
  -- A resolution can correct the very numbers the live difference is computed
  -- from - SHORT_SUPPLY brings iqc_accepted down to the counted figure - so the
  -- live difference becomes zero and the history would read as "no variance",
  -- which is the opposite of what happened.
  coalesce(r.variance, gi.store_counted_quantity - gi.iqc_accepted_quantity) AS variance,
  gi.store_confirmed_at,
  r.id                         AS resolution_id,
  r.resolution,
  r.remarks                    AS resolution_remarks,
  r.claim_quantity,
  r.resolved_at,
  (r.id IS NULL)               AS is_open
FROM public.grn_items gi
JOIN public.grn g          ON g.id = gi.grn_id
LEFT JOIN public.vendors v ON v.id = g.vendor_id
LEFT JOIN public.purchase_orders po ON po.id = g.purchase_order_id
JOIN public.parts p        ON p.id = gi.part_id
LEFT JOIN public.grn_variance_resolutions r ON r.grn_item_id = gi.id
-- Only lines the store has actually counted: an uncounted line is not a variance,
-- it is work not done yet.
--
-- A line stays on the tab once it has been resolved, even though resolving it can
-- make the two quantities agree. Purchase needs to see what was claimed from which
-- vendor against which PO; a reconciliation that vanishes the moment it is made
-- cannot be reconciled with anybody.
WHERE gi.store_confirmed_at IS NOT NULL
  AND (gi.store_counted_quantity IS DISTINCT FROM gi.iqc_accepted_quantity
       OR r.id IS NOT NULL);

ALTER VIEW public.store_receiving_variances SET (security_invoker = on);
GRANT SELECT ON public.store_receiving_variances TO authenticated;

-- ---------------------------------------------------------------------------
-- Recording the decision.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_store_variance(
  p_grn_item_id uuid,
  p_resolution  public.variance_resolution,
  p_remarks     text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  gi          public.grn_items%ROWTYPE;
  v_plant     uuid;
  v_expected  numeric;
  v_counted   numeric;
  v_variance  numeric;
  v_main      uuid;
  v_ledger    uuid;
  v_claim     numeric;
  v_id        uuid;
BEGIN
  SELECT * INTO gi FROM public.grn_items WHERE id = p_grn_item_id FOR UPDATE;
  IF gi.id IS NULL THEN
    RAISE EXCEPTION 'GRN line not found';
  END IF;

  SELECT plant_id INTO v_plant FROM public.grn WHERE id = gi.grn_id;

  IF NOT (public.in_plant(v_plant)
          AND (public.has_role('store') OR public.has_role('purchase'))) THEN
    RAISE EXCEPTION 'Only the store or purchase can resolve a receiving variance';
  END IF;

  IF coalesce(btrim(p_remarks), '') = '' THEN
    RAISE EXCEPTION 'Say what was found - a resolution with no explanation settles nothing';
  END IF;

  IF gi.store_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'The store has not counted this line yet';
  END IF;

  v_expected := coalesce(gi.iqc_accepted_quantity, 0);
  v_counted  := coalesce(gi.store_counted_quantity, 0);
  v_variance := v_counted - v_expected;

  -- Checked before the zero test: a resolution can bring the two quantities into
  -- agreement, so a second attempt would otherwise be turned away with "there is
  -- no variance", which is true but tells the wrong story.
  IF EXISTS (SELECT 1 FROM public.grn_variance_resolutions WHERE grn_item_id = p_grn_item_id) THEN
    RAISE EXCEPTION 'This variance has already been resolved';
  END IF;

  IF v_variance = 0 THEN
    RAISE EXCEPTION 'There is no variance on this line';
  END IF;

  SELECT id INTO v_main FROM public.stock_locations
   WHERE plant_id = v_plant AND code = 'MAIN' AND is_active;

  CASE p_resolution
    WHEN 'SHORT_SUPPLY' THEN
      -- The invoice said more than the vendor sent. Correcting the receipt pushes
      -- the shortfall back onto the PO as still owed - the recalc trigger on
      -- grn_items does that sum.
      --
      -- IQC's accepted figure has to come down with it. If only 91,000 arrived,
      -- IQC cannot have accepted 99,000 of them; the store's count is what
      -- actually passed. grn_items also carries a check that accepted + rejected
      -- never exceeds received, which is what caught this when it was written the
      -- other way round.
      v_claim := abs(v_variance);
      UPDATE public.grn_items
         SET received_quantity     = v_counted + coalesce(iqc_rejected_quantity, 0),
             iqc_accepted_quantity = v_counted,
             updated_at = now()
       WHERE id = p_grn_item_id;

    WHEN 'IQC_MISCOUNT' THEN
      -- What reached the store is what actually passed. The difference moves to
      -- the rejected figure so accepted + rejected still equals what was received.
      UPDATE public.grn_items
         SET iqc_accepted_quantity = v_counted,
             iqc_rejected_quantity = coalesce(received_quantity, 0) - v_counted,
             updated_at = now()
       WHERE id = p_grn_item_id;

    WHEN 'STORE_RECOUNT' THEN
      -- The material was found. The store's count becomes the IQC figure and the
      -- difference is posted so the ledger matches the shelf.
      IF v_main IS NULL THEN
        RAISE EXCEPTION 'Main store location is not configured for this plant';
      END IF;
      -- post_stock_movement returns jsonb ({"ids": [...], "posted": n}), not a
      -- uuid: it can post several lines in one call. Take the one id it wrote.
      v_ledger := (public.post_stock_movement(
        v_plant, gi.part_id, v_main, -v_variance, 'ADJUSTMENT',
        'STORE_RECOUNT', 'GRN_ITEM', p_grn_item_id, NULL,
        format('Receiving variance recounted: counted %s, IQC passed %s', v_counted, v_expected)
      ) -> 'ids' ->> 0)::uuid;
      UPDATE public.grn_items
         SET store_counted_quantity = v_expected, updated_at = now()
       WHERE id = p_grn_item_id;

    WHEN 'WRITE_OFF' THEN
      -- Stock already reflects what the store counted, so nothing moves. This
      -- records that the loss was accepted and by whom.
      NULL;
  END CASE;

  INSERT INTO public.grn_variance_resolutions (
    grn_item_id, plant_id, expected_quantity, counted_quantity,
    resolution, remarks, claim_quantity, stock_ledger_id, resolved_by
  ) VALUES (
    p_grn_item_id, v_plant, v_expected, v_counted,
    p_resolution, btrim(p_remarks), v_claim, v_ledger, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_store_variance(uuid, public.variance_resolution, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_store_variance(uuid, public.variance_resolution, text)
  TO authenticated;
