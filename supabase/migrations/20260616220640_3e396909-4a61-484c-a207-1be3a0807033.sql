
-- KIT NUMBER
CREATE OR REPLACE FUNCTION public.generate_kit_number()
RETURNS text LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  RETURN 'KIT-' || LPAD(nextval('public.kit_number_seq')::text, 6, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.set_kit_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.kit_number IS NULL OR NEW.kit_number = '' THEN
    NEW.kit_number := public.generate_kit_number();
  END IF;
  RETURN NEW;
END; $$;

-- DISPATCH ORDER NUMBER
CREATE OR REPLACE FUNCTION public.generate_dispatch_order_number()
RETURNS text LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  RETURN 'DO-' || LPAD(nextval('public.dispatch_order_seq')::text, 6, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.set_dispatch_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.dispatch_order_number IS NULL OR NEW.dispatch_order_number = '' THEN
    NEW.dispatch_order_number := public.generate_dispatch_order_number();
  END IF;
  RETURN NEW;
END; $$;

-- SPARE ORDER NUMBER
CREATE OR REPLACE FUNCTION public.generate_spare_order_number()
RETURNS text LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  RETURN 'SO-' || LPAD(nextval('public.spare_order_seq')::text, 6, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.set_spare_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.spare_order_number IS NULL OR NEW.spare_order_number = '' THEN
    NEW.spare_order_number := public.generate_spare_order_number();
  END IF;
  RETURN NEW;
END; $$;
