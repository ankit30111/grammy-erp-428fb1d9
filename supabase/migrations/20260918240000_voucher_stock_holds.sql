-- Scheduling a voucher never held any material, so every voucher saw the whole
-- warehouse as free.
--
-- Three vouchers exist for J6C right now - 1000, 1500 and 500 units - which
-- between them need 51,000 of Z-015 against 89,500 in the main store. Each
-- voucher's materials screen showed Held = 0 and Free = 89,500, so all three
-- believed they had the full quantity. The netting that screen exists to do was
-- not happening at all.
--
-- The cause: PPC's "Block materials" button inserted a hold with
-- source = 'VOUCHER' and no production_order_id. The table has a check constraint
-- saying a VOUCHER hold must name its order, so every insert was refused, the
-- error was swallowed into a toast, and stock_holds stayed empty. Reader built,
-- writer broken.
--
-- Two things are wrong with that design beyond the missing column:
--
-- 1. Holding material was a button somebody had to remember to press. The whole
--    point of Required / Available / Held / Free / Balance is that vouchers
--    compete for the same stock. If the hold is optional, the numbers are wrong
--    by default and right only by diligence.
-- 2. Nothing ever moved a hold to ISSUED or RELEASED. The lifecycle
--    (ACTIVE -> ISSUED -> RELEASED) existed in the enum and nowhere else, so a
--    hold - had one ever been created - would have blocked its material forever,
--    including after the kit was physically issued and the stock had already left.
--
-- So holds are maintained by the database from the voucher itself: created when a
-- voucher is created, recomputed when its quantity changes, marked ISSUED when the
-- kit goes to the floor, released when the voucher is cancelled. No button.

-- ---------------------------------------------------------------------------
-- Recompute a voucher's holds from its BOM.
-- ---------------------------------------------------------------------------
-- Recompute, never adjust: the ACTIVE holds for a voucher are deleted and rebuilt
-- from BOM x quantity. Incrementing a hold when a voucher's quantity changes is
-- how holds drift away from what the voucher actually needs.
CREATE OR REPLACE FUNCTION public.sync_voucher_holds(p_production_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  o       public.production_orders%ROWTYPE;
  v_main  uuid;
  v_count integer;
BEGIN
  SELECT * INTO o FROM public.production_orders WHERE id = p_production_order_id;
  IF o.id IS NULL THEN
    RETURN 0;
  END IF;

  -- A voucher that is finished, failed or cancelled holds nothing.
  IF o.status IN ('COMPLETED', 'OQC_PASSED', 'OQC_FAILED', 'CANCELLED') THEN
    UPDATE public.stock_holds
       SET status = 'RELEASED', released_at = now(), updated_at = now()
     WHERE production_order_id = p_production_order_id AND status = 'ACTIVE';
    RETURN 0;
  END IF;

  -- Once the kit has gone to the floor the material has physically left the main
  -- store. Those holds are ISSUED and must not be rebuilt, or the same quantity
  -- would be counted twice - once as gone, once as held.
  IF EXISTS (
    SELECT 1 FROM public.stock_holds
     WHERE production_order_id = p_production_order_id AND status = 'ISSUED'
  ) THEN
    RETURN 0;
  END IF;

  SELECT id INTO v_main
    FROM public.stock_locations
   WHERE plant_id = o.plant_id AND code = 'MAIN' AND is_active;
  IF v_main IS NULL THEN
    RETURN 0;   -- no main store configured; nothing sensible to hold against
  END IF;

  DELETE FROM public.stock_holds
   WHERE production_order_id = p_production_order_id AND status = 'ACTIVE';

  INSERT INTO public.stock_holds (
    plant_id, location_id, part_id, quantity, needed_on, source,
    production_order_id, reference_type, reference_id, status, created_by
  )
  SELECT
    o.plant_id, v_main, b.child_part_id, b.quantity * o.quantity, o.planned_date,
    'VOUCHER', o.id, 'PRODUCTION_ORDER', o.id, 'ACTIVE', o.created_by
  FROM public.bom b
  WHERE b.parent_part_id = o.part_id
    AND b.is_active
    -- stock_holds requires quantity > 0; a zero BOM line would abort the lot.
    AND b.quantity * o.quantity > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_voucher_holds(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_voucher_holds(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- The voucher maintains its own holds.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_voucher_holds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.sync_voucher_holds(NEW.id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_voucher_holds_on_insert
  AFTER INSERT ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_voucher_holds();

-- Quantity, product or status changing all change what should be held.
CREATE TRIGGER trg_voucher_holds_on_change
  AFTER UPDATE OF quantity, part_id, status, planned_date ON public.production_orders
  FOR EACH ROW
  WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity
     OR OLD.part_id IS DISTINCT FROM NEW.part_id
     OR OLD.status IS DISTINCT FROM NEW.status
     OR OLD.planned_date IS DISTINCT FROM NEW.planned_date)
  EXECUTE FUNCTION public.trg_sync_voucher_holds();

-- ---------------------------------------------------------------------------
-- Issuing the kit ends the hold.
-- ---------------------------------------------------------------------------
-- When the store issues a kit the material leaves the main store through the
-- stock ledger. If the hold stayed ACTIVE the same quantity would be subtracted
-- twice: once because it is gone, once because it is "reserved".
CREATE OR REPLACE FUNCTION public.release_holds_on_kit_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'SENT' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'SENT') THEN
    UPDATE public.stock_holds
       SET status = 'ISSUED', released_at = now(), updated_at = now()
     WHERE production_order_id = NEW.production_order_id AND status = 'ACTIVE';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_release_holds_on_kit_sent
  AFTER INSERT OR UPDATE OF status ON public.kit_preparation
  FOR EACH ROW EXECUTE FUNCTION public.release_holds_on_kit_sent();

-- ---------------------------------------------------------------------------
-- Backfill the vouchers that exist now.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.production_orders
            WHERE status NOT IN ('COMPLETED', 'OQC_PASSED', 'OQC_FAILED', 'CANCELLED')
  LOOP
    PERFORM public.sync_voucher_holds(r.id);
  END LOOP;
END $$;
