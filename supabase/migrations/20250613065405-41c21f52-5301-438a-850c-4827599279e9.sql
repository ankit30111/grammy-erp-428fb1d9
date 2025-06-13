
-- Add discrepancy tracking fields to production_material_receipts table
ALTER TABLE production_material_receipts 
ADD COLUMN IF NOT EXISTS sent_quantity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS discrepancy_quantity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS discrepancy_type text,
ADD COLUMN IF NOT EXISTS discrepancy_status text DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS resolved_by uuid,
ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS resolution_notes text;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_production_material_receipts_discrepancy 
ON production_material_receipts(discrepancy_status, production_order_id);

-- Update material_movements table to track discrepancy resolutions
ALTER TABLE material_movements 
ADD COLUMN IF NOT EXISTS discrepancy_id uuid;

-- Create function to handle production receipt with discrepancy detection
CREATE OR REPLACE FUNCTION log_production_receipt_with_discrepancy(
  p_production_order_id uuid,
  p_raw_material_id uuid,
  p_sent_quantity integer,
  p_received_quantity integer,
  p_received_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_discrepancy_quantity integer;
  v_discrepancy_type text;
  v_receipt_id uuid;
BEGIN
  -- Calculate discrepancy
  v_discrepancy_quantity := ABS(p_sent_quantity - p_received_quantity);
  
  IF p_received_quantity > p_sent_quantity THEN
    v_discrepancy_type := 'EXCESS';
  ELSIF p_received_quantity < p_sent_quantity THEN
    v_discrepancy_type := 'SHORTAGE';
  ELSE
    v_discrepancy_type := NULL;
  END IF;
  
  -- Insert or update production material receipt
  INSERT INTO production_material_receipts (
    production_order_id,
    raw_material_id,
    quantity_received,
    sent_quantity,
    discrepancy_quantity,
    discrepancy_type,
    discrepancy_status,
    received_by,
    notes
  ) VALUES (
    p_production_order_id,
    p_raw_material_id,
    p_received_quantity,
    p_sent_quantity,
    CASE WHEN v_discrepancy_quantity > 0 THEN v_discrepancy_quantity ELSE NULL END,
    v_discrepancy_type,
    CASE WHEN v_discrepancy_quantity > 0 THEN 'PENDING' ELSE 'NO_DISCREPANCY' END,
    p_received_by,
    p_notes
  )
  ON CONFLICT (production_order_id, raw_material_id)
  DO UPDATE SET
    quantity_received = production_material_receipts.quantity_received + EXCLUDED.quantity_received,
    sent_quantity = production_material_receipts.sent_quantity + EXCLUDED.sent_quantity,
    discrepancy_quantity = EXCLUDED.discrepancy_quantity,
    discrepancy_type = EXCLUDED.discrepancy_type,
    discrepancy_status = EXCLUDED.discrepancy_status,
    received_by = EXCLUDED.received_by,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_receipt_id;
  
  RETURN v_receipt_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to resolve discrepancies
CREATE OR REPLACE FUNCTION resolve_production_receipt_discrepancy(
  p_receipt_id uuid,
  p_action text, -- 'APPROVE' or 'REJECT'
  p_resolved_by uuid,
  p_resolution_notes text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_receipt RECORD;
BEGIN
  -- Get receipt details
  SELECT * INTO v_receipt
  FROM production_material_receipts
  WHERE id = p_receipt_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production material receipt not found';
  END IF;
  
  -- Update discrepancy status
  UPDATE production_material_receipts
  SET 
    discrepancy_status = CASE 
      WHEN p_action = 'APPROVE' THEN 'APPROVED'
      WHEN p_action = 'REJECT' THEN 'REJECTED'
      ELSE discrepancy_status
    END,
    resolved_by = p_resolved_by,
    resolved_at = now(),
    resolution_notes = p_resolution_notes,
    updated_at = now()
  WHERE id = p_receipt_id;
  
  -- Handle inventory adjustments based on resolution
  IF p_action = 'APPROVE' AND v_receipt.discrepancy_type = 'SHORTAGE' THEN
    -- If shortage is approved, add back the shortage quantity to inventory
    UPDATE inventory
    SET 
      quantity = quantity + v_receipt.discrepancy_quantity,
      last_updated = now()
    WHERE raw_material_id = v_receipt.raw_material_id;
    
    -- Log the inventory adjustment
    PERFORM log_material_movement(
      v_receipt.raw_material_id,
      'DISCREPANCY_ADJUSTMENT',
      v_receipt.discrepancy_quantity,
      v_receipt.production_order_id,
      'PRODUCTION_DISCREPANCY',
      'DISC-' || v_receipt.id::text,
      'Inventory adjustment for approved shortage discrepancy: ' || COALESCE(p_resolution_notes, 'Production received less than sent')
    );
  ELSIF p_action = 'REJECT' AND v_receipt.discrepancy_type = 'EXCESS' THEN
    -- If excess is rejected, remove the excess quantity from production receipt
    UPDATE production_material_receipts
    SET quantity_received = sent_quantity
    WHERE id = p_receipt_id;
  END IF;
  
  -- Log the discrepancy resolution
  PERFORM log_material_movement(
    v_receipt.raw_material_id,
    'DISCREPANCY_RESOLUTION',
    v_receipt.discrepancy_quantity,
    v_receipt.production_order_id,
    'PRODUCTION_DISCREPANCY',
    'RES-' || v_receipt.id::text,
    'Discrepancy ' || p_action || ': ' || COALESCE(p_resolution_notes, 'No notes provided')
  );
END;
$$ LANGUAGE plpgsql;
