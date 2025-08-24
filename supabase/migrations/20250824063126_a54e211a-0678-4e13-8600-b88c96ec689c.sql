
-- 1) Recreate vendor code generator with a safe search_path
CREATE OR REPLACE FUNCTION public.generate_vendor_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    next_number INTEGER;
    new_code TEXT;
BEGIN
    -- Find next sequence number among codes like VDR001, VDR002, ...
    SELECT COALESCE(MAX(CAST(SUBSTRING(vendor_code FROM 'VDR(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.vendors
    WHERE vendor_code ~ '^VDR\d{3}$';

    new_code := 'VDR' || LPAD(next_number::TEXT, 3, '0');
    RETURN new_code;
END;
$$;

-- 2) Recreate the trigger function that sets vendor_code on insert
CREATE OR REPLACE FUNCTION public.set_vendor_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.vendor_code IS NULL OR NEW.vendor_code = '' THEN
        NEW.vendor_code := public.generate_vendor_code();
    END IF;
    RETURN NEW;
END;
$$;

-- 3) Ensure the BEFORE INSERT trigger exists on public.vendors
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_trigger t
    JOIN   pg_class c ON t.tgrelid = c.oid
    JOIN   pg_namespace n ON c.relnamespace = n.oid
    WHERE  n.nspname = 'public'
      AND  c.relname = 'vendors'
      AND  t.tgname = 'set_vendor_code_trigger'
      AND  NOT t.tgisinternal
  ) THEN
    -- Drop and recreate to be certain it's wired to the current function
    EXECUTE 'DROP TRIGGER set_vendor_code_trigger ON public.vendors';
  END IF;

  EXECUTE 'CREATE TRIGGER set_vendor_code_trigger
           BEFORE INSERT ON public.vendors
           FOR EACH ROW
           EXECUTE FUNCTION public.set_vendor_code()';
END $$;
