-- 1) Auto-generate PO number on insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_po_number'
  ) THEN
    CREATE TRIGGER trg_set_po_number
    BEFORE INSERT ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_po_number();
  END IF;
END $$;

-- 2) Keep projections.scheduled_quantity synced with production_schedules changes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projection_scheduled_qty_insert') THEN
    CREATE TRIGGER trg_projection_scheduled_qty_insert
    AFTER INSERT ON public.production_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_projection_scheduled_quantity();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projection_scheduled_qty_update') THEN
    CREATE TRIGGER trg_projection_scheduled_qty_update
    AFTER UPDATE ON public.production_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_projection_scheduled_quantity();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projection_scheduled_qty_delete') THEN
    CREATE TRIGGER trg_projection_scheduled_qty_delete
    AFTER DELETE ON public.production_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_projection_scheduled_quantity();
  END IF;
END $$;

-- 3) View for PO received and pending quantities used by the frontend
CREATE OR REPLACE VIEW public.purchase_order_received_quantities AS
SELECT 
  poi.id AS purchase_order_item_id,
  COALESCE(poi.received_quantity, 0) AS total_received_quantity,
  GREATEST(poi.quantity - COALESCE(poi.received_quantity, 0), 0) AS pending_quantity
FROM public.purchase_order_items poi;
