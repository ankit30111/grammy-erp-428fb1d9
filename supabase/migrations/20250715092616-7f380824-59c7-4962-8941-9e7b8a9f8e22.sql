-- Enhanced NPD BOM Lifecycle System Database Schema

-- Add BOM stage tracking to npd_project_bom table
ALTER TABLE npd_project_bom ADD COLUMN IF NOT EXISTS bom_stage TEXT DEFAULT 'TEST_BOM' CHECK (bom_stage IN ('TEST_BOM', 'SAMPLING_STAGE', 'TESTING_STAGE', 'PP_STAGE', 'MP_STAGE'));
ALTER TABLE npd_project_bom ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE npd_project_bom ADD COLUMN IF NOT EXISTS stage_updated_by UUID;

-- Enhance npd_bom_materials table for temporary parts and sample tracking
ALTER TABLE npd_bom_materials ADD COLUMN IF NOT EXISTS is_temporary_part BOOLEAN DEFAULT false;
ALTER TABLE npd_bom_materials ADD COLUMN IF NOT EXISTS temporary_part_code TEXT;
ALTER TABLE npd_bom_materials ADD COLUMN IF NOT EXISTS part_type TEXT DEFAULT 'EXISTING' CHECK (part_type IN ('EXISTING', 'NEW_UNCODED'));
ALTER TABLE npd_bom_materials ADD COLUMN IF NOT EXISTS expected_function TEXT;
ALTER TABLE npd_bom_materials ADD COLUMN IF NOT EXISTS reference_drawings_url TEXT;
ALTER TABLE npd_bom_materials ADD COLUMN IF NOT EXISTS sample_target_date DATE;
ALTER TABLE npd_bom_materials ADD COLUMN IF NOT EXISTS part_status TEXT DEFAULT 'UNDER_DEVELOPMENT' CHECK (part_status IN ('UNDER_DEVELOPMENT', 'SAMPLE_SENT', 'SAMPLE_RECEIVED', 'SAMPLE_APPROVED', 'SAMPLE_REJECTED', 'FINALIZED_AND_CODED'));
ALTER TABLE npd_bom_materials ADD COLUMN IF NOT EXISTS final_part_code TEXT;
ALTER TABLE npd_bom_materials ADD COLUMN IF NOT EXISTS avl_generated BOOLEAN DEFAULT false;
ALTER TABLE npd_bom_materials ADD COLUMN IF NOT EXISTS iqc_checklist_generated BOOLEAN DEFAULT false;

-- Create sample tracking table
CREATE TABLE IF NOT EXISTS npd_sample_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npd_bom_material_id UUID NOT NULL REFERENCES npd_bom_materials(id) ON DELETE CASCADE,
  sample_request_date DATE DEFAULT CURRENT_DATE,
  sample_sent_date DATE,
  sample_received_date DATE,
  sample_approval_date DATE,
  sample_rejection_date DATE,
  rejection_reason TEXT,
  approval_notes TEXT,
  vendor_response_time INTEGER, -- days
  quality_notes TEXT,
  test_report_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Create BOM stage history table
CREATE TABLE IF NOT EXISTS npd_bom_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npd_project_bom_id UUID NOT NULL REFERENCES npd_project_bom(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  transition_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  transition_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create temporary part code generation function
CREATE OR REPLACE FUNCTION generate_temp_part_code(part_category TEXT)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  next_number INTEGER;
  temp_code TEXT;
BEGIN
  -- Determine prefix based on category
  CASE LOWER(part_category)
    WHEN 'ic', 'integrated_circuit' THEN prefix := 'TEMP-IC';
    WHEN 'pcb', 'circuit_board' THEN prefix := 'TEMP-PCB';
    WHEN 'resistor' THEN prefix := 'TEMP-R';
    WHEN 'capacitor' THEN prefix := 'TEMP-C';
    WHEN 'connector' THEN prefix := 'TEMP-CN';
    WHEN 'mechanical' THEN prefix := 'TEMP-MEC';
    WHEN 'packaging' THEN prefix := 'TEMP-PKG';
    ELSE prefix := 'TEMP-GEN';
  END CASE;
  
  -- Get the next number for this prefix
  SELECT COALESCE(MAX(CAST(SUBSTRING(temporary_part_code FROM prefix || '-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM npd_bom_materials
  WHERE temporary_part_code LIKE prefix || '-%';
  
  -- Generate the code
  temp_code := prefix || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN temp_code;
END;
$$ LANGUAGE plpgsql;

-- Create BOM comments table for multi-department collaboration
CREATE TABLE IF NOT EXISTS npd_bom_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npd_bom_material_id UUID NOT NULL REFERENCES npd_bom_materials(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  comment_type TEXT DEFAULT 'GENERAL' CHECK (comment_type IN ('GENERAL', 'RND_NOTE', 'IQC_FEEDBACK', 'PURCHASE_NOTE', 'VENDOR_COMMUNICATION')),
  department TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_npd_sample_tracking_material_id ON npd_sample_tracking(npd_bom_material_id);
CREATE INDEX IF NOT EXISTS idx_npd_bom_stage_history_bom_id ON npd_bom_stage_history(npd_project_bom_id);
CREATE INDEX IF NOT EXISTS idx_npd_bom_comments_material_id ON npd_bom_comments(npd_bom_material_id);
CREATE INDEX IF NOT EXISTS idx_npd_bom_materials_part_status ON npd_bom_materials(part_status);
CREATE INDEX IF NOT EXISTS idx_npd_bom_materials_temporary ON npd_bom_materials(is_temporary_part);

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_npd_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_npd_sample_tracking_updated_at
  BEFORE UPDATE ON npd_sample_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_npd_updated_at_column();

CREATE TRIGGER update_npd_bom_comments_updated_at
  BEFORE UPDATE ON npd_bom_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_npd_updated_at_column();

-- Create RLS policies
ALTER TABLE npd_sample_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_bom_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_bom_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for npd_sample_tracking" ON npd_sample_tracking FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for npd_bom_stage_history" ON npd_bom_stage_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for npd_bom_comments" ON npd_bom_comments FOR ALL USING (true) WITH CHECK (true);