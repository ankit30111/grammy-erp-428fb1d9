-- Fix projection deletion issue by updating foreign key constraint to cascade delete
-- This allows projections to be deleted even when they have associated production schedules

-- Drop the existing foreign key constraint
ALTER TABLE production_schedules 
DROP CONSTRAINT IF EXISTS production_schedules_projection_id_fkey;

-- Add the foreign key constraint with CASCADE DELETE
ALTER TABLE production_schedules 
ADD CONSTRAINT production_schedules_projection_id_fkey 
FOREIGN KEY (projection_id) 
REFERENCES projections(id) 
ON DELETE CASCADE;