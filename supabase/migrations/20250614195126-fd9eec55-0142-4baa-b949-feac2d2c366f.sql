
-- Create production_material_discrepancies table for tracking quantity mismatches
CREATE TABLE public.production_material_discrepancies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL,
  raw_material_id UUID NOT NULL,
  kit_item_id UUID NOT NULL,
  sent_quantity INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL,
  discrepancy_quantity INTEGER NOT NULL,
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN ('SHORTAGE', 'EXCESS')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolution_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Foreign key constraints
  CONSTRAINT fk_production_order FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
  CONSTRAINT fk_raw_material FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id),
  CONSTRAINT fk_kit_item FOREIGN KEY (kit_item_id) REFERENCES kit_items(id),
  
  -- Unique constraint to prevent duplicate discrepancies for the same kit item
  CONSTRAINT unique_kit_item_discrepancy UNIQUE (kit_item_id)
);

-- Add RLS policy for production_material_discrepancies
ALTER TABLE public.production_material_discrepancies ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_production_discrepancies_status ON production_material_discrepancies(status);
CREATE INDEX idx_production_discrepancies_production_order ON production_material_discrepancies(production_order_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_production_discrepancies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_production_discrepancies_updated_at
  BEFORE UPDATE ON production_material_discrepancies
  FOR EACH ROW
  EXECUTE FUNCTION update_production_discrepancies_updated_at();

-- Update material_requests table to include SENT status
ALTER TABLE material_requests 
DROP CONSTRAINT IF EXISTS material_requests_status_check;

ALTER TABLE material_requests 
ADD CONSTRAINT material_requests_status_check 
CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SENT'));
