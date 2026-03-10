
-- 1. Create dash_product_specs
CREATE TABLE public.dash_product_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.dash_products(id) ON DELETE CASCADE,
  power_output text,
  frequency_response text,
  connectivity text[] DEFAULT '{}',
  dimensions_l numeric,
  dimensions_w numeric,
  dimensions_h numeric,
  weight_kg numeric,
  color_variants text[] DEFAULT '{}',
  box_contents text[] DEFAULT '{}',
  country_of_origin text DEFAULT 'India',
  custom_specs jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.dash_product_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage dash_product_specs"
  ON public.dash_product_specs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Create dash_product_qc_checklist
CREATE TABLE public.dash_product_qc_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.dash_products(id) ON DELETE CASCADE,
  parameter_name text NOT NULL,
  parameter_category text DEFAULT 'other',
  expected_value text,
  is_mandatory boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.dash_product_qc_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage dash_product_qc_checklist"
  ON public.dash_product_qc_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Create dash_product_spare_parts
CREATE TABLE public.dash_product_spare_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.dash_products(id) ON DELETE CASCADE,
  part_name text NOT NULL,
  part_number text UNIQUE NOT NULL,
  description text,
  unit_cost numeric DEFAULT 0,
  selling_price numeric DEFAULT 0,
  current_stock int DEFAULT 0,
  reorder_level int DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.dash_product_spare_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage dash_product_spare_parts"
  ON public.dash_product_spare_parts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Alter dash_product_compliance - add new columns
ALTER TABLE public.dash_product_compliance
  ADD COLUMN IF NOT EXISTS rating_label_location_product text,
  ADD COLUMN IF NOT EXISTS rating_label_location_box text,
  ADD COLUMN IF NOT EXISTS mrp_label_location_box text,
  ADD COLUMN IF NOT EXISTS brand_logo_location text,
  ADD COLUMN IF NOT EXISTS other_certifications jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compliance_notes text;

-- 5. Alter dash_product_documents - add new columns
ALTER TABLE public.dash_product_documents
  ADD COLUMN IF NOT EXISTS doc_name text,
  ADD COLUMN IF NOT EXISTS doc_type text;

-- 6. Create dash-product-docs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('dash-product-docs', 'dash-product-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for dash-product-docs
CREATE POLICY "Authenticated users can upload to dash-product-docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dash-product-docs');

CREATE POLICY "Anyone can read dash-product-docs"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'dash-product-docs');

CREATE POLICY "Authenticated users can update dash-product-docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dash-product-docs');

CREATE POLICY "Authenticated users can delete dash-product-docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dash-product-docs');

-- Updated_at trigger for specs
CREATE OR REPLACE FUNCTION public.update_dash_product_specs_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_dash_product_specs_updated_at
  BEFORE UPDATE ON public.dash_product_specs
  FOR EACH ROW EXECUTE FUNCTION public.update_dash_product_specs_updated_at();

-- Updated_at trigger for spare parts
CREATE TRIGGER update_dash_product_spare_parts_updated_at
  BEFORE UPDATE ON public.dash_product_spare_parts
  FOR EACH ROW EXECUTE FUNCTION public.update_dash_product_specs_updated_at();
