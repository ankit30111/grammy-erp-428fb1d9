-- Remove batch number functionality and focus on serial numbers

-- Drop batch number generation functions and triggers
DROP TRIGGER IF EXISTS trigger_set_batch_number ON customer_complaint_batches;
DROP FUNCTION IF EXISTS set_batch_number();
DROP FUNCTION IF EXISTS generate_batch_number();

-- Remove batch_number column from customer_complaint_batches table
ALTER TABLE customer_complaint_batches DROP COLUMN IF EXISTS batch_number;

-- Update the create_complaints_from_batch function to not use batch numbers
CREATE OR REPLACE FUNCTION create_complaints_from_batch(p_batch_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  batch_record RECORD;
  item_record RECORD;
  complaint_id UUID;
  i INTEGER;
BEGIN
  -- Get batch details
  SELECT * INTO batch_record 
  FROM customer_complaint_batches 
  WHERE id = p_batch_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;
  
  -- Loop through each batch item and create individual complaints
  FOR item_record IN 
    SELECT * FROM customer_complaint_batch_items 
    WHERE batch_id = p_batch_id 
  LOOP
    -- Create individual complaints for each quantity (serial number will be added later)
    FOR i IN 1..item_record.quantity_received LOOP
      INSERT INTO customer_complaints (
        customer_id,
        product_id,
        brand_name,
        quantity,
        bill_number,
        complaint_date,
        purchase_date,
        complaint_reason,
        status,
        batch_id,
        batch_item_id,
        created_by
      ) VALUES (
        batch_record.customer_id,
        item_record.product_id,
        item_record.brand_name,
        1, -- Always 1 per complaint for individual serial tracking
        batch_record.bill_number,
        batch_record.receipt_date,
        batch_record.purchase_date,
        CASE 
          WHEN batch_record.receipt_type = 'COMPLETE_PRODUCTS' THEN 'Product received for analysis - Serial number to be assigned'
          WHEN batch_record.receipt_type = 'DATA_ONLY' THEN 'Data analysis requested - Serial number to be assigned'
          WHEN batch_record.receipt_type = 'FAULTY_PARTS_ONLY' THEN 'Faulty part: ' || COALESCE(item_record.part_description, 'Part analysis required - Serial number to be assigned')
          ELSE 'Customer complaint received - Serial number to be assigned'
        END,
        'Open',
        batch_record.id,
        item_record.id,
        batch_record.created_by
      );
    END LOOP;
  END LOOP;
END;
$$;