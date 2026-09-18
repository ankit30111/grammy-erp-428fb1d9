-- The store's issued quantity was being written into production's column, and a
-- voucher could be issued material twice with nothing showing it.
--
-- Store > Production Voucher wrote each dispatch line as
--
--     required_quantity: <BOM x voucher qty>,
--     received_quantity: <what the store sent>      -- wrong column
--
-- leaving issued_quantity at its default of zero. Production > Kit Receipt reads
-- issued_quantity, so it showed "Issued by store: 0" for kits that had physically
-- gone out - 500 and 8,000 pieces of Z-015, both posted to the ledger. Worse, it
-- pre-filled received_quantity with the store's own figure, so production's count
-- was already "agreed" before anybody counted. The disagreement the kit feedback
-- loop exists to catch could not arise.
--
-- Separately, issuing material against the same voucher a second time created a
-- SECOND kit_preparation row rather than adding to the open one. PV-202609-00004
-- has two, KIT-202609-00007 and KIT-202609-00010, both SENT. Two kits both saying
-- "sent" against one voucher is how a voucher gets its material twice and the
-- screens still look right.

-- ---------------------------------------------------------------------------
-- Repair the kits already issued.
-- ---------------------------------------------------------------------------
-- The material physically left: the ledger has ISSUED_TO_PRODUCTION rows keyed to
-- each kit item. The quantity in received_quantity is therefore what was ISSUED,
-- written to the wrong column, so it is moved rather than invented - and the true
-- received_quantity goes back to NULL, because production has not counted yet and
-- an uncounted line must not look counted.
UPDATE public.kit_items ki
   SET issued_quantity   = coalesce(ki.issued_quantity, 0) + coalesce(ki.received_quantity, 0),
       received_quantity = NULL,
       updated_at        = now()
 WHERE coalesce(ki.issued_quantity, 0) = 0
   AND ki.received_quantity IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.stock_ledger l
      WHERE l.reference_type = 'KIT_ITEM_ISSUE'
        AND l.reference_id = ki.id
        AND l.qty_delta < 0
   );

-- The duplicate kit keeps its lines and its ledger history - the material really
-- did go - but it is marked RECEIVED so it stops occupying the one-open-kit slot
-- and stops appearing on the floor's "to count" list as a second live kit for the
-- same voucher. Which of the two is the duplicate is not something SQL should
-- guess, so the newest is kept open and the older is closed.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY production_order_id ORDER BY created_at DESC) AS rn
    FROM public.kit_preparation
   WHERE status IN ('PREPARED', 'SHORTAGE', 'SENT')
)
UPDATE public.kit_preparation kp
   SET status = 'RECEIVED',
       notes = concat_ws(' | ', kp.notes,
               'Closed by migration: a second open kit existed for this voucher before one-open-kit was enforced.'),
       updated_at = now()
  FROM ranked r
 WHERE r.id = kp.id AND r.rn > 1;

-- sent_at was never set by the dispatch code, so a kit that had gone out looked
-- like one that had not. Backfilled from when the kit was created, which for these
-- rows is the moment it was sent.
UPDATE public.kit_preparation
   SET sent_at = created_at, updated_at = now()
 WHERE sent_at IS NULL AND status IN ('SENT', 'RECEIVED', 'DISPUTED');

-- ---------------------------------------------------------------------------
-- One open kit per voucher.
-- ---------------------------------------------------------------------------
-- Created last: the index cannot be built while the duplicate above is still
-- open, so the repair has to run first.
--
-- Only while it is still in the store's or the floor's hands. Once production has
-- counted it (RECEIVED / DISPUTED), a genuinely separate later issue is allowed to
-- start a new kit.
CREATE UNIQUE INDEX kit_one_open_per_order
  ON public.kit_preparation (production_order_id)
  WHERE status IN ('PREPARED', 'SHORTAGE', 'SENT');
