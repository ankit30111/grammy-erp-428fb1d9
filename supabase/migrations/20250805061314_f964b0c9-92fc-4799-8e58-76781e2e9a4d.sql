-- Fix the search path security issues for the GRN functions
CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  current_month TEXT;
  next_sequence INTEGER;
  new_grn_number TEXT;
BEGIN
  -- Get current month in MM format
  current_month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  
  -- Get the next sequence number for this month
  SELECT COALESCE(MAX(CAST(SUBSTRING(grn_number FROM 'GRN_\d{2}_(\d+)') AS INTEGER)), 0) + 1
  INTO next_sequence
  FROM grn
  WHERE grn_number LIKE 'GRN_' || current_month || '_%';
  
  -- Generate the new GRN number
  new_grn_number := 'GRN_' || current_month || '_' || LPAD(next_sequence::TEXT, 2, '0');
  
  RETURN new_grn_number;
END;
$function$;

-- Update the trigger function with proper search path
CREATE OR REPLACE FUNCTION public.set_grn_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.grn_number IS NULL OR NEW.grn_number = '' THEN
    NEW.grn_number := generate_grn_number();
  END IF;
  RETURN NEW;
END;
$function$;