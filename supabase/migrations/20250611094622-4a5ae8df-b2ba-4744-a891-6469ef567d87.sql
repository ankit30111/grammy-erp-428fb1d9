
-- Update the generate_grn_number function to use month-based format GRN_MM_XX
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
  FROM grn
  WHERE grn_number LIKE 'GRN_' || current_month || '_%';
  
  -- Generate the new GRN number
  new_grn_number := 'GRN_' || current_month || '_' || LPAD(next_sequence::TEXT, 2, '0');
  
  RETURN new_grn_number;
END;
$function$;

-- Update existing GRN records to use the new format using a CTE
WITH numbered_grns AS (
  SELECT 
    id,
    'GRN_' || LPAD(EXTRACT(MONTH FROM created_at)::TEXT, 2, '0') || '_' || 
    LPAD(ROW_NUMBER() OVER (PARTITION BY EXTRACT(MONTH FROM created_at), EXTRACT(YEAR FROM created_at) ORDER BY created_at)::TEXT, 2, '0') as new_grn_number
  FROM grn
  WHERE grn_number ~ '^GRN-\d+$'
)
UPDATE grn 
SET grn_number = numbered_grns.new_grn_number
FROM numbered_grns
WHERE grn.id = numbered_grns.id;
