
-- Enhanced cleanup script to remove ALL duplicate entries from material_movements
-- This will keep only the most recent entry for each unique combination

-- First, let's see what we're dealing with (for reference)
-- SELECT 
--   COUNT(*) as total_entries,
--   COUNT(DISTINCT CONCAT(raw_material_id::text, movement_type, reference_number, quantity::text)) as unique_combinations
-- FROM material_movements;

-- Delete duplicate entries, keeping only the most recent one for each unique combination
WITH duplicates_to_delete AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        raw_material_id, 
        movement_type, 
        reference_number, 
        quantity,
        DATE_TRUNC('minute', created_at)  -- Group by minute to catch near-simultaneous entries
      ORDER BY created_at DESC  -- Keep the most recent
    ) as row_number
  FROM material_movements
),
deletion_list AS (
  SELECT id 
  FROM duplicates_to_delete 
  WHERE row_number > 1
)
DELETE FROM material_movements 
WHERE id IN (SELECT id FROM deletion_list);

-- Additional cleanup for entries with similar reference patterns but different formats
-- Remove old format entries where new format entries exist
DELETE FROM material_movements m1
WHERE EXISTS (
  SELECT 1 FROM material_movements m2
  WHERE m2.raw_material_id = m1.raw_material_id
  AND m2.movement_type = m1.movement_type
  AND m2.quantity = m1.quantity
  AND ABS(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at))) < 300 -- Within 5 minutes
  AND m2.id != m1.id
  AND (
    -- Keep new format, remove old format
    (m2.reference_number ~ '^(PROD|GRN|REQ)[-_][0-9]{2}[-_][0-9]{2}$' AND m1.reference_number ~ '^(DISPATCH|RETURN|RECEIPT)-[a-f0-9-]+$')
    OR
    -- If both are old format, keep the newer one
    (m2.created_at > m1.created_at AND m2.reference_number ~ '^(DISPATCH|RETURN|RECEIPT)-[a-f0-9-]+$' AND m1.reference_number ~ '^(DISPATCH|RETURN|RECEIPT)-[a-f0-9-]+$')
  )
);

-- Clean up any remaining exact duplicates (same everything including timestamp within 1 minute)
DELETE FROM material_movements m1
WHERE EXISTS (
  SELECT 1 FROM material_movements m2
  WHERE m2.raw_material_id = m1.raw_material_id
  AND m2.movement_type = m1.movement_type
  AND m2.quantity = m1.quantity
  AND m2.reference_number = m1.reference_number
  AND ABS(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at))) < 60 -- Within 1 minute
  AND m2.id > m1.id  -- Keep the one with higher ID (more recent)
);

-- Update the enhanced deduplication function to be more aggressive
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
  -- Enhanced duplicate check - look for any similar entry in the last 10 minutes
  IF NOT EXISTS (
    SELECT 1 FROM material_movements 
    WHERE raw_material_id = p_raw_material_id 
    AND movement_type = p_movement_type
    AND quantity = p_quantity
    AND (
      reference_number = p_reference_number
      OR (
        -- Also check for old vs new format conflicts
        (reference_number ~ '^(DISPATCH|RETURN|RECEIPT)-' AND p_reference_number ~ '^(PROD|GRN|REQ)[-_]')
        OR (reference_number ~ '^(PROD|GRN|REQ)[-_]' AND p_reference_number ~ '^(DISPATCH|RETURN|RECEIPT)-')
      )
    )
    AND created_at > NOW() - INTERVAL '10 minutes'
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

-- Show the cleanup results
SELECT 
  'Cleanup completed. Remaining entries:' as status,
  COUNT(*) as total_entries,
  COUNT(DISTINCT CONCAT(raw_material_id::text, movement_type, reference_number, quantity::text)) as unique_combinations
FROM material_movements;
