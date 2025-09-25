-- Phase 1: Add sourcing and pricing fields to raw_materials table
ALTER TABLE public.raw_materials 
ADD COLUMN sourcing_type TEXT CHECK (sourcing_type IN ('IMPORTED', 'LOCAL')) DEFAULT 'LOCAL',
ADD COLUMN currency TEXT CHECK (currency IN ('USD', 'RMB', 'INR')),
ADD COLUMN unit_price DECIMAL(10,2),
ADD COLUMN cbm_per_unit DECIMAL(8,4),
ADD COLUMN supplier_country TEXT,
ADD COLUMN last_price_update TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create container_cost_breakdown table
CREATE TABLE public.container_cost_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES public.import_containers(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('FREIGHT', 'CUSTOMS', 'HANDLING', 'DOCUMENTATION', 'INSURANCE', 'OTHER')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'RMB', 'INR')) DEFAULT 'USD',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on container_cost_breakdown
ALTER TABLE public.container_cost_breakdown ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for container_cost_breakdown
CREATE POLICY "Authenticated users can view container costs" 
ON public.container_cost_breakdown FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create container costs" 
ON public.container_cost_breakdown FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update container costs" 
ON public.container_cost_breakdown FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete container costs" 
ON public.container_cost_breakdown FOR DELETE 
USING (true);

-- Enhance container_materials table
ALTER TABLE public.container_materials 
ADD COLUMN raw_material_id UUID REFERENCES public.raw_materials(id),
ADD COLUMN cbm_occupied DECIMAL(8,4),
ADD COLUMN unit_cost_allocation DECIMAL(10,2);

-- Create trigger for updated_at on container_cost_breakdown
CREATE TRIGGER update_container_cost_breakdown_updated_at
  BEFORE UPDATE ON public.container_cost_breakdown
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_container_cost_breakdown_container_id ON public.container_cost_breakdown(container_id);
CREATE INDEX idx_container_materials_raw_material_id ON public.container_materials(raw_material_id);
CREATE INDEX idx_raw_materials_sourcing_type ON public.raw_materials(sourcing_type);