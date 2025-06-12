
-- Phase 1: Enhanced Material Verification System - Auto-Discrepancy Detection

-- Step 1: Create production_discrepancies table to track quantity mismatches
CREATE TABLE IF NOT EXISTS public.production_discrepancies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL,
  raw_material_id UUID NOT NULL,
  sent_quantity INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL,
  discrepancy_quantity INTEGER NOT NULL,
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN ('SHORTAGE', 'EXCESS')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RESOLVED')),
  reason TEXT,
  reported_by UUID,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.production_discrepancies 
ADD CONSTRAINT fk_production_discrepancy_production_order 
FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE;

ALTER TABLE public.production_discrepancies 
ADD CONSTRAINT fk_production_discrepancy_raw_material 
FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE;

-- Create unique constraint to prevent duplicate discrepancies
ALTER TABLE public.production_discrepancies 
ADD CONSTRAINT unique_production_discrepancy 
UNIQUE (production_order_id, raw_material_id);

-- Step 2: Add RLS policies for the new table
ALTER TABLE public.production_discrepancies ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read production discrepancies
CREATE POLICY "Allow read access to production discrepancies" 
ON public.production_discrepancies 
FOR SELECT 
TO authenticated 
USING (true);

-- Allow all authenticated users to insert production discrepancies
CREATE POLICY "Allow insert access to production discrepancies" 
ON public.production_discrepancies 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow all authenticated users to update production discrepancies
CREATE POLICY "Allow update access to production discrepancies" 
ON public.production_discrepancies 
FOR UPDATE 
TO authenticated 
USING (true);

-- Step 3: Enhanced function to log production material receipt with auto-discrepancy detection
CREATE OR REPLACE FUNCTION public.log_production_material_receipt_with_discrepancy_check(
  p_production_order_id UUID,
  p_raw_material_id UUID,
  p_quantity INTEGER,
  p_received_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_total_sent INTEGER := 0;
  v_total_received INTEGER := 0;
  v_discrepancy INTEGER := 0;
BEGIN
  -- Insert or update production material receipt
  INSERT INTO production_material_receipts (
    production_order_id,
    raw_material_id,
    quantity_received,
    received_by,
    notes
  ) VALUES (
    p_production_order_id,
    p_raw_material_id,
    p_quantity,
    p_received_by,
    p_notes
  )
  ON CONFLICT (production_order_id, raw_material_id)
  DO UPDATE SET
    quantity_received = production_material_receipts.quantity_received + EXCLUDED.quantity_received,
    received_by = EXCLUDED.received_by,
    notes = EXCLUDED.notes,
    updated_at = now();

  -- Get total sent quantity from material movements
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_sent
  FROM material_movements 
  WHERE raw_material_id = p_raw_material_id 
    AND movement_type = 'ISSUED_TO_PRODUCTION'
    AND reference_type = 'PRODUCTION_VOUCHER'
    AND reference_id IN (
      SELECT id FROM inventory WHERE raw_material_id = p_raw_material_id
    );

  -- Get total received quantity
  SELECT COALESCE(quantity_received, 0) INTO v_total_received
  FROM production_material_receipts
  WHERE production_order_id = p_production_order_id 
    AND raw_material_id = p_raw_material_id;

  -- Calculate discrepancy
  v_discrepancy := v_total_sent - v_total_received;

  -- Auto-create discrepancy record if quantities don't match
  IF v_discrepancy != 0 THEN
    INSERT INTO production_discrepancies (
      production_order_id,
      raw_material_id,
      sent_quantity,
      received_quantity,
      discrepancy_quantity,
      discrepancy_type,
      reason,
      reported_by
    ) VALUES (
      p_production_order_id,
      p_raw_material_id,
      v_total_sent,
      v_total_received,
      ABS(v_discrepancy),
      CASE WHEN v_discrepancy > 0 THEN 'SHORTAGE' ELSE 'EXCESS' END,
      COALESCE(p_notes, 'Quantity mismatch detected during production receipt'),
      p_received_by
    )
    ON CONFLICT (production_order_id, raw_material_id)
    DO UPDATE SET
      sent_quantity = EXCLUDED.sent_quantity,
      received_quantity = EXCLUDED.received_quantity,
      discrepancy_quantity = EXCLUDED.discrepancy_quantity,
      discrepancy_type = EXCLUDED.discrepancy_type,
      reason = EXCLUDED.reason,
      updated_at = now();
  END IF;

  -- Log material movement for audit trail
  PERFORM log_material_movement(
    p_raw_material_id,
    'PRODUCTION_RECEIPT_VERIFIED',
    p_quantity,
    p_production_order_id,
    'PRODUCTION_VOUCHER',
    'RECEIPT-' || p_production_order_id::text,
    COALESCE(p_notes, 'Material receipt verified by production team')
  );
END;
$function$;

-- Step 4: Function to approve/reject production discrepancies
CREATE OR REPLACE FUNCTION public.resolve_production_discrepancy(
  p_discrepancy_id UUID,
  p_action TEXT, -- 'APPROVE' or 'REJECT'
  p_reviewed_by UUID,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_discrepancy RECORD;
BEGIN
  -- Get discrepancy details
  SELECT * INTO v_discrepancy
  FROM production_discrepancies
  WHERE id = p_discrepancy_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discrepancy not found';
  END IF;

  -- Update discrepancy status
  UPDATE production_discrepancies
  SET 
    status = CASE WHEN p_action = 'APPROVE' THEN 'APPROVED' ELSE 'REJECTED' END,
    reviewed_by = p_reviewed_by,
    reviewed_at = now(),
    resolution_notes = p_resolution_notes,
    updated_at = now()
  WHERE id = p_discrepancy_id;

  -- If approved and it's a shortage, adjust inventory
  IF p_action = 'APPROVE' AND v_discrepancy.discrepancy_type = 'SHORTAGE' THEN
    -- Add back the shortage quantity to inventory
    UPDATE inventory
    SET 
      quantity = quantity + v_discrepancy.discrepancy_quantity,
      last_updated = now()
    WHERE raw_material_id = v_discrepancy.raw_material_id;

    -- Log the inventory adjustment
    PERFORM log_material_movement(
      v_discrepancy.raw_material_id,
      'PRODUCTION_FEEDBACK_RETURN',
      v_discrepancy.discrepancy_quantity,
      v_discrepancy.production_order_id,
      'PRODUCTION_DISCREPANCY',
      'ADJ-' || v_discrepancy.id::text,
      'Inventory adjusted due to approved production discrepancy: ' || COALESCE(p_resolution_notes, 'Quantity shortage confirmed by store')
    );
  END IF;

  -- If approved and it's an excess, log the movement (inventory was already reduced)
  IF p_action = 'APPROVE' AND v_discrepancy.discrepancy_type = 'EXCESS' THEN
    PERFORM log_material_movement(
      v_discrepancy.raw_material_id,
      'PRODUCTION_RECEIPT_VERIFIED',
      v_discrepancy.discrepancy_quantity,
      v_discrepancy.production_order_id,
      'PRODUCTION_DISCREPANCY',
      'EXCESS-' || v_discrepancy.id::text,
      'Excess quantity approved by store: ' || COALESCE(p_resolution_notes, 'Additional quantity confirmed received')
    );
  END IF;
END;
$function$;
