-- Add vessel_name column to import_containers table
ALTER TABLE public.import_containers 
ADD COLUMN vessel_name TEXT;