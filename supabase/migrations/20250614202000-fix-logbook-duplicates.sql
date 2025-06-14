
-- Enhanced material movement logging function with deduplication
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
  -- Check for duplicate entries within the last 5 minutes
  IF NOT EXISTS (
    SELECT 1 FROM material_movements 
    WHERE raw_material_id = p_raw_material_id 
    AND movement_type = p_movement_type
    AND reference_number = p_reference_number
    AND quantity = p_quantity
    AND created_at > NOW() - INTERVAL '5 minutes'
  ) THEN
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
  END IF;
END;
$function$;

-- Update inventory dispatch trigger to use standardized references
CREATE OR REPLACE FUNCTION public.log_production_dispatch()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only log significant inventory changes (avoid micro-adjustments)
  IF TG_OP = 'UPDATE' AND ABS(OLD.quantity - NEW.quantity) > 0 THEN
    
    IF OLD.quantity > NEW.quantity THEN
      -- Materials sent to production - use voucher number if available
      PERFORM log_material_movement(
        NEW.raw_material_id,
        'ISSUED_TO_PRODUCTION',
        OLD.quantity - NEW.quantity,
        NEW.id,
        'PRODUCTION_VOUCHER',
        COALESCE(
          (SELECT voucher_number FROM production_orders WHERE id = NEW.id LIMIT 1),
          'DISPATCH-' || NEW.id::text
        ),
        'Material dispatched to production. Stock reduced from ' || OLD.quantity || ' to ' || NEW.quantity
      );
    ELSIF OLD.quantity < NEW.quantity THEN
      -- Materials returned to inventory
      PERFORM log_material_movement(
        NEW.raw_material_id,
        'PRODUCTION_RETURN',
        NEW.quantity - OLD.quantity,
        NEW.id,
        'PRODUCTION_VOUCHER',
        COALESCE(
          (SELECT voucher_number FROM production_orders WHERE id = NEW.id LIMIT 1),
          'RETURN-' || NEW.id::text
        ),
        'Material returned to inventory. Stock increased from ' || OLD.quantity || ' to ' || NEW.quantity
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Clean up existing duplicate entries (keep most recent)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY raw_material_id, movement_type, reference_number, quantity, DATE_TRUNC('minute', created_at)
      ORDER BY created_at DESC
    ) as rn
  FROM material_movements
)
DELETE FROM material_movements 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
