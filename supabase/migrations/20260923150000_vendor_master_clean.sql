-- The vendor master, made fully editable from the ERP.
--
-- The first import parked everything the vendor table had no column for in a
-- `details` jsonb: second emails, further contacts, bank name, PAN, what the
-- vendor supplies. Nothing on screen could show or edit it, so it would have
-- gone stale the day the team started editing vendors in the ERP. Every value
-- now has a column or a row the Vendors screen edits, and `details` is dropped.
--
-- Also fixed here, because each would have made a mess once the team took over:
--   * a vendor created from the screen was inserted with vendor_code '' - the
--     first one saved, every one after it failed on the unique key;
--   * GST was required by the form, so the 40 vendors without one could not be
--     edited at all;
--   * every signed-in user could read bank account numbers (the table grant
--     covered all columns, so the "admin only" note in the code was not true).

-- ---------------------------------------------------------------------------
-- Columns for what was in `details`
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS supplies            text,
  ADD COLUMN IF NOT EXISTS location            text,
  ADD COLUMN IF NOT EXISTS contact_designation text,
  ADD COLUMN IF NOT EXISTS pan_number          text,
  ADD COLUMN IF NOT EXISTS bank_name           text,
  ADD COLUMN IF NOT EXISTS account_holder_name text;

COMMENT ON COLUMN public.vendors.email IS
  'Main email. Quality claims (CAPA) are sent here.';
COMMENT ON COLUMN public.vendors.supplies IS 'What the vendor supplies, as on the approved supplier list.';
COMMENT ON COLUMN public.vendors.location IS 'Area / city, for the list. The full address is in address.';

-- Everyone at the vendor beyond the main contact on the vendor row.
CREATE TABLE IF NOT EXISTS public.vendor_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name        text,
  designation text,
  phone       text,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_contacts_something CHECK (coalesce(name, phone, email) IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS vendor_contacts_vendor ON public.vendor_contacts (vendor_id);

ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_contacts_read ON public.vendor_contacts;
CREATE POLICY vendor_contacts_read ON public.vendor_contacts FOR SELECT USING (public.has_role(NULL::text));
DROP POLICY IF EXISTS vendor_contacts_write ON public.vendor_contacts;
CREATE POLICY vendor_contacts_write ON public.vendor_contacts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_contacts TO authenticated;

-- ---------------------------------------------------------------------------
-- Move `details` into them, then drop it
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'details') THEN
    UPDATE public.vendors SET
      supplies            = coalesce(supplies,            nullif(btrim(details->>'product'), '')),
      location            = coalesce(location,            nullif(btrim(details->>'area'), '')),
      contact_designation = coalesce(contact_designation, nullif(btrim(details->>'contact_designation'), '')),
      pan_number          = coalesce(pan_number,          nullif(upper(btrim(details->>'pan')), '')),
      bank_name           = coalesce(bank_name,           nullif(btrim(details->>'bank_name'), '')),
      account_holder_name = coalesce(account_holder_name, nullif(btrim(details->>'account_holder'), ''));

    INSERT INTO public.vendor_contacts (vendor_id, name, designation, phone)
    SELECT v.id, nullif(btrim(c->>'name'), ''), nullif(btrim(c->>'designation'), ''), nullif(btrim(c->>'phone'), '')
      FROM public.vendors v, jsonb_array_elements(coalesce(v.details->'contacts', '[]'::jsonb)) c;

    -- Further emails become contacts of their own: an address with no name is
    -- still somebody to write to, and the screen edits it like any other.
    INSERT INTO public.vendor_contacts (vendor_id, email)
    SELECT v.id, btrim(e)
      FROM public.vendors v, jsonb_array_elements_text(coalesce(v.details->'emails', '[]'::jsonb)) e
     WHERE btrim(e) <> '';

    ALTER TABLE public.vendors DROP COLUMN details;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Vendor code issued by the database when the screen leaves it blank
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendors_issue_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.vendor_code := upper(btrim(coalesce(NEW.vendor_code, '')));
  IF NEW.vendor_code = '' THEN
    -- Serialised so two people adding a vendor at once cannot both get V-105.
    PERFORM pg_advisory_xact_lock(hashtext('vendors.vendor_code'));
    SELECT 'V-' || lpad((coalesce(max((regexp_match(vendor_code, '^V-(\d+)$'))[1]::int), 0) + 1)::text, 3, '0')
      INTO NEW.vendor_code
      FROM public.vendors;
  END IF;
  -- One spelling of an empty GST number: none.
  NEW.gst_number := nullif(upper(btrim(coalesce(NEW.gst_number, ''))), '');
  NEW.pan_number := nullif(upper(btrim(coalesce(NEW.pan_number, ''))), '');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vendors_issue_code ON public.vendors;
CREATE TRIGGER trg_vendors_issue_code
  BEFORE INSERT OR UPDATE OF vendor_code, gst_number, pan_number ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.vendors_issue_code();

-- ---------------------------------------------------------------------------
-- Data corrections agreed with Ankit, 23 Sep 2026
-- ---------------------------------------------------------------------------
-- Buttons India and Moon Light Industries carried the same GSTIN. Its PAN
-- (CHAPS6254D) is an individual's whose surname starts with S; Moon Light's
-- owner is Manohar Lal Sharma, Buttons India's is Ahuja. The number stays with
-- Moon Light and Buttons India's is left blank until the team enters it.
UPDATE public.vendors SET gst_number = NULL
 WHERE vendor_code = 'V-022' AND gst_number = '07CHAPS6254D1ZD';

-- Vats Industries and Wood View India were one row: same family, two firms,
-- two GSTINs, two addresses. V-044 stays Vats Industries (UP) and keeps the
-- parts the part list names Vats against; Wood View India (Delhi) gets its own.
UPDATE public.vendors SET
  name     = 'VATS INDUSTRIES',
  address  = 'PLOT NO. C75, INDUSTRIAL AREA, SECTOR B-3, TRANS DELHI SIGNATURE CITY, UTTAR PRADESH-201 103',
  gst_number = '09AKMPK6169N1Z9',
  email    = 'vatsindustries75@gmail.com',
  location = 'Trans Delhi Signature City, UP'
 WHERE vendor_code = 'V-044' AND name = 'VATS INDUSTRIES / WOOD VIEW INDIA';

DELETE FROM public.vendor_contacts vc USING public.vendors v
 WHERE vc.vendor_id = v.id AND v.vendor_code = 'V-044' AND vc.email = 'vatsindustries75@gmail.com';

INSERT INTO public.vendors (vendor_code, name, address, gst_number, email, contact_person_name,
                            contact_designation, contact_number, supplies, location)
SELECT 'V-104', 'WOOD VIEW INDIA', 'PLOT NO.46, DSIIDC INDUSTRIAL AREA, BAWANA, DELHI-110 039',
       '07CQRPK1902Q1Z9', 'woodviewindia@gmail.com', 'Surinder', 'Owner', '9811893749',
       'Bar Cabinet / Tower Cabinet', 'Bawana, New Delhi'
 WHERE NOT EXISTS (SELECT 1 FROM public.vendors WHERE gst_number = '07CQRPK1902Q1Z9');

INSERT INTO public.vendor_contacts (vendor_id, name, designation, phone)
SELECT id, 'Sunny', 'Son', '9654502054' FROM public.vendors
 WHERE vendor_code = 'V-104'
   AND NOT EXISTS (SELECT 1 FROM public.vendor_contacts c JOIN public.vendors v ON v.id = c.vendor_id
                    WHERE v.vendor_code = 'V-104');

-- ---------------------------------------------------------------------------
-- GST: one shape, one vendor
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_gst_format;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_gst_format
  CHECK (gst_number IS NULL OR gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
CREATE UNIQUE INDEX IF NOT EXISTS vendors_gst_number_key ON public.vendors (gst_number) WHERE gst_number IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Bank details and PAN: administrators only, as the code always assumed
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.vendors FROM anon, authenticated;
GRANT SELECT (id, vendor_code, name, email, contact_number, address, gst_number, contact_person_name,
              contact_designation, supplies, location, is_active, created_by, created_at, updated_at)
  ON public.vendors TO authenticated;

DROP FUNCTION IF EXISTS public.get_vendor_finance(uuid);
CREATE FUNCTION public.get_vendor_finance(p_vendor_id uuid)
RETURNS TABLE(id uuid, bank_account_number text, ifsc_code text, bank_name text,
              account_holder_name text, pan_number text,
              gst_certificate_url text, msme_certificate_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can view vendor bank details' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT v.id, v.bank_account_number, v.ifsc_code, v.bank_name, v.account_holder_name, v.pan_number,
         v.gst_certificate_url, v.msme_certificate_url
    FROM public.vendors v WHERE v.id = p_vendor_id;
END $$;
GRANT EXECUTE ON FUNCTION public.get_vendor_finance(uuid) TO authenticated;
