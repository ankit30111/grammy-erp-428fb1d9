-- Add RLS policy for the purchase_order_received_quantities view
-- Enable RLS on the view
ALTER VIEW public.purchase_order_received_quantities OWNER TO authenticated;

-- Create RLS policy for the view to allow authenticated users to read
CREATE POLICY "Allow authenticated users to view purchase order quantities"
ON public.purchase_order_items
FOR SELECT
USING (true);