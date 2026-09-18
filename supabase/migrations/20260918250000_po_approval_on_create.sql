-- A purchase order goes for approval the moment it is created, and any change to
-- an approved one sends it back.
--
-- Today a PO is created as DRAFT and sits there until somebody remembers to press
-- "Send for Approval". That button is the only thing standing between a PO being
-- written and a PO being real, which makes forgetting it indistinguishable from
-- deciding not to send it. Nobody chases a draft.
--
-- What Ankit asked for: create it, it is pending approval; you can still open and
-- edit it while it waits; once approved you can still edit it, but the edit puts
-- it back in the approval queue.
--
-- That last rule is the one worth enforcing in the database rather than the
-- browser. An approved PO is a commitment to a vendor at a price. If editing it
-- after approval were only discouraged by the UI, the approval would mean nothing
-- the moment somebody used a different screen, an older tab, or the API.

-- ---------------------------------------------------------------------------
-- New POs start in the approval queue.
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchase_orders ALTER COLUMN status SET DEFAULT 'PENDING_APPROVAL';

-- Existing drafts are moved along rather than left in a state nothing will ever
-- take them out of, now that the button is gone.
UPDATE public.purchase_orders SET status = 'PENDING_APPROVAL' WHERE status = 'DRAFT';

-- ---------------------------------------------------------------------------
-- Editing an approved PO returns it for approval.
-- ---------------------------------------------------------------------------
-- Only commercial content counts. Notes are how people annotate a PO for each
-- other; making a clarifying note invalidate an approval would teach everyone to
-- stop writing them.
CREATE OR REPLACE FUNCTION public.po_reapproval_on_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_changed boolean;
BEGIN
  -- A status change on its own is the approval itself, not an edit.
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status NOT IN ('APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED') THEN
    RETURN NEW;
  END IF;

  v_changed :=
       OLD.vendor_id             IS DISTINCT FROM NEW.vendor_id
    OR OLD.currency              IS DISTINCT FROM NEW.currency
    OR OLD.po_date               IS DISTINCT FROM NEW.po_date
    OR OLD.promised_delivery_date IS DISTINCT FROM NEW.promised_delivery_date
    OR OLD.promised_loading_date IS DISTINCT FROM NEW.promised_loading_date
    OR OLD.is_import             IS DISTINCT FROM NEW.is_import
    OR OLD.origin_country        IS DISTINCT FROM NEW.origin_country
    OR OLD.projection_id         IS DISTINCT FROM NEW.projection_id;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  -- Goods already received against this PO cannot be un-received by an edit, so
  -- changing the vendor after a receipt is refused outright rather than sent back
  -- for approval: the stock in the store came from the old vendor.
  IF OLD.status IN ('PARTIALLY_RECEIVED', 'RECEIVED')
     AND OLD.vendor_id IS DISTINCT FROM NEW.vendor_id THEN
    RAISE EXCEPTION 'Material has already been received against this PO; the vendor can no longer be changed';
  END IF;

  NEW.status      := 'PENDING_APPROVAL';
  NEW.approved_by := NULL;
  NEW.approved_at := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_po_reapproval_on_edit
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.po_reapproval_on_edit();

-- ---------------------------------------------------------------------------
-- Changing the lines counts as an edit too.
-- ---------------------------------------------------------------------------
-- The quantities and prices ARE the purchase order. An approval that survives its
-- lines being rewritten is not an approval.
CREATE OR REPLACE FUNCTION public.po_item_reapproval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_po_id  uuid := coalesce(NEW.purchase_order_id, OLD.purchase_order_id);
  v_status public.po_status;
BEGIN
  SELECT status INTO v_status FROM public.purchase_orders WHERE id = v_po_id;

  IF TG_OP = 'UPDATE'
     AND OLD.quantity IS NOT DISTINCT FROM NEW.quantity
     AND OLD.unit_price IS NOT DISTINCT FROM NEW.unit_price
     AND OLD.part_id IS NOT DISTINCT FROM NEW.part_id THEN
    -- received_quantity is maintained by the GRN trigger; a receipt is not an edit.
    RETURN NULL;
  END IF;

  IF v_status IN ('APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED') THEN
    UPDATE public.purchase_orders
       SET status = 'PENDING_APPROVAL', approved_by = NULL, approved_at = NULL,
           updated_at = now()
     WHERE id = v_po_id;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_po_item_reapproval
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.po_item_reapproval();

-- A line cannot be cut below what has already arrived, whatever the PO's status.
-- Allowing it would leave received_quantity > quantity and the PO permanently
-- over-received, which is how pending-quantity arithmetic stops making sense.
CREATE OR REPLACE FUNCTION public.po_item_not_below_received()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF coalesce(OLD.received_quantity, 0) > 0 THEN
      RAISE EXCEPTION 'This line already has % received and cannot be removed',
        OLD.received_quantity;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.quantity < coalesce(NEW.received_quantity, 0) THEN
    RAISE EXCEPTION 'Quantity cannot be less than the % already received on this line',
      NEW.received_quantity;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_po_item_not_below_received
  BEFORE UPDATE OR DELETE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.po_item_not_below_received();
