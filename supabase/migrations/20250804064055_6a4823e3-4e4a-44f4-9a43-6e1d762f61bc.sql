-- Make purchase_order_id nullable in GRN table to allow non-PO GRNs
ALTER TABLE public.grn 
ALTER COLUMN purchase_order_id DROP NOT NULL;

-- Update the description to clarify this allows both PO and non-PO GRNs
COMMENT ON COLUMN public.grn.purchase_order_id IS 'Reference to purchase order. Can be null for direct material receipts without PO';