
-- Create production_capa table for OQC-failed production orders
CREATE TABLE production_capa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID REFERENCES production_orders(id),
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  initiated_by UUID,
  capa_status TEXT DEFAULT 'AWAITED' CHECK (capa_status IN ('AWAITED', 'RECEIVED', 'APPROVED', 'IMPLEMENTED')),
  capa_document_url TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  implemented_at TIMESTAMP WITH TIME ZONE,
  implemented_by UUID,
  remarks TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Update iqc_vendor_capa table to include IMPLEMENTED status
ALTER TABLE iqc_vendor_capa 
ADD COLUMN IF NOT EXISTS implemented_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS implemented_by UUID;

-- Update check constraint to include IMPLEMENTED status
ALTER TABLE iqc_vendor_capa DROP CONSTRAINT IF EXISTS iqc_vendor_capa_capa_status_check;
ALTER TABLE iqc_vendor_capa ADD CONSTRAINT iqc_vendor_capa_capa_status_check 
CHECK (capa_status IN ('AWAITED', 'RECEIVED', 'APPROVED', 'IMPLEMENTED'));

-- Create updated_at trigger for production_capa
CREATE OR REPLACE FUNCTION update_production_capa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER production_capa_updated_at
  BEFORE UPDATE ON production_capa
  FOR EACH ROW
  EXECUTE FUNCTION update_production_capa_updated_at();

-- Auto-create vendor CAPA entries when IQC status is REJECTED or SEGREGATED
CREATE OR REPLACE FUNCTION create_vendor_capa_on_iqc_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create CAPA if status changed to REJECTED or SEGREGATED and no CAPA exists yet
  IF (NEW.iqc_status IN ('REJECTED', 'SEGREGATED') AND 
      OLD.iqc_status != NEW.iqc_status AND
      NOT EXISTS (
        SELECT 1 FROM iqc_vendor_capa 
        WHERE grn_item_id = NEW.id
      )) THEN
    
    INSERT INTO iqc_vendor_capa (
      grn_item_id,
      vendor_id,
      initiated_by,
      capa_status,
      remarks
    )
    SELECT 
      NEW.id,
      g.vendor_id,
      NEW.iqc_completed_by,
      'AWAITED',
      'CAPA required for ' || NEW.iqc_status || ' material: ' || rm.name
    FROM grn g
    JOIN raw_materials rm ON rm.id = NEW.raw_material_id
    WHERE g.id = NEW.grn_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_vendor_capa
  AFTER UPDATE ON grn_items
  FOR EACH ROW
  EXECUTE FUNCTION create_vendor_capa_on_iqc_status();
