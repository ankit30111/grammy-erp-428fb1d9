
-- Phase 1: Clean up duplicate material movement entries and fix double logging

-- Step 1: Remove duplicate material movement entries for production dispatches
-- Keep only the most recent entry for each material-production combination
WITH duplicate_entries AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY raw_material_id, reference_id, movement_type, quantity 
      ORDER BY created_at DESC
    ) as rn
  FROM material_movements 
  WHERE movement_type = 'ISSUED_TO_PRODUCTION'
    AND reference_type = 'PRODUCTION_VOUCHER'
)
DELETE FROM material_movements 
WHERE id IN (
  SELECT id FROM duplicate_entries WHERE rn > 1
);

-- Step 2: Update the production dispatch logging function to prevent double logging
CREATE OR REPLACE FUNCTION public.log_production_dispatch()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Log material movement when inventory is reduced (materials sent to production)
  IF TG_OP = 'UPDATE' AND OLD.quantity > NEW.quantity THEN
    -- Check if this movement was already logged to prevent duplicates
    -- Look for identical movements within the last 5 minutes
    IF NOT EXISTS (
      SELECT 1 FROM material_movements 
      WHERE raw_material_id = NEW.raw_material_id 
      AND movement_type = 'ISSUED_TO_PRODUCTION'
      AND reference_type = 'PRODUCTION_VOUCHER'
      AND quantity = (OLD.quantity - NEW.quantity)
      AND created_at > NOW() - INTERVAL '5 minutes'
    ) THEN
      -- This indicates materials were sent out from inventory
      PERFORM log_material_movement(
        NEW.raw_material_id,
        'ISSUED_TO_PRODUCTION',
        OLD.quantity - NEW.quantity,
        NEW.id,
        'PRODUCTION_VOUCHER',
        'DISPATCH-' || NEW.id::text,
        'Material dispatched to production. Stock reduced from ' || OLD.quantity || ' to ' || NEW.quantity
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.quantity < NEW.quantity THEN
    -- This indicates materials were returned to inventory
    PERFORM log_material_movement(
      NEW.raw_material_id,
      'PRODUCTION_RETURN',
      NEW.quantity - OLD.quantity,
      NEW.id,
      'PRODUCTION_VOUCHER',
      'RETURN-' || NEW.id::text,
      'Material returned to inventory. Stock increased from ' || OLD.quantity || ' to ' || NEW.quantity
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Step 3: Create a new table to track production-side material receipts
CREATE TABLE IF NOT EXISTS public.production_material_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL,
  raw_material_id UUID NOT NULL,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  received_by UUID,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.production_material_receipts 
ADD CONSTRAINT fk_production_order 
FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE;

ALTER TABLE public.production_material_receipts 
ADD CONSTRAINT fk_raw_material 
FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE;

-- Create unique constraint to prevent duplicate receipts
ALTER TABLE public.production_material_receipts 
ADD CONSTRAINT unique_production_material_receipt 
UNIQUE (production_order_id, raw_material_id);

-- Step 4: Add RLS policies for the new table
ALTER TABLE public.production_material_receipts ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read production material receipts
CREATE POLICY "Allow read access to production material receipts" 
ON public.production_material_receipts 
FOR SELECT 
TO authenticated 
USING (true);

-- Allow all authenticated users to insert production material receipts
CREATE POLICY "Allow insert access to production material receipts" 
ON public.production_material_receipts 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow all authenticated users to update production material receipts
CREATE POLICY "Allow update access to production material receipts" 
ON public.production_material_receipts 
FOR UPDATE 
TO authenticated 
USING (true);

-- Step 5: Create function to log production material receipts
CREATE OR REPLACE FUNCTION public.log_production_material_receipt(
  p_production_order_id UUID,
  p_raw_material_id UUID,
  p_quantity INTEGER,
  p_received_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
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
  
  -- Also log this as a material movement for audit trail
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

-- Step 6: Update movement type constraint to include new movement type
ALTER TABLE material_movements DROP CONSTRAINT IF EXISTS material_movements_movement_type_check;
ALTER TABLE material_movements ADD CONSTRAINT material_movements_movement_type_check 
CHECK (movement_type IN (
  'ISSUED_TO_PRODUCTION',
  'PRODUCTION_RETURN', 
  'PRODUCTION_FEEDBACK_RETURN',
  'PRODUCTION_RECEIPT_VERIFIED',
  'GRN_RECEIPT',
  'STOCK_ADJUSTMENT',
  'STOCK_RECONCILIATION',
  'INVENTORY_DEDUCTION',
  'INVENTORY_ADDITION'
));
