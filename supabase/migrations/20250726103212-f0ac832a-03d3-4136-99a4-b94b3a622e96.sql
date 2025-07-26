-- Create import containers tracking system tables

-- Import containers master table
CREATE TABLE public.import_containers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  container_number TEXT NOT NULL UNIQUE,
  current_status TEXT NOT NULL DEFAULT 'ORDERED',
  ordered_date DATE,
  loading_date DATE,
  loaded_date DATE,
  china_custom_date DATE,
  shipped_date DATE,
  in_transit_date DATE,
  indian_dock_date DATE,
  in_train_date DATE,
  india_custom_date DATE,
  dispatched_date DATE,
  arrived_date DATE,
  supplier_info TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Container materials tracking what's inside each container
CREATE TABLE public.container_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  container_id UUID NOT NULL REFERENCES public.import_containers(id) ON DELETE CASCADE,
  brand TEXT,
  model TEXT NOT NULL,
  material_description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETE' CHECK (status IN ('COMPLETE', 'PARTIAL')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Container status history for audit trail
CREATE TABLE public.container_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  container_id UUID NOT NULL REFERENCES public.import_containers(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changed_by UUID,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.import_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_status_history ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Authenticated users can view containers" 
ON public.import_containers 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create containers" 
ON public.import_containers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update containers" 
ON public.import_containers 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete containers" 
ON public.import_containers 
FOR DELETE 
USING (true);

CREATE POLICY "Authenticated users can view container materials" 
ON public.container_materials 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create container materials" 
ON public.container_materials 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update container materials" 
ON public.container_materials 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete container materials" 
ON public.container_materials 
FOR DELETE 
USING (true);

CREATE POLICY "Authenticated users can view container status history" 
ON public.container_status_history 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create container status history" 
ON public.container_status_history 
FOR INSERT 
WITH CHECK (true);

-- Create trigger for updating timestamps
CREATE TRIGGER update_import_containers_updated_at
BEFORE UPDATE ON public.import_containers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_container_materials_updated_at
BEFORE UPDATE ON public.container_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_containers_status ON public.import_containers(current_status);
CREATE INDEX idx_containers_number ON public.import_containers(container_number);
CREATE INDEX idx_container_materials_container_id ON public.container_materials(container_id);
CREATE INDEX idx_container_materials_model ON public.container_materials(model);
CREATE INDEX idx_container_status_history_container_id ON public.container_status_history(container_id);