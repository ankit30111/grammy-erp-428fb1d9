
-- Create table for NPD project benchmarks
CREATE TABLE public.npd_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  npd_project_id UUID NOT NULL REFERENCES npd_projects(id) ON DELETE CASCADE,
  benchmark_title TEXT NOT NULL,
  target_value TEXT,
  measurement_unit TEXT,
  description TEXT,
  priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'ACHIEVED', 'MISSED')),
  target_date DATE,
  achieved_date DATE,
  actual_value TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create table for NPD project-specific BOMs
CREATE TABLE public.npd_project_bom (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  npd_project_id UUID NOT NULL REFERENCES npd_projects(id) ON DELETE CASCADE,
  bom_name TEXT NOT NULL DEFAULT 'Project BOM',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED', 'SUPERSEDED')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Create table for individual BOM materials in NPD projects
CREATE TABLE public.npd_bom_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  npd_project_bom_id UUID NOT NULL REFERENCES npd_project_bom(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  material_code TEXT,
  description TEXT,
  specifications TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'PCS',
  material_status TEXT DEFAULT 'UNDER_DEVELOPMENT' CHECK (material_status IN ('UNDER_DEVELOPMENT', 'SAMPLE_RECEIVED', 'FINALISED')),
  vendor_name TEXT,
  vendor_contact TEXT,
  expected_due_date DATE,
  specification_sheet_url TEXT,
  notes TEXT,
  is_critical BOOLEAN DEFAULT false,
  alternative_options TEXT,
  cost_estimate DECIMAL(10,2),
  lead_time_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  last_updated_by UUID
);

-- Create storage bucket for NPD specification sheets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'npd-specifications',
  'npd-specifications',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
);

-- Create storage policies for NPD specifications
CREATE POLICY "Allow authenticated users to upload NPD specifications" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'npd-specifications' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to view NPD specifications" ON storage.objects
FOR SELECT USING (
  bucket_id = 'npd-specifications' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to update NPD specifications" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'npd-specifications' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to delete NPD specifications" ON storage.objects
FOR DELETE USING (
  bucket_id = 'npd-specifications' AND
  auth.role() = 'authenticated'
);

-- Add indexes for better performance
CREATE INDEX idx_npd_benchmarks_project_id ON npd_benchmarks(npd_project_id);
CREATE INDEX idx_npd_project_bom_project_id ON npd_project_bom(npd_project_id);
CREATE INDEX idx_npd_bom_materials_bom_id ON npd_bom_materials(npd_project_bom_id);
CREATE INDEX idx_npd_bom_materials_status ON npd_bom_materials(material_status);

-- Add updated_at triggers
CREATE TRIGGER update_npd_benchmarks_updated_at
    BEFORE UPDATE ON npd_benchmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_npd_project_bom_updated_at
    BEFORE UPDATE ON npd_project_bom
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_npd_bom_materials_updated_at
    BEFORE UPDATE ON npd_bom_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
