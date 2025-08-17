-- Drop the trigger first, then the function, then recreate both properly
DROP TRIGGER IF EXISTS enforce_iqc_report_upload ON grn_items;
DROP FUNCTION IF EXISTS validate_iqc_report_required();

-- Recreate the function with proper security settings
CREATE OR REPLACE FUNCTION validate_iqc_report_required()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only apply validation when IQC status is being set to completed states
  IF NEW.iqc_status IN ('APPROVED', 'REJECTED', 'SEGREGATED') 
     AND (OLD.iqc_status IS NULL OR OLD.iqc_status = 'PENDING' OR OLD.iqc_status != NEW.iqc_status) THEN
    
    -- Check if iqc_report_url is provided
    IF NEW.iqc_report_url IS NULL OR NEW.iqc_report_url = '' THEN
      RAISE EXCEPTION 'IQC report upload is mandatory for completing inspection. Please upload a report before marking as %.', NEW.iqc_status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER enforce_iqc_report_upload
  BEFORE UPDATE ON grn_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_iqc_report_required();