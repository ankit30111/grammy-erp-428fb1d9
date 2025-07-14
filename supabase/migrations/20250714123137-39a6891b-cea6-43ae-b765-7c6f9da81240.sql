-- Add raw_material_id field to customer_complaint_batch_items for structured part tracking
ALTER TABLE customer_complaint_batch_items 
ADD COLUMN raw_material_id uuid REFERENCES raw_materials(id);

-- Add index for better performance
CREATE INDEX idx_customer_complaint_batch_items_raw_material_id 
ON customer_complaint_batch_items(raw_material_id);