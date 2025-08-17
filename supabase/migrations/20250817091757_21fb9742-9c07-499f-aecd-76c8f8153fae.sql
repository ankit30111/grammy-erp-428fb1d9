-- Fix the search path for the validate_iqc_report_required function
DROP FUNCTION IF EXISTS validate_iqc_report_required();

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