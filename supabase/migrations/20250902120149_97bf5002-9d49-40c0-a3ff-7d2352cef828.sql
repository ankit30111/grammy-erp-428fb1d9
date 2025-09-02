-- Fix vendor creation by recreating the missing functions and trigger with CASCADE

-- Drop existing triggers first
DROP TRIGGER IF EXISTS set_vendor_code_trigger ON public.vendors;
DROP TRIGGER IF EXISTS trigger_set_vendor_code ON public.vendors;

-- Drop and recreate the functions with CASCADE
DROP FUNCTION IF EXISTS public.set_vendor_code() CASCADE;
DROP FUNCTION IF EXISTS public.generate_vendor_code() CASCADE;

-- Recreate the generate_vendor_code function with proper search path
CREATE OR REPLACE FUNCTION public.generate_vendor_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    next_number INTEGER;
    new_code TEXT;
BEGIN
    -- Get the next number in sequence for VDR prefix
    SELECT COALESCE(MAX(CAST(SUBSTRING(vendor_code FROM 'VDR(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.vendors
    WHERE vendor_code ~ '^VDR\d{3}$';
    
    -- Generate the new vendor code with VDR prefix
    new_code := 'VDR' || LPAD(next_number::TEXT, 3, '0');
    
    RETURN new_code;
END;
$function$;

-- Recreate the set_vendor_code function with proper search path
CREATE OR REPLACE FUNCTION public.set_vendor_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.vendor_code IS NULL OR NEW.vendor_code = '' THEN
        NEW.vendor_code := public.generate_vendor_code();
    END IF;
    RETURN NEW;
END;
$function$;

-- Create the trigger
CREATE TRIGGER set_vendor_code_trigger
    BEFORE INSERT ON public.vendors
    FOR EACH ROW
    EXECUTE FUNCTION public.set_vendor_code();