-- A customer's brands come from the brands master (PH PHILIPS, AI AIWA ...),
-- the same two-letter table used by brand codes (JA-006-PH), part branding and
-- brand BOM lines. The free-text customers.brand_name is no longer typed: it is
-- kept as a read-only list of the linked brand names, so screens that show it
-- (complaints) keep working.

CREATE TABLE IF NOT EXISTS public.customer_brands (
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  brand text NOT NULL REFERENCES public.brands(letter) ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (customer_id, brand)
);
COMMENT ON TABLE public.customer_brands IS
  '[Masters] Brands a customer buys (customer x brand from the brands master). customers.brand_name is kept from this.';
CREATE INDEX IF NOT EXISTS customer_brands_brand_idx ON public.customer_brands (brand);

ALTER TABLE public.customer_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_brands_read ON public.customer_brands;
CREATE POLICY customer_brands_read ON public.customer_brands FOR SELECT TO authenticated USING (public.has_role(NULL));
DROP POLICY IF EXISTS customer_brands_insert ON public.customer_brands;
CREATE POLICY customer_brands_insert ON public.customer_brands FOR INSERT TO authenticated WITH CHECK (public.can_edit_customers());
DROP POLICY IF EXISTS customer_brands_delete ON public.customer_brands;
CREATE POLICY customer_brands_delete ON public.customer_brands FOR DELETE TO authenticated USING (public.can_edit_customers());
GRANT SELECT, INSERT, DELETE ON public.customer_brands TO authenticated;

-- customers.brand_name = the linked brands' names, in name order.
CREATE OR REPLACE FUNCTION public.customer_brand_names_refresh(p_customer uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  SELECT string_agg(b.name, ', ' ORDER BY b.name) INTO v
    FROM public.customer_brands cb JOIN public.brands b ON b.letter = cb.brand
   WHERE cb.customer_id = p_customer;
  -- A derived column, not an edit someone made: the approval guard keeps the
  -- record's approval as it is.
  PERFORM set_config('app.approving', 'on', true);
  UPDATE public.customers SET brand_name = v WHERE id = p_customer AND brand_name IS DISTINCT FROM v;
  PERFORM set_config('app.approving', 'off', true);
END $$;

CREATE OR REPLACE FUNCTION public.trg_customer_brands_names()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.customer_brand_names_refresh(coalesce(NEW.customer_id, OLD.customer_id));
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_customer_brands_names ON public.customer_brands;
CREATE TRIGGER trg_customer_brands_names AFTER INSERT OR DELETE ON public.customer_brands
  FOR EACH ROW EXECUTE FUNCTION public.trg_customer_brands_names();

-- Renaming a brand renames it on its customers.
CREATE OR REPLACE FUNCTION public.trg_brand_rename_customers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c uuid;
BEGIN
  FOR c IN SELECT customer_id FROM public.customer_brands WHERE brand = NEW.letter LOOP
    PERFORM public.customer_brand_names_refresh(c);
  END LOOP;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_brand_rename_customers ON public.brands;
CREATE TRIGGER trg_brand_rename_customers AFTER UPDATE OF name ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.trg_brand_rename_customers();

-- Set a customer's brands in one step (the edit form sends the full list).
CREATE OR REPLACE FUNCTION public.customer_set_brands(p_customer uuid, p_brands text[])
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bad text;
BEGIN
  IF NOT public.can_edit_customers() THEN
    RAISE EXCEPTION 'Only Management or Admin can change a customer''s brands' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
  SELECT x INTO v_bad FROM unnest(coalesce(p_brands, '{}')) x
   WHERE NOT EXISTS (SELECT 1 FROM public.brands b WHERE b.letter = x AND b.is_active) LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Brand % is not in the brands list', v_bad;
  END IF;
  DELETE FROM public.customer_brands WHERE customer_id = p_customer AND NOT (brand = ANY (coalesce(p_brands, '{}')));
  INSERT INTO public.customer_brands (customer_id, brand)
  SELECT p_customer, x FROM (SELECT DISTINCT unnest(coalesce(p_brands, '{}')) x) s
  ON CONFLICT DO NOTHING;
  PERFORM public.customer_brand_names_refresh(p_customer);
  RETURN ARRAY(SELECT brand FROM public.customer_brands WHERE customer_id = p_customer ORDER BY brand);
END $$;
REVOKE ALL ON FUNCTION public.customer_set_brands(uuid, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.customer_set_brands(uuid, text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.customer_brand_names_refresh(uuid) FROM public, anon, authenticated;

-- Link what was typed before: a brand_name that is a brand in the master.
INSERT INTO public.customer_brands (customer_id, brand)
SELECT c.id, b.letter
  FROM public.customers c
  JOIN LATERAL unnest(string_to_array(c.brand_name, ',')) t(nm) ON true
  JOIN public.brands b ON upper(btrim(b.name)) = upper(btrim(t.nm))
ON CONFLICT DO NOTHING;

DO $$
DECLARE r record; n int;
BEGIN
  FOR r IN SELECT id FROM public.customers LOOP PERFORM public.customer_brand_names_refresh(r.id); END LOOP;
  SELECT count(*) INTO n FROM public.customers c
   WHERE c.brand_name IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customer_brands cb WHERE cb.customer_id = c.id);
  IF n > 0 THEN RAISE EXCEPTION 'customer brand names not matched to the brands master: %', n; END IF;
END $$;
