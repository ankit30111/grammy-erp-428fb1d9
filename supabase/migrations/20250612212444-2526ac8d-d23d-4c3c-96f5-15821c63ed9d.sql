
-- First, let's fix the database function to properly log GRN receipts
CREATE OR REPLACE FUNCTION public.update_inventory_from_store_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Update inventory when store completes physical verification
  IF TG_OP = 'UPDATE' AND 
     NEW.store_physical_quantity IS NOT NULL AND 
     OLD.store_physical_quantity IS NULL AND
     NEW.store_confirmed = true THEN
    
    -- Update inventory with the actual physically verified quantity
    INSERT INTO inventory (raw_material_id, quantity, location, last_updated)
    VALUES (NEW.raw_material_id, NEW.store_physical_quantity, 'Main Store', NOW())
    ON CONFLICT (raw_material_id)
    DO UPDATE SET 
      quantity = inventory.quantity + NEW.store_physical_quantity,
      last_updated = NOW();
    
    -- Get GRN details for logging
    DECLARE
      grn_record RECORD;
    BEGIN
      SELECT grn_number INTO grn_record FROM grn WHERE id = NEW.grn_id;
      
      -- Log the material movement for audit trail using the log_material_movement function
      PERFORM log_material_movement(
        NEW.raw_material_id,
        'GRN_RECEIPT',
        NEW.store_physical_quantity,
        NEW.grn_id,
        'GRN',
        grn_record.grn_number,
        'Material received to store after physical verification. IQC Approved: ' || NEW.accepted_quantity || ', Store Verified: ' || NEW.store_physical_quantity
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update the production dispatch logging function to handle both deductions and returns properly
CREATE OR REPLACE FUNCTION public.log_production_dispatch()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Log material movement when inventory is reduced (materials sent to production)
  IF TG_OP = 'UPDATE' AND OLD.quantity > NEW.quantity THEN
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

-- Backfill missing GRN movement entries for existing confirmed GRN items
INSERT INTO material_movements (
  raw_material_id,
  movement_type,
  quantity,
  reference_id,
  reference_type,
  reference_number,
  notes,
  created_at
)
SELECT 
  gi.raw_material_id,
  'GRN_RECEIPT',
  COALESCE(gi.store_physical_quantity, gi.accepted_quantity),
  gi.grn_id,
  'GRN',
  g.grn_number,
  'Backfilled: Material received to store. IQC Approved: ' || gi.accepted_quantity || 
  CASE 
    WHEN gi.store_physical_quantity IS NOT NULL 
    THEN ', Store Verified: ' || gi.store_physical_quantity
    ELSE ''
  END,
  COALESCE(gi.store_confirmed_at, gi.iqc_approved_at, gi.created_at)
FROM grn_items gi
JOIN grn g ON gi.grn_id = g.id
WHERE gi.store_confirmed = true
AND NOT EXISTS (
  SELECT 1 FROM material_movements mm 
  WHERE mm.raw_material_id = gi.raw_material_id 
  AND mm.reference_id = gi.grn_id 
  AND mm.movement_type = 'GRN_RECEIPT'
);

-- Ensure the constraint allows all necessary reference types
ALTER TABLE material_movements DROP CONSTRAINT IF EXISTS material_movements_reference_type_check;
ALTER TABLE material_movements ADD CONSTRAINT material_movements_reference_type_check 
CHECK (reference_type IN (
  'GRN',
  'PRODUCTION_VOUCHER', 
  'PRODUCTION_ORDER',
  'SPARE_ORDER',
  'INVENTORY_ADJUSTMENT',
  'INVENTORY_DEDUCTION',
  'INVENTORY_ADDITION'
));
