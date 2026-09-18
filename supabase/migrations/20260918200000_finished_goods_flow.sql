-- Finished goods: one way in, one way out.
--
-- Both ends of this were writing columns that do not exist, so neither end worked:
--
--   OQC pass  -> inserted finished_goods_inventory with quantity, quality_status
--                and production_date, and no plant_id or production_order_id.
--                Three of those are not columns and two of the missing ones are
--                NOT NULL, so passing OQC never produced finished goods at all.
--   Dispatch  -> filtered on quality_status and quantity, ordered FIFO by
--                production_date, then decremented quantity. None of those columns
--                exist. quantity_available is GENERATED as
--                quantity_in - quantity_dispatched, so it cannot be written to.
--
-- Beyond the column names, the dispatch loop read a lot, computed a new number in
-- the browser and wrote it back. Two dispatches running at once each read the same
-- starting quantity and the second overwrites the first, so stock silently
-- reappears. Allocation is therefore done here, in one statement per lot, under a
-- row lock.
--
-- quality_status is not reintroduced. An OQC verdict already records whether the
-- goods passed; a second column saying the same thing is a second source of truth,
-- and they drift. Finished goods exist only because OQC passed them.

-- ---------------------------------------------------------------------------
-- In: OQC passes a production order.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_finished_goods(p_production_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  o  public.production_orders%ROWTYPE;
  v_qty numeric;
  v_id  uuid;
BEGIN
  SELECT * INTO o FROM public.production_orders WHERE id = p_production_order_id;
  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Production order not found';
  END IF;

  IF NOT (public.in_plant(o.plant_id) AND public.has_role('quality')) THEN
    RAISE EXCEPTION 'Only quality can book finished goods in';
  END IF;

  -- Booking in twice would double the stock. The production order is the natural
  -- key: one order produces one finished-goods lot.
  SELECT id INTO v_id FROM public.finished_goods_inventory
   WHERE production_order_id = p_production_order_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- What was actually produced, not what was ordered. produced_quantity is
  -- maintained by trigger from the hourly reports; falling back to the ordered
  -- quantity would book in goods that were never made.
  v_qty := coalesce(nullif(o.produced_quantity, 0), o.quantity);
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'Nothing has been reported as produced against this voucher';
  END IF;

  INSERT INTO public.finished_goods_inventory (
    plant_id, production_order_id, part_id, quantity_in, lot_number
  ) VALUES (
    o.plant_id, o.id, o.part_id, v_qty, o.voucher_number
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.receive_finished_goods(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_finished_goods(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Out: allocate a dispatch against finished-goods lots, oldest first.
-- ---------------------------------------------------------------------------
-- Returns the lots it consumed so the caller can show what went out. It raises
-- rather than part-filling: a dispatch note that silently ships less than it says
-- is worse than one that refuses to be created.
CREATE OR REPLACE FUNCTION public.allocate_finished_goods(
  p_dispatch_order_id uuid,
  p_part_id           uuid,
  p_quantity          numeric
) RETURNS TABLE (lot_id uuid, lot_number text, taken numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plant     uuid;
  v_remaining numeric := p_quantity;
  v_take      numeric;
  r           record;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Dispatch quantity must be more than zero';
  END IF;

  SELECT plant_id INTO v_plant FROM public.dispatch_orders WHERE id = p_dispatch_order_id;
  IF v_plant IS NULL THEN
    RAISE EXCEPTION 'Dispatch order not found';
  END IF;
  IF NOT (public.in_plant(v_plant) AND public.has_role('sales')) THEN
    RAISE EXCEPTION 'Not permitted to dispatch for this plant';
  END IF;

  -- FOR UPDATE is what makes two concurrent dispatches queue instead of both
  -- reading the same availability and overselling.
  -- Every column is table-qualified: the OUT parameters (lot_id, lot_number,
  -- taken) share names with columns here, and PL/pgSQL rejects an unqualified
  -- reference as ambiguous rather than guessing.
  FOR r IN
    SELECT fgi.id AS fg_id, fgi.lot_number AS fg_lot, fgi.quantity_available AS fg_available
      FROM public.finished_goods_inventory fgi
     WHERE fgi.plant_id = v_plant AND fgi.part_id = p_part_id
       AND fgi.quantity_available > 0
     ORDER BY fgi.created_at
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := least(v_remaining, r.fg_available);

    UPDATE public.finished_goods_inventory
       SET quantity_dispatched = quantity_dispatched + v_take, updated_at = now()
     WHERE id = r.fg_id;

    INSERT INTO public.dispatch_order_items (
      dispatch_order_id, finished_goods_inventory_id, quantity
    ) VALUES (p_dispatch_order_id, r.fg_id, v_take);

    v_remaining := v_remaining - v_take;

    lot_id := r.fg_id; lot_number := r.fg_lot; taken := v_take;
    RETURN NEXT;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Only % of % available in finished goods for this product',
      p_quantity - v_remaining, p_quantity;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_finished_goods(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_finished_goods(uuid, uuid, numeric) TO authenticated;

-- One lot per production order, so receive_finished_goods cannot race itself.
CREATE UNIQUE INDEX IF NOT EXISTS finished_goods_one_lot_per_order
  ON public.finished_goods_inventory (production_order_id);
