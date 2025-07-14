-- Enhanced Customer Complaints System Migration
-- Create new tables and modify existing ones for batch receipt processing

-- Create enum for receipt types
CREATE TYPE receipt_type AS ENUM ('COMPLETE_PRODUCTS', 'DATA_ONLY', 'FAULTY_PARTS_ONLY');

-- Create enum for batch item types  
CREATE TYPE batch_item_type AS ENUM ('PRODUCT', 'DATA', 'PART');

-- Create customer_complaint_batches table
CREATE TABLE customer_complaint_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  bill_number TEXT NOT NULL,
  batch_number TEXT NOT NULL UNIQUE,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purchase_date DATE,
  receipt_type receipt_type NOT NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create customer_complaint_batch_items table
CREATE TABLE customer_complaint_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES customer_complaint_batches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  brand_name TEXT NOT NULL,
  quantity_received INTEGER NOT NULL DEFAULT 1,
  item_type batch_item_type NOT NULL,
  part_description TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add new columns to customer_complaints table
ALTER TABLE customer_complaints 
ADD COLUMN batch_id UUID REFERENCES customer_complaint_batches(id),
ADD COLUMN complaint_number TEXT UNIQUE,
ADD COLUMN batch_item_id UUID REFERENCES customer_complaint_batch_items(id);

-- Create function to generate batch numbers
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TEXT 
LANGUAGE plpgsql
AS $$
DECLARE
  current_year TEXT;
  next_sequence INTEGER;
  new_batch_number TEXT;
BEGIN
  -- Get current year in YYYY format
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number FROM 'CCB-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO next_sequence
  FROM customer_complaint_batches
  WHERE batch_number LIKE 'CCB-' || current_year || '-%';
  
  -- Generate the new batch number
  new_batch_number := 'CCB-' || current_year || '-' || LPAD(next_sequence::TEXT, 3, '0');
  
  RETURN new_batch_number;
END;
$$;

-- Create function to generate complaint numbers
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TEXT 
LANGUAGE plpgsql
AS $$
DECLARE
  current_year TEXT;
  next_sequence INTEGER;
  new_complaint_number TEXT;
BEGIN
  -- Get current year in YYYY format
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(complaint_number FROM 'CC-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO next_sequence
  FROM customer_complaints
  WHERE complaint_number LIKE 'CC-' || current_year || '-%';
  
  -- Generate the new complaint number
  new_complaint_number := 'CC-' || current_year || '-' || LPAD(next_sequence::TEXT, 3, '0');
  
  RETURN new_complaint_number;
END;
$$;

-- Create trigger to auto-set batch number
CREATE OR REPLACE FUNCTION set_batch_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.batch_number IS NULL OR NEW.batch_number = '' THEN
    NEW.batch_number := generate_batch_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_batch_number
  BEFORE INSERT ON customer_complaint_batches
  FOR EACH ROW
  EXECUTE FUNCTION set_batch_number();

-- Create trigger to auto-set complaint number
CREATE OR REPLACE FUNCTION set_complaint_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.complaint_number IS NULL OR NEW.complaint_number = '' THEN
    NEW.complaint_number := generate_complaint_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_complaint_number
  BEFORE INSERT ON customer_complaints
  FOR EACH ROW
  EXECUTE FUNCTION set_complaint_number();

-- Create trigger to update updated_at
CREATE TRIGGER trigger_update_complaint_batches_updated_at
  BEFORE UPDATE ON customer_complaint_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on new tables
ALTER TABLE customer_complaint_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_complaint_batch_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customer_complaint_batches
CREATE POLICY "Users can view complaint batches" 
ON customer_complaint_batches FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own complaint batches" 
ON customer_complaint_batches FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own complaint batches" 
ON customer_complaint_batches FOR UPDATE 
USING (auth.uid() = created_by);

-- Create RLS policies for customer_complaint_batch_items
CREATE POLICY "Users can view complaint batch items" 
ON customer_complaint_batch_items FOR SELECT 
USING (true);

CREATE POLICY "Users can insert complaint batch items" 
ON customer_complaint_batch_items FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update complaint batch items" 
ON customer_complaint_batch_items FOR UPDATE 
USING (true);

-- Function to create individual complaints from batch items
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
    -- Create individual complaints for each quantity
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
        1, -- Always 1 per complaint
        batch_record.bill_number,
        batch_record.receipt_date,
        batch_record.purchase_date,
        CASE 
          WHEN batch_record.receipt_type = 'COMPLETE_PRODUCTS' THEN 'Product received for analysis'
          WHEN batch_record.receipt_type = 'DATA_ONLY' THEN 'Data analysis requested'
          WHEN batch_record.receipt_type = 'FAULTY_PARTS_ONLY' THEN 'Faulty part: ' || COALESCE(item_record.part_description, 'Part analysis required')
          ELSE 'Customer complaint received'
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