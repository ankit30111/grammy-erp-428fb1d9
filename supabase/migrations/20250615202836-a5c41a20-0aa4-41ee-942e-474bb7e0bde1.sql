
-- Create NPD projects table for New Product Development
CREATE TABLE public.npd_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  requirements TEXT,
  status TEXT NOT NULL DEFAULT 'CONCEPT' CHECK (status IN ('CONCEPT', 'PROTOTYPE', 'TESTING', 'APPROVED')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  estimated_completion_date DATE,
  priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  project_description TEXT
);

-- Create pre-existing projects table for product customization
CREATE TABLE public.pre_existing_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  base_product_id UUID REFERENCES public.products(id),
  customization_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CUSTOMIZATION' CHECK (status IN ('CUSTOMIZATION', 'CUSTOMER_APPROVAL', 'FINALIZED')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  estimated_completion_date DATE,
  priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  customization_details TEXT,
  brand_requirements TEXT
);

-- Add RLS policies for NPD projects
ALTER TABLE public.npd_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.npd_projects
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.npd_projects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.npd_projects
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.npd_projects
FOR DELETE USING (auth.role() = 'authenticated');

-- Add RLS policies for pre-existing projects
ALTER TABLE public.pre_existing_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.pre_existing_projects
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.pre_existing_projects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.pre_existing_projects
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.pre_existing_projects
FOR DELETE USING (auth.role() = 'authenticated');

-- Create update triggers for both tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_npd_projects_updated_at 
    BEFORE UPDATE ON public.npd_projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pre_existing_projects_updated_at 
    BEFORE UPDATE ON public.pre_existing_projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
