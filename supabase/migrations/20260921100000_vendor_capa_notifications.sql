-- When PPC rules that a discrepancy is the vendor's, the vendor hears about it.
--
-- Today a rejection stops at the screen. Somebody notices it, opens Outlook,
-- retypes the GRN number, the part code and the quantity, and the vendor gets a
-- mail whose wording depends on who was free that afternoon. Half the time
-- nobody sends anything and the claim is remembered a month later, when the
-- vendor has shipped four more lots.
--
-- So the ruling raises the CAPA and writes the mail in one step:
--
--   PPC opens Purchase Discrepancies, reads the variance, and rules
--        -> raise_vendor_capa() creates the CAPA against that vendor and part
--        -> the mail is RENDERED NOW and queued, addressed from vendors.email
--        -> send-vendor-notifications posts it and stamps sent_at
--
-- The body is rendered here rather than in the sender, on purpose. What went out
-- is then a stored fact rather than something reconstructed later from a
-- template that has since been edited - which matters, because these mails are
-- the paper trail for a debit note.

-- ---------------------------------------------------------------------------
-- The outbox
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.vendor_notification_status AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vendor_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_id     uuid REFERENCES public.capa(id) ON DELETE CASCADE,
  vendor_id   uuid REFERENCES public.vendors(id),
  plant_id    uuid REFERENCES public.plants(id),
  to_email    text NOT NULL,
  cc_email    text,
  subject     text NOT NULL,
  body        text NOT NULL,
  status      public.vendor_notification_status NOT NULL DEFAULT 'QUEUED',
  attempts    int  NOT NULL DEFAULT 0,
  last_error  text,
  sent_at     timestamptz,
  provider_id text,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_notifications_queued
  ON public.vendor_notifications (created_at) WHERE status = 'QUEUED';

DROP TRIGGER IF EXISTS trg_touch_vendor_notifications ON public.vendor_notifications;
CREATE TRIGGER trg_touch_vendor_notifications
  BEFORE UPDATE ON public.vendor_notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.vendor_notifications IS
  'Mails raised against a vendor for a quality claim. The body is the one that was sent, stored verbatim, because it is the paper trail behind a debit note.';

-- ---------------------------------------------------------------------------
-- Rule on a discrepancy: raise the CAPA and queue the mail
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.raise_vendor_capa(
  p_grn_item_id uuid,
  p_problem     text DEFAULT NULL,
  p_due_days    int  DEFAULT 7
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v        record;
  v_capa   uuid;
  v_capa_no text;
  v_note   uuid;
  v_short  numeric;
  v_body   text;
  v_subject text;
  v_problem text;
BEGIN
  -- Aliased `vend`, not `v`: `v` is the record variable being assigned, and
  -- PL/pgSQL resolves the alias against it rather than the table, which fails
  -- with "record v is not assigned yet" - the same collision class as the
  -- lot_number and department OUT parameters earlier in this rebuild.
  SELECT sv.*, vend.name AS v_name, vend.email AS v_email, pl.name AS plant_name
    INTO v
    FROM public.store_receiving_variances sv
    JOIN public.vendors vend ON vend.id = sv.vendor_id
    LEFT JOIN public.plants pl ON pl.id = sv.plant_id
   WHERE sv.grn_item_id = p_grn_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No receiving line found for this item';
  END IF;

  IF NOT public.in_plant(v.plant_id) THEN
    RAISE EXCEPTION 'Not permitted to raise a claim for this plant';
  END IF;

  -- One claim per receiving line. Raising it twice would send the vendor two
  -- mails for one lot and put two debit notes into the reconciliation.
  IF EXISTS (SELECT 1 FROM public.capa WHERE grn_item_id = p_grn_item_id AND status <> 'REJECTED') THEN
    RAISE EXCEPTION 'A claim has already been raised for this receiving line';
  END IF;

  v_short := coalesce(v.iqc_rejected_quantity, 0) + greatest(coalesce(-v.variance, 0), 0);

  IF v_short <= 0 THEN
    RAISE EXCEPTION 'Nothing to claim on this line - IQC rejected nothing and the store counted no shortfall';
  END IF;

  v_problem := coalesce(nullif(btrim(p_problem), ''), format(
    '%s of %s (%s) received against %s were not accepted: %s rejected at incoming inspection and %s not found when the store counted the lot.',
    to_char(v_short, 'FM999,999,999'), v.part_code, v.part_name, v.grn_number,
    to_char(coalesce(v.iqc_rejected_quantity, 0), 'FM999,999,999'),
    to_char(greatest(coalesce(-v.variance, 0), 0), 'FM999,999,999')));

  INSERT INTO public.capa (source, plant_id, vendor_id, part_id, grn_item_id,
                           problem_statement, status, due_date, raised_by)
  VALUES ('VENDOR_RECEIPT', v.plant_id, v.vendor_id, v.part_id, p_grn_item_id,
          v_problem, 'OPEN', (current_date + coalesce(p_due_days, 7)), auth.uid())
  RETURNING id, capa_number INTO v_capa, v_capa_no;

  -- A vendor with no address on file is not a reason to lose the claim: the CAPA
  -- still stands, and the caller is told the mail could not be addressed.
  IF v.v_email IS NULL OR btrim(v.v_email) = '' THEN
    RETURN jsonb_build_object(
      'capa_id', v_capa, 'capa_number', v_capa_no, 'emailed', false,
      'reason', format('%s has no email address on file', v.v_name));
  END IF;

  v_subject := format('%s | Quality claim %s - %s against %s',
                      coalesce(v.plant_name, 'Grammy'), v_capa_no, v.part_code, v.grn_number);

  v_body := concat_ws(E'\n',
    format('Dear %s,', v.v_name), '',
    format('We are raising quality claim %s against material received from you.', v_capa_no), '',
    'RECEIPT',
    format('  GRN               : %s', v.grn_number),
    format('  Received on       : %s', to_char(v.received_date, 'DD Mon YYYY')),
    format('  Your invoice      : %s', coalesce(v.invoice_number, '-')),
    format('  Our purchase order: %s', coalesce(v.po_number, '-')),
    '',
    'MATERIAL',
    format('  Part              : %s - %s', v.part_code, v.part_name),
    format('  Quantity received : %s %s', to_char(v.received_quantity, 'FM999,999,999'), v.uom),
    format('  Accepted at IQC   : %s %s', to_char(coalesce(v.iqc_accepted_quantity, 0), 'FM999,999,999'), v.uom),
    format('  Rejected at IQC   : %s %s', to_char(coalesce(v.iqc_rejected_quantity, 0), 'FM999,999,999'), v.uom),
    format('  Short on counting : %s %s', to_char(greatest(coalesce(-v.variance, 0), 0), 'FM999,999,999'), v.uom),
    format('  TOTAL CLAIMED     : %s %s', to_char(v_short, 'FM999,999,999'), v.uom),
    '',
    'OBSERVATION',
    '  ' || v_problem,
    '',
    'WHAT WE NEED FROM YOU',
    format('  Please send your root cause and corrective action by %s.',
           to_char(current_date + coalesce(p_due_days, 7), 'DD Mon YYYY')),
    '  Rejected material is held separately and is available for your inspection',
    '  or return. Please confirm how you would like it handled.',
    '',
    'Please quote ' || v_capa_no || ' in your reply.',
    '',
    'Regards,',
    'Quality Assurance',
    coalesce(v.plant_name, 'Grammy Electronics'));

  INSERT INTO public.vendor_notifications (capa_id, vendor_id, plant_id, to_email, subject, body, created_by)
  VALUES (v_capa, v.vendor_id, v.plant_id, btrim(v.v_email), v_subject, v_body, auth.uid())
  RETURNING id INTO v_note;

  RETURN jsonb_build_object(
    'capa_id', v_capa, 'capa_number', v_capa_no,
    'notification_id', v_note, 'emailed', true, 'to', btrim(v.v_email));
END;
$$;

REVOKE ALL ON FUNCTION public.raise_vendor_capa(uuid, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_vendor_capa(uuid, text, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- Who may see and send
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendor_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_notifications_read ON public.vendor_notifications;
CREATE POLICY vendor_notifications_read ON public.vendor_notifications
  FOR SELECT TO authenticated USING (public.in_plant(plant_id));

-- Nothing in the app writes this table directly. Rows are created by
-- raise_vendor_capa() and marked sent by the edge function on the service key,
-- so there is exactly one way a mail to a vendor can come into existence.
GRANT SELECT ON public.vendor_notifications TO authenticated;
