-- Fix production orders foreign key constraint to complete projection deletion cascade
-- This allows production_schedules to be deleted when projections are deleted

-- Drop the existing foreign key constraint
ALTER TABLE production_orders 
DROP CONSTRAINT IF EXISTS production_orders_production_schedule_id_fkey;

-- Add the foreign key constraint with CASCADE DELETE
ALTER TABLE production_orders 
ADD CONSTRAINT production_orders_production_schedule_id_fkey 
FOREIGN KEY (production_schedule_id) 
REFERENCES production_schedules(id) 
ON DELETE CASCADE;