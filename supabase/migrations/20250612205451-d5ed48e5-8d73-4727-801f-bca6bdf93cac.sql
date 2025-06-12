
-- First, let's fix the inventory sync to use store physical quantities
-- Update existing inventory records to reflect actual store-verified quantities
UPDATE inventory 
SET quantity = subquery.total_store_quantity
FROM (
  SELECT 
    gi.raw_material_id,
    SUM(COALESCE(gi.store_physical_quantity, gi.accepted_quantity)) as total_store_quantity
  FROM grn_items gi
  WHERE gi.store_confirmed = true
  GROUP BY gi.raw_material_id
) AS subquery
WHERE inventory.raw_material_id = subquery.raw_material_id;

-- Create enhanced material movement logging function
CREATE OR REPLACE FUNCTION public.log_material_movement(
  p_raw_material_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_reference_id uuid,
  p_reference_type text,
  p_reference_number text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO material_movements (
    raw_material_id,
    movement_type,
    quantity,
    reference_id,
    reference_type,
    reference_number,
    notes,
    created_at
  ) VALUES (
    p_raw_material_id,
    p_movement_type,
    p_quantity,
    p_reference_id,
    p_reference_type,
    p_reference_number,
    p_notes,
    now()
  );
END;
$function$;

-- Update the store verification trigger to log movements and use physical quantities
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
    
    -- Log the material movement for audit trail
    PERFORM log_material_movement(
      NEW.raw_material_id,
      'GRN_RECEIPT',
      NEW.store_physical_quantity,
      NEW.grn_id,
      'GRN',
      (SELECT grn_number FROM grn WHERE id = NEW.grn_id),
      'Material received to store after physical verification. IQC Approved: ' || NEW.accepted_quantity || ', Store Verified: ' || NEW.store_physical_quantity
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for production material dispatch logging
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
      NEW.id, -- Using inventory id as reference since we don't have production order context here
      'INVENTORY_DEDUCTION',
      'MANUAL-' || NEW.id::text,
      'Material dispatched to production. Stock reduced from ' || OLD.quantity || ' to ' || NEW.quantity
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.quantity < NEW.quantity THEN
    -- This indicates materials were returned to inventory
    PERFORM log_material_movement(
      NEW.raw_material_id,
      'PRODUCTION_RETURN',
      NEW.quantity - OLD.quantity,
      NEW.id,
      'INVENTORY_ADDITION',
      'RETURN-' || NEW.id::text,
      'Material returned to inventory. Stock increased from ' || OLD.quantity || ' to ' || NEW.quantity
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for inventory changes
DROP TRIGGER IF EXISTS log_inventory_movements_trigger ON public.inventory;
CREATE TRIGGER log_inventory_movements_trigger
  AFTER UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.log_production_dispatch();
