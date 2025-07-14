-- Clean up inconsistent approval workflows for PO-07-03 and PO-07-04
-- This will enable the review action buttons that are currently locked

-- Delete all existing approval workflows for these specific POs
DELETE FROM public.approval_workflows 
WHERE workflow_type = 'PURCHASE_ORDER_APPROVAL' 
AND reference_id IN (
  SELECT id FROM public.purchase_orders 
  WHERE po_number IN ('PO-07-03', 'PO-07-04')
);

-- Clear rejection reasons for these POs to give them a fresh start
UPDATE public.purchase_orders 
SET rejection_reason = NULL
WHERE po_number IN ('PO-07-03', 'PO-07-04') 
AND status = 'PENDING';