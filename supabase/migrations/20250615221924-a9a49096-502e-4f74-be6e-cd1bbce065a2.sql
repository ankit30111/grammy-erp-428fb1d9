
-- Fix the invalid estimated_completion_date for the project "ab"
-- Set it to a future date (June 30, 2025) which is after the created_at date
UPDATE npd_projects 
SET estimated_completion_date = '2025-06-30'
WHERE project_name = 'ab' 
AND estimated_completion_date < created_at::date;

-- Add a constraint to prevent future invalid date entries
-- This ensures estimated_completion_date is always after or equal to the creation date
ALTER TABLE npd_projects 
ADD CONSTRAINT check_estimated_completion_date_valid 
CHECK (estimated_completion_date IS NULL OR estimated_completion_date >= created_at::date);

-- Do the same fix and constraint for pre_existing_projects table
UPDATE pre_existing_projects 
SET estimated_completion_date = '2025-06-30'
WHERE estimated_completion_date IS NOT NULL 
AND estimated_completion_date < created_at::date;

ALTER TABLE pre_existing_projects 
ADD CONSTRAINT check_estimated_completion_date_valid 
CHECK (estimated_completion_date IS NULL OR estimated_completion_date >= created_at::date);
