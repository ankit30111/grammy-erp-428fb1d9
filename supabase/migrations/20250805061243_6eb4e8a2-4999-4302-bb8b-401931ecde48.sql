-- Fix the database functions that are causing the GRN creation to fail
-- Update the generate_grn_number function to properly reference the public schema
CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS text
LANGUAGE plpgsql
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
  FROM public.grn
  WHERE grn_number LIKE 'GRN_' || current_month || '_%';
  
  -- Generate the new GRN number
  new_grn_number := 'GRN_' || current_month || '_' || LPAD(next_sequence::TEXT, 2, '0');
  
  RETURN new_grn_number;
END;
$function$;

-- Update the trigger function to properly reference the public schema
CREATE OR REPLACE FUNCTION public.set_grn_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.grn_number IS NULL OR NEW.grn_number = '' THEN
    NEW.grn_number := public.generate_grn_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS set_grn_number_trigger ON public.grn;
CREATE TRIGGER set_grn_number_trigger
  BEFORE INSERT ON public.grn
  FOR EACH ROW
  EXECUTE FUNCTION public.set_grn_number();