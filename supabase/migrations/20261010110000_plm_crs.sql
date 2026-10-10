-- CRS (Customer Requirement & Specification, GA/QMS/RND/DOC/044) per R&D product.
-- One row per field the product has a value for; Field IDs are the template's
-- permanent ids (CRS-AUD-002 ...). Which category sheet it uses is plm_crs.crs_type.

CREATE TABLE IF NOT EXISTS public.plm_crs (
  product_id uuid PRIMARY KEY REFERENCES public.plm_products(id) ON DELETE CASCADE,
  crs_type text NOT NULL CHECK (crs_type IN ('Party Speaker', 'Soundbar', 'Microphone', 'BT Speaker', 'Tower Speaker', 'Trolley Speaker')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.plm_crs_values (
  product_id uuid NOT NULL REFERENCES public.plm_products(id) ON DELETE CASCADE,
  field_id text NOT NULL CHECK (field_id ~ '^CRS-[A-Z]+-[0-9]{3}$'),
  value text,
  remarks text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (product_id, field_id)
);

CREATE OR REPLACE FUNCTION public.plm_crs_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_plm_crs_touch ON public.plm_crs;
CREATE TRIGGER trg_plm_crs_touch BEFORE UPDATE ON public.plm_crs FOR EACH ROW EXECUTE FUNCTION public.plm_crs_touch();
DROP TRIGGER IF EXISTS trg_plm_crs_values_touch ON public.plm_crs_values;
CREATE TRIGGER trg_plm_crs_values_touch BEFORE UPDATE ON public.plm_crs_values FOR EACH ROW EXECUTE FUNCTION public.plm_crs_touch();

ALTER TABLE public.plm_crs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plm_crs_values ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plm_crs', 'plm_crs_values'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role())', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_edit_plm()) WITH CHECK (public.can_edit_plm())', t || '_write', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plm_crs, public.plm_crs_values TO authenticated;
