-- Add rejection_reason column to purchase_orders table to support PO rejection
ALTER TABLE public.purchase_orders ADD COLUMN rejection_reason TEXT;