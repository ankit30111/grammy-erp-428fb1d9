DROP TRIGGER IF EXISTS update_inventory_from_store_verification_trigger ON public.grn_items;

ALTER TABLE public.projections
  ADD COLUMN IF NOT EXISTS vouchered_qty numeric NOT NULL DEFAULT 0;