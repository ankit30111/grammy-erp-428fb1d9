-- kit_preparation.status was free text with no constraint, and the app had grown
-- fifteen different spellings for about five real states: "SENT", "KIT SENT",
-- "COMPLETE KIT SENT", "PARTIAL KIT SENT", "MAIN ASSEMBLY COMPONENTS SENT",
-- "SUB ASSEMBLY COMPONENTS SENT", "ACCESSORY COMPONENTS SENT", "VERIFIED",
-- "KIT VERIFIED", "VERIFIED_WITH_DISCREPANCY", "PREPARED", "KIT_PREPARED",
-- "NOT_PREPARED", "SHORTAGE", "READY".
--
-- The cost was not untidiness. The store writes "SENT"; Production > Kit
-- Verification filtered for "COMPLETE KIT SENT" and the four assembly variants, so
-- that screen was permanently empty and nobody could tell whether the cause was no
-- kits or a broken screen. A free-text status cannot fail loudly, so it fails
-- silently forever.
--
-- Five states, matching what actually happens on the floor:
--
--   PREPARED   kit lines exist, nothing issued yet
--   SHORTAGE   the store cannot issue in full
--   SENT       issued to production; stock has left the main store
--   RECEIVED   production counted it and agrees with what was issued
--   DISPUTED   production counted it and raised kit_feedback
--
-- The old assembly-type spellings are gone rather than mapped: which section of
-- the BOM a line belongs to is a property of the line, never of the kit's status.

ALTER TABLE public.kit_preparation
  ALTER COLUMN status SET DEFAULT 'PREPARED';

-- kit_preparation is empty at the time of this migration, so no value mapping is
-- needed. The UPDATE is here so the migration is still correct if it is ever run
-- against a database that does have rows.
UPDATE public.kit_preparation SET status =
  CASE upper(btrim(status))
    WHEN 'KIT_PREPARED' THEN 'PREPARED'
    WHEN 'NOT_PREPARED' THEN 'PREPARED'
    WHEN 'READY'        THEN 'PREPARED'
    WHEN 'KIT SENT'     THEN 'SENT'
    WHEN 'COMPLETE KIT SENT' THEN 'SENT'
    WHEN 'PARTIAL KIT SENT'  THEN 'SENT'
    WHEN 'MAIN ASSEMBLY COMPONENTS SENT'     THEN 'SENT'
    WHEN 'SUB ASSEMBLY COMPONENTS SENT'      THEN 'SENT'
    WHEN 'ACCESSORY COMPONENTS SENT'         THEN 'SENT'
    WHEN 'VERIFIED'     THEN 'RECEIVED'
    WHEN 'KIT VERIFIED' THEN 'RECEIVED'
    WHEN 'VERIFIED_WITH_DISCREPANCY' THEN 'DISPUTED'
    WHEN 'SHORTAGE'     THEN 'SHORTAGE'
    ELSE 'PREPARED'
  END
WHERE status IS NOT NULL;

ALTER TABLE public.kit_preparation
  ADD CONSTRAINT kit_preparation_status_check
  CHECK (status IN ('PREPARED', 'SHORTAGE', 'SENT', 'RECEIVED', 'DISPUTED'));

-- ---------------------------------------------------------------------------
-- Production records what it actually received.
-- ---------------------------------------------------------------------------
-- The old screen wrote kit_items.verified_by_production (a column that does not
-- exist) and set received_quantity itself, so nothing was recorded and no dispute
-- was raised. Recording receipt and raising a dispute are one decision, so they
-- are one transaction here rather than several writes from the browser that can
-- half-succeed.
--
-- This function moves no stock. If production received less or more than was
-- issued, it files a kit_feedback row and the store decides - accept_kit_feedback
-- is still the only thing that corrects the main store.
CREATE OR REPLACE FUNCTION public.record_kit_receipt(
  p_kit_id  uuid,
  p_lines   jsonb,   -- [{ "kit_item_id": uuid, "received_quantity": num, "reason": text }]
  p_notes   text DEFAULT NULL
) RETURNS TABLE (disputed_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plant    uuid;
  v_status   text;
  v_order    uuid;
  v_line     jsonb;
  v_item     public.kit_items%ROWTYPE;
  v_received numeric;
  v_reason   text;
  v_disputed int := 0;
BEGIN
  SELECT plant_id, status, production_order_id
    INTO v_plant, v_status, v_order
    FROM public.kit_preparation WHERE id = p_kit_id FOR UPDATE;

  IF v_plant IS NULL THEN
    RAISE EXCEPTION 'Kit not found';
  END IF;

  -- SECURITY DEFINER bypasses RLS, so the caller is checked explicitly.
  IF NOT (public.in_plant(v_plant) AND public.has_role('production')) THEN
    RAISE EXCEPTION 'Only production can record what a kit contained';
  END IF;

  IF v_status <> 'SENT' THEN
    RAISE EXCEPTION 'This kit is %, not SENT - there is nothing to receive', v_status;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_item FROM public.kit_items
     WHERE id = (v_line->>'kit_item_id')::uuid AND kit_preparation_id = p_kit_id
     FOR UPDATE;
    IF v_item.id IS NULL THEN
      RAISE EXCEPTION 'Kit line % does not belong to this kit', v_line->>'kit_item_id';
    END IF;

    v_received := (v_line->>'received_quantity')::numeric;
    IF v_received IS NULL OR v_received < 0 THEN
      RAISE EXCEPTION 'Received quantity must be zero or more';
    END IF;
    v_reason := nullif(btrim(coalesce(v_line->>'reason', '')), '');

    UPDATE public.kit_items
       SET received_quantity = v_received, updated_at = now()
     WHERE id = v_item.id;

    -- A difference is a claim for the store to rule on, not a stock movement.
    IF v_received <> coalesce(v_item.issued_quantity, 0) THEN
      IF v_reason IS NULL THEN
        RAISE EXCEPTION 'Give a reason for the difference on %',
          (SELECT part_code FROM public.parts WHERE id = v_item.part_id);
      END IF;

      INSERT INTO public.kit_feedback (
        plant_id, kit_item_id, production_order_id, part_id,
        issued_quantity, received_quantity, reason, status, raised_by
      ) VALUES (
        v_plant, v_item.id, v_order, v_item.part_id,
        coalesce(v_item.issued_quantity, 0), v_received, v_reason, 'PENDING', auth.uid()
      )
      -- Re-recording a count while the store has not yet ruled updates the open
      -- claim instead of failing on the one-open-per-item index.
      ON CONFLICT (kit_item_id) WHERE status = 'PENDING'
      DO UPDATE SET received_quantity = EXCLUDED.received_quantity,
                    reason            = EXCLUDED.reason,
                    raised_at         = now(),
                    updated_at        = now();

      v_disputed := v_disputed + 1;
    END IF;
  END LOOP;

  UPDATE public.kit_preparation
     SET status     = CASE WHEN v_disputed > 0 THEN 'DISPUTED' ELSE 'RECEIVED' END,
         received_at = now(),
         notes      = coalesce(p_notes, notes),
         updated_at = now()
   WHERE id = p_kit_id;

  disputed_count := v_disputed;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.record_kit_receipt(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_kit_receipt(uuid, jsonb, text) TO authenticated;

-- Once the store resolves the last open claim on a kit, the kit is no longer in
-- dispute. Without this the kit would sit at DISPUTED forever and production could
-- never be marked as having its material.
CREATE OR REPLACE FUNCTION public.sync_kit_status_on_feedback_resolved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_kit uuid;
BEGIN
  IF NEW.status = 'PENDING' OR OLD.status <> 'PENDING' THEN
    RETURN NEW;
  END IF;

  SELECT kit_preparation_id INTO v_kit FROM public.kit_items WHERE id = NEW.kit_item_id;
  IF v_kit IS NULL THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kit_feedback f
      JOIN public.kit_items i ON i.id = f.kit_item_id
     WHERE i.kit_preparation_id = v_kit AND f.status = 'PENDING'
  ) THEN
    UPDATE public.kit_preparation
       SET status = 'RECEIVED', updated_at = now()
     WHERE id = v_kit AND status = 'DISPUTED';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kit_status_on_feedback_resolved
  AFTER UPDATE OF status ON public.kit_feedback
  FOR EACH ROW EXECUTE FUNCTION public.sync_kit_status_on_feedback_resolved();
