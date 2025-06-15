
-- Create a table to track IQC-related vendor CAPAs
CREATE TABLE public.iqc_vendor_capa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_item_id UUID NOT NULL REFERENCES grn_items(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  capa_status TEXT NOT NULL DEFAULT 'AWAITED' CHECK (capa_status IN ('AWAITED', 'RECEIVED', 'APPROVED', 'REJECTED')),
  capa_document_url TEXT,
  initiated_by UUID,
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  received_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX idx_iqc_vendor_capa_grn_item_id ON iqc_vendor_capa(grn_item_id);
CREATE INDEX idx_iqc_vendor_capa_vendor_id ON iqc_vendor_capa(vendor_id);
CREATE INDEX idx_iqc_vendor_capa_status ON iqc_vendor_capa(capa_status);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_iqc_vendor_capa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_iqc_vendor_capa_updated_at_trigger
  BEFORE UPDATE ON iqc_vendor_capa
  FOR EACH ROW
  EXECUTE FUNCTION update_iqc_vendor_capa_updated_at();

-- Enable RLS
ALTER TABLE public.iqc_vendor_capa ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for iqc_vendor_capa table
CREATE POLICY "Allow all operations on iqc_vendor_capa for authenticated users"
  ON public.iqc_vendor_capa
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
