
-- PHASE 1: Stop All Duplicate Logging Sources
-- Remove the problematic database trigger that creates duplicates
DROP TRIGGER IF EXISTS log_inventory_movements_trigger ON public.inventory;

-- PHASE 2: Clean up ALL existing bad entries with random references
-- Delete all entries with random UUID-style references (DISPATCH-, RETURN-, RECEIPT-)
DELETE FROM material_movements 
WHERE reference_number ~ '^(DISPATCH|RETURN|RECEIPT)-[a-f0-9-]{36}$'
   OR reference_number ~ '^(DISPATCH|RETURN|RECEIPT)-[a-f0-9-]{8,}$'
   OR reference_number ~ '^MANUAL-[a-f0-9-]{36}$';

-- Delete duplicate entries created by double logging
WITH duplicates_to_delete AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        raw_material_id, 
        movement_type, 
        quantity,
        DATE_TRUNC('hour', created_at)  -- Group by hour to catch duplicates
      ORDER BY created_at DESC  -- Keep the most recent
    ) as row_number
  FROM material_movements
)
DELETE FROM material_movements 
WHERE id IN (
  SELECT id FROM duplicates_to_delete WHERE row_number > 1
);

-- PHASE 3: Update the log_material_movement function to be even more strict
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
  -- STRICT duplicate prevention - check for identical movements in last 30 minutes
  IF NOT EXISTS (
    SELECT 1 FROM material_movements 
    WHERE raw_material_id = p_raw_material_id 
    AND movement_type = p_movement_type
    AND quantity = p_quantity
    AND reference_number = p_reference_number
    AND created_at > NOW() - INTERVAL '30 minutes'
  ) THEN
    -- Only insert if it's a proper reference format (not random UUIDs)
    IF p_reference_number ~ '^(PROD|GRN|REQ)[-_][0-9]{2}[-_][0-9]{2}$' 
       OR p_reference_number ~ '^REQ-[A-Z0-9]{6,8}$' THEN
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
  END IF;
END;
$function$;

-- Show final cleanup results
SELECT 
  'Final cleanup completed. Clean entries remaining:' as status,
  COUNT(*) as total_entries,
  COUNT(DISTINCT CONCAT(raw_material_id::text, movement_type, reference_number, quantity::text)) as unique_combinations,
  array_agg(DISTINCT movement_type) as movement_types_remaining
FROM material_movements;
