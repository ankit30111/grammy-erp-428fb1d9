
-- Create vendor_capa table for tracking vendor CAPA documents (fixed)
CREATE TABLE IF NOT EXISTS public.vendor_capa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  line_rejection_id UUID REFERENCES public.line_rejections(id),
  vendor_id UUID REFERENCES public.vendors(id) NOT NULL,
  capa_file_url TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  initiated_by UUID,
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  implementation_status TEXT DEFAULT 'PENDING',
  implementation_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create approval_workflows table for general approval processes
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  submitted_by UUID,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  comments TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add approval workflow columns to existing tables
ALTER TABLE public.rca_reports ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.rca_reports ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE public.rca_reports ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.rca_reports ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add CAPA status columns to grn_items for segregated/failed lots
ALTER TABLE public.grn_items ADD COLUMN IF NOT EXISTS vendor_capa_required BOOLEAN DEFAULT false;
ALTER TABLE public.grn_items ADD COLUMN IF NOT EXISTS vendor_capa_status TEXT DEFAULT 'NOT_REQUIRED';
ALTER TABLE public.grn_items ADD COLUMN IF NOT EXISTS vendor_capa_file_url TEXT;

-- Add RLS policies
ALTER TABLE public.vendor_capa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

-- Create policies for vendor_capa table
CREATE POLICY "Enable read access for all users" ON public.vendor_capa FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.vendor_capa FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.vendor_capa FOR UPDATE USING (true);

-- Create policies for approval_workflows table
CREATE POLICY "Enable read access for all users" ON public.approval_workflows FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.approval_workflows FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.approval_workflows FOR UPDATE USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vendor_capa_line_rejection ON public.vendor_capa(line_rejection_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_reference ON public.approval_workflows(reference_id, workflow_type);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_status ON public.approval_workflows(status);
