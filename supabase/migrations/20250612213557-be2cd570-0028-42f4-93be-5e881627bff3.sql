
-- Remove duplicate material movement entries for production dispatches
-- Keep only the most recent entry for each material-production combination
WITH duplicate_entries AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY raw_material_id, reference_id, movement_type 
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

-- Update the production dispatch logging function to prevent double logging
CREATE OR REPLACE FUNCTION public.log_production_dispatch()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Log material movement when inventory is reduced (materials sent to production)
  IF TG_OP = 'UPDATE' AND OLD.quantity > NEW.quantity THEN
    -- Check if this movement was already logged to prevent duplicates
    IF NOT EXISTS (
      SELECT 1 FROM material_movements 
      WHERE raw_material_id = NEW.raw_material_id 
      AND movement_type = 'ISSUED_TO_PRODUCTION'
      AND quantity = (OLD.quantity - NEW.quantity)
      AND created_at > NOW() - INTERVAL '1 minute'
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
