
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  current_month TEXT;
  next_sequence INTEGER;
  new_po_number TEXT;
BEGIN
  current_month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');

  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO-\d{2}-(\d+)') AS INTEGER)), 0) + 1
  INTO next_sequence
  FROM public.purchase_orders
  WHERE po_number LIKE 'PO-' || current_month || '-%';

  new_po_number := 'PO-' || current_month || '-' || LPAD(next_sequence::TEXT, 2, '0');
  RETURN new_po_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_po_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := public.generate_po_number();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_set_po_number ON public.purchase_orders;
