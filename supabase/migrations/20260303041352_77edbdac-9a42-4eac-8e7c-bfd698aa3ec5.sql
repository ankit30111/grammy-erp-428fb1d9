
-- Add new columns to dash_customers
ALTER TABLE public.dash_customers
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS primary_address text,
  ADD COLUMN IF NOT EXISTS godown_address text,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS msme_certificate_url text,
  ADD COLUMN IF NOT EXISTS msme_number text,
  ADD COLUMN IF NOT EXISTS cancelled_cheque_url text,
  ADD COLUMN IF NOT EXISTS gst_certificate_url text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS salesman_name text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS updated_by text;

-- Create dash_customer_documents table
CREATE TABLE IF NOT EXISTS public.dash_customer_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.dash_customers(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dash_customer_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for dash_customer_documents
CREATE POLICY "Authenticated users can view customer documents"
  ON public.dash_customer_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert customer documents"
  ON public.dash_customer_documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update customer documents"
  ON public.dash_customer_documents FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete customer documents"
  ON public.dash_customer_documents FOR DELETE TO authenticated USING (true);
