-- Create function to renumber vouchers after deletion
CREATE OR REPLACE FUNCTION renumber_vouchers_after_deletion(deleted_voucher_number TEXT)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  month_part TEXT;
  deleted_sequence INTEGER;
  voucher_record RECORD;
  new_sequence INTEGER;
  new_voucher_number TEXT;
BEGIN
  -- Extract month part from voucher (PROD_MM_DD format)
  month_part := SUBSTRING(deleted_voucher_number FROM 'PROD_(\d{2})_\d{2}');
  deleted_sequence := CAST(SUBSTRING(deleted_voucher_number FROM 'PROD_\d{2}_(\d{2})') AS INTEGER);
  
  -- Find all vouchers in the same month with higher sequence numbers
  FOR voucher_record IN 
    SELECT ps.id, ps.voucher_number, 
           CAST(SUBSTRING(ps.voucher_number FROM 'PROD_\d{2}_(\d{2})') AS INTEGER) as current_sequence
    FROM production_schedules ps
    WHERE ps.voucher_number LIKE 'PROD_' || month_part || '_%'
    AND CAST(SUBSTRING(ps.voucher_number FROM 'PROD_\d{2}_(\d{2})') AS INTEGER) > deleted_sequence
    ORDER BY CAST(SUBSTRING(ps.voucher_number FROM 'PROD_\d{2}_(\d{2})') AS INTEGER)
  LOOP
    -- Calculate new sequence number (reduce by 1)
    new_sequence := voucher_record.current_sequence - 1;
    new_voucher_number := 'PROD_' || month_part || '_' || LPAD(new_sequence::TEXT, 2, '0');
    
    -- Update the voucher number in production_schedules
    UPDATE production_schedules 
    SET voucher_number = new_voucher_number
    WHERE id = voucher_record.id;
    
    -- Update voucher number in production_orders
    UPDATE production_orders 
    SET voucher_number = new_voucher_number
    WHERE production_schedule_id = voucher_record.id;
    
    -- Update voucher number in other related tables that might reference it
    UPDATE material_requests 
    SET reference_number = new_voucher_number
    WHERE reference_type = 'PRODUCTION_VOUCHER' 
    AND reference_id = voucher_record.id;
    
    UPDATE material_movements 
    SET reference_number = new_voucher_number
    WHERE reference_type = 'PRODUCTION_VOUCHER' 
    AND reference_id = voucher_record.id;
  END LOOP;
END;
$function$;