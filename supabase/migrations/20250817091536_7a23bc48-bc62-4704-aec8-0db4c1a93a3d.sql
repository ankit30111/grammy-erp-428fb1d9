-- Create trigger to enforce mandatory IQC report upload
CREATE OR REPLACE FUNCTION validate_iqc_report_required()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER enforce_iqc_report_upload
  BEFORE UPDATE ON grn_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_iqc_report_required();

-- Clean up existing data: Revert completed IQC items without reports back to PENDING
UPDATE grn_items 
SET 
  iqc_status = 'PENDING',
  iqc_completed_at = NULL,
  iqc_completed_by = NULL,
  accepted_quantity = 0,
  rejected_quantity = 0
WHERE iqc_status IN ('APPROVED', 'REJECTED', 'SEGREGATED') 
  AND (iqc_report_url IS NULL OR iqc_report_url = '');

-- Also revert GRN status back to PENDING if all its items are now PENDING
UPDATE grn 
SET status = 'PENDING'
WHERE id IN (
  SELECT DISTINCT grn_id 
  FROM grn_items 
  WHERE grn_id IN (
    SELECT grn_id 
    FROM grn_items 
    GROUP BY grn_id 
    HAVING COUNT(*) = COUNT(CASE WHEN iqc_status = 'PENDING' THEN 1 END)
  )
);