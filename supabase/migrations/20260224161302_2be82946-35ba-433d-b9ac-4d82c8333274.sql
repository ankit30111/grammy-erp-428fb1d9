
-- 1. Add new enum values
ALTER TYPE public.dash_product_status ADD VALUE IF NOT EXISTS 'Development';
ALTER TYPE public.dash_product_status ADD VALUE IF NOT EXISTS 'Ready for Production';
ALTER TYPE public.dash_product_category ADD VALUE IF NOT EXISTS 'Accessories';
ALTER TYPE public.dash_product_category ADD VALUE IF NOT EXISTS 'Portable Speaker';

-- 2. Alter dash_products table with new columns
ALTER TABLE public.dash_products
  ADD COLUMN IF NOT EXISTS hsn_code text,
  ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_percent numeric DEFAULT 18,
  ADD COLUMN IF NOT EXISTS nlc numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dp numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS serial_prefix text,
  ADD COLUMN IF NOT EXISTS serial_next_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS gross_weight numeric,
  ADD COLUMN IF NOT EXISTS net_weight numeric,
  ADD COLUMN IF NOT EXISTS software_button_details text,
  ADD COLUMN IF NOT EXISTS branding_info text,
  ADD COLUMN IF NOT EXISTS qa_checklist jsonb,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS updated_by text;

-- 3. Create dash_product_documents table
CREATE TABLE IF NOT EXISTS public.dash_product_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.dash_products(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create dash_product_spares junction table
CREATE TABLE IF NOT EXISTS public.dash_product_spares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.dash_products(id) ON DELETE CASCADE,
  spare_id uuid NOT NULL REFERENCES public.dash_spare_parts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, spare_id)
);

-- 5. Create dash_product_compliance table
CREATE TABLE IF NOT EXISTS public.dash_product_compliance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.dash_products(id) ON DELETE CASCADE,
  bis_certificate_number text,
  bis_expiry_date date,
  compliance_status text NOT NULL DEFAULT 'Pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Enable RLS on new tables
ALTER TABLE public.dash_product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dash_product_spares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dash_product_compliance ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for dash_product_documents
CREATE POLICY "Authenticated users can view dash product documents" ON public.dash_product_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dash product documents" ON public.dash_product_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dash product documents" ON public.dash_product_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete dash product documents" ON public.dash_product_documents FOR DELETE TO authenticated USING (true);

-- 8. RLS policies for dash_product_spares
CREATE POLICY "Authenticated users can view dash product spares" ON public.dash_product_spares FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dash product spares" ON public.dash_product_spares FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete dash product spares" ON public.dash_product_spares FOR DELETE TO authenticated USING (true);

-- 9. RLS policies for dash_product_compliance
CREATE POLICY "Authenticated users can view dash product compliance" ON public.dash_product_compliance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dash product compliance" ON public.dash_product_compliance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dash product compliance" ON public.dash_product_compliance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 10. Trigger function for NLC/DP auto-calculation
CREATE OR REPLACE FUNCTION public.calculate_dash_product_pricing()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
BEGIN
  -- NLC = (purchase_price * 1.10) * (1 + gst_percent/100)
  NEW.nlc := ROUND((COALESCE(NEW.purchase_price, 0) * 1.10) * (1 + COALESCE(NEW.gst_percent, 18) / 100.0), 2);
  -- DP = (NLC * 1.10) * (1 + gst_percent/100)
  NEW.dp := ROUND((NEW.nlc * 1.10) * (1 + COALESCE(NEW.gst_percent, 18) / 100.0), 2);
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_calculate_dash_product_pricing
  BEFORE INSERT OR UPDATE OF purchase_price, gst_percent ON public.dash_products
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_dash_product_pricing();

-- 11. Updated_at trigger for compliance
CREATE TRIGGER trg_dash_product_compliance_updated_at
  BEFORE UPDATE ON public.dash_product_compliance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
