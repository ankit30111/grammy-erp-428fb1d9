-- Four functions the app calls that were never created.
--
-- Every supabase.rpc() call to a function that does not exist throws
-- PGRST202 the moment the screen is opened. Three of these four had the error
-- swallowed, so the symptom was a blank field or a missing log line rather than
-- an error anyone could act on:
--
--   get_vendor_finance      Vendor edit dialog - bank details always blank
--   get_customer_finance    Customer edit dialog - same, and explicitly logged as
--                           "not authorized", which pointed at permissions rather
--                           than at a function that was not there
--   generate_temp_part_code R&D part selection - creating a temporary part failed
--   log_material_movement   Material requests - every request went unlogged
--
-- The first two were designed correctly: bank account number and IFSC are not in
-- the app's ordinary select list, and are fetched on demand through a
-- SECURITY DEFINER function that checks for admin. Only the function itself was
-- missing, so that is what this adds - the design is kept.

-- ---------------------------------------------------------------------------
-- Admin-only finance fields.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vendor_finance(p_vendor_id uuid)
RETURNS TABLE (
  id                     uuid,
  bank_account_number    text,
  ifsc_code              text,
  gst_certificate_url    text,
  msme_certificate_url   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 42501 is what the caller already expects and handles.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can view vendor bank details'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT v.id, v.bank_account_number, v.ifsc_code,
         v.gst_certificate_url, v.msme_certificate_url
    FROM public.vendors v
   WHERE v.id = p_vendor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_finance(p_customer_id uuid)
RETURNS TABLE (
  id                       uuid,
  bank_account_number      text,
  ifsc_code                text,
  gst_certificate_url      text,
  msme_certificate_url     text,
  brand_authorization_url  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can view customer bank details'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.bank_account_number, c.ifsc_code,
         c.gst_certificate_url, c.msme_certificate_url, c.brand_authorization_url
    FROM public.customers c
   WHERE c.id = p_customer_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Temporary part codes for R&D.
-- ---------------------------------------------------------------------------
-- A temporary code is minted while a part is still being developed and has no
-- real code yet. It uses a sequence rather than max()+1: two people opening the
-- dialog at the same time would otherwise both read the same maximum and mint the
-- same code. Gaps are fine; duplicates are not.
CREATE SEQUENCE IF NOT EXISTS public.temp_part_code_seq;

CREATE OR REPLACE FUNCTION public.generate_temp_part_code(part_category text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prefix text;
BEGIN
  IF NOT public.has_role('rnd') THEN
    RAISE EXCEPTION 'Not permitted to create temporary part codes';
  END IF;

  -- First three letters of the category, so a temporary code still says roughly
  -- what it is. TMP alone tells a buyer nothing.
  v_prefix := upper(coalesce(nullif(regexp_replace(coalesce(part_category, ''), '[^A-Za-z]', '', 'g'), ''), 'GEN'));
  v_prefix := left(v_prefix, 3);

  RETURN format('T-%s-%s', v_prefix,
                lpad(nextval('public.temp_part_code_seq')::text, 5, '0'));
END;
$$;

-- ---------------------------------------------------------------------------
-- Material movement log.
-- ---------------------------------------------------------------------------
-- The material-request screens call this to record that a request was raised.
-- It is a note in the logbook, not a stock movement: raising a request moves
-- nothing, and post_stock_movement remains the single entry point for anything
-- that does change a balance. Writing a zero-delta ledger row here instead would
-- put non-movements in the stock ledger and make the ledger impossible to trust.
CREATE TABLE IF NOT EXISTS public.material_movement_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id          uuid NOT NULL REFERENCES public.parts(id),
  movement_type    text NOT NULL,
  quantity         numeric,
  reference_id     uuid,
  reference_type   text,
  reference_number text,
  notes            text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS material_movement_log_part_idx
  ON public.material_movement_log (part_id, created_at DESC);
CREATE INDEX IF NOT EXISTS material_movement_log_ref_idx
  ON public.material_movement_log (reference_type, reference_id);

ALTER TABLE public.material_movement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_movement_log_read ON public.material_movement_log
  FOR SELECT TO authenticated USING (public.has_role(NULL));

CREATE OR REPLACE FUNCTION public.log_material_movement(
  p_raw_material_id  uuid,
  p_movement_type    text,
  p_quantity         numeric DEFAULT NULL,
  p_reference_id     uuid    DEFAULT NULL,
  p_reference_type   text    DEFAULT NULL,
  p_reference_number text    DEFAULT NULL,
  p_notes            text    DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(NULL) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  INSERT INTO public.material_movement_log (
    part_id, movement_type, quantity, reference_id, reference_type,
    reference_number, notes, created_by
  ) VALUES (
    p_raw_material_id, p_movement_type, p_quantity, p_reference_id, p_reference_type,
    p_reference_number, p_notes, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_finance(uuid)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_customer_finance(uuid)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_temp_part_code(text)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_material_movement(uuid, text, numeric, uuid, text, text, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_vendor_finance(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_finance(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_temp_part_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_material_movement(uuid, text, numeric, uuid, text, text, text)
  TO authenticated;
