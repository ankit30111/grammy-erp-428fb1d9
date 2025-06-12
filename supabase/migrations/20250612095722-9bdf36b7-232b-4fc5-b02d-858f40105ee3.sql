
-- Add the missing production_line column to production_schedules table
ALTER TABLE public.production_schedules 
ADD COLUMN production_line TEXT;

-- Add a comment to document that this field is optional
COMMENT ON COLUMN public.production_schedules.production_line IS 'Optional production line assignment. Can be assigned later in the workflow.';

-- Update any existing records to have NULL production_line (they're already NULL by default)
-- This ensures backward compatibility with existing data
