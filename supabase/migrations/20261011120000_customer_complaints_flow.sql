-- Customer complaints, as built before the database rebuild, on today's tables:
--
--   RECEIPT (one complaint or a batch)      complaint_receipts + complaint_receipt_items
--     └─ one complaint per unit received    customer_complaints   (CC-…)
--          └─ OQC analysis: serial, cause, findings
--          └─ faulty parts sent to IQC      customer_complaint_parts
--               └─ IQC analysis: verdict, vendor, root cause, RCA / CAPA
--          └─ closed with the resolution given to the customer
--
-- The complaint's status follows its parts: parts at IQC → PARTS_SENT, all parts
-- closed → RESOLVED. Quality (and Admin) write; every staff member reads.

CREATE SEQUENCE IF NOT EXISTS public.seq_complaint_receipt_number;

CREATE TABLE IF NOT EXISTS public.complaint_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE DEFAULT '',
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  plant_id uuid REFERENCES public.plants(id),
  receipt_type text NOT NULL DEFAULT 'COMPLETE_PRODUCTS'
    CHECK (receipt_type IN ('COMPLETE_PRODUCTS', 'DATA_ONLY', 'FAULTY_PARTS_ONLY')),
  customer_reference text,
  receipt_date date NOT NULL DEFAULT public.ist_today(),
  purchase_date date,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.complaint_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.complaint_receipts(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts(id),
  faulty_part_id uuid REFERENCES public.parts(id),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
  symptom text,
  serial_numbers text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_complaint_receipt_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF COALESCE(NEW.receipt_number, '') = '' THEN
    NEW.receipt_number := public.next_doc_number('CR', 'public.seq_complaint_receipt_number');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_complaint_receipt_number ON public.complaint_receipts;
CREATE TRIGGER trg_complaint_receipt_number BEFORE INSERT ON public.complaint_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_complaint_receipt_number();

-- What each complaint carries from its receipt and from the analyses.
ALTER TABLE public.customer_complaints
  ADD COLUMN IF NOT EXISTS receipt_id uuid REFERENCES public.complaint_receipts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS receipt_item_id uuid REFERENCES public.complaint_receipt_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS faulty_part_id uuid REFERENCES public.parts(id),
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS cause text CHECK (cause IN ('MANUFACTURING_FAULT', 'COMPONENT_FAULT', 'DESIGN_ISSUE', 'USER_MISHANDLING', 'TRANSIT_DAMAGE', 'NO_FAULT_FOUND')),
  ADD COLUMN IF NOT EXISTS analysis text,
  ADD COLUMN IF NOT EXISTS analysed_by uuid,
  ADD COLUMN IF NOT EXISTS analysed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;
CREATE INDEX IF NOT EXISTS customer_complaints_receipt_idx ON public.customer_complaints (receipt_id);

ALTER TABLE public.customer_complaint_parts
  ADD COLUMN IF NOT EXISTS problem text,
  ADD COLUMN IF NOT EXISTS sent_by uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS rca_path text,
  ADD COLUMN IF NOT EXISTS capa_path text,
  ADD COLUMN IF NOT EXISTS capa_id uuid REFERENCES public.capa(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS analysed_by uuid,
  ADD COLUMN IF NOT EXISTS analysed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.customer_complaint_parts ALTER COLUMN status SET DEFAULT 'UNDER_ANALYSIS';
UPDATE public.customer_complaint_parts SET status = 'UNDER_ANALYSIS' WHERE status NOT IN ('UNDER_ANALYSIS', 'ANALYSED', 'CLOSED');
ALTER TABLE public.customer_complaint_parts DROP CONSTRAINT IF EXISTS customer_complaint_parts_status_check;
ALTER TABLE public.customer_complaint_parts ADD CONSTRAINT customer_complaint_parts_status_check
  CHECK (status IN ('UNDER_ANALYSIS', 'ANALYSED', 'CLOSED'));

-- Who did what, stamped by the database.
CREATE OR REPLACE FUNCTION public.complaint_parts_stamp() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.status = 'ANALYSED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ANALYSED') THEN
    NEW.analysed_by := auth.uid(); NEW.analysed_at := now();
  END IF;
  IF NEW.status = 'CLOSED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'CLOSED') THEN
    IF NEW.analysed_at IS NULL THEN NEW.analysed_by := auth.uid(); NEW.analysed_at := now(); END IF;
    NEW.closed_by := auth.uid(); NEW.closed_at := now();
  ELSIF NEW.status <> 'CLOSED' THEN
    NEW.closed_by := NULL; NEW.closed_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_complaint_parts_stamp ON public.customer_complaint_parts;
CREATE TRIGGER trg_complaint_parts_stamp BEFORE INSERT OR UPDATE OF status ON public.customer_complaint_parts
  FOR EACH ROW EXECUTE FUNCTION public.complaint_parts_stamp();

CREATE OR REPLACE FUNCTION public.complaints_stamp() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF (NEW.cause IS DISTINCT FROM OLD.cause OR NEW.analysis IS DISTINCT FROM OLD.analysis) THEN
    NEW.analysed_by := auth.uid(); NEW.analysed_at := now();
    IF NEW.status = 'OPEN' THEN NEW.status := 'UNDER_REVIEW'; END IF;
  END IF;
  IF NEW.status = 'CLOSED' AND OLD.status IS DISTINCT FROM 'CLOSED' THEN
    IF NULLIF(btrim(NEW.resolution), '') IS NULL THEN
      RAISE EXCEPTION 'Write the resolution given to the customer before closing %', NEW.complaint_number;
    END IF;
    IF EXISTS (SELECT 1 FROM public.customer_complaint_parts WHERE complaint_id = NEW.id AND status <> 'CLOSED') THEN
      RAISE EXCEPTION '% still has parts under IQC analysis', NEW.complaint_number;
    END IF;
    NEW.closed_by := auth.uid(); NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  ELSIF NEW.status <> 'CLOSED' THEN
    NEW.closed_by := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_complaints_stamp ON public.customer_complaints;
CREATE TRIGGER trg_complaints_stamp BEFORE UPDATE ON public.customer_complaints
  FOR EACH ROW EXECUTE FUNCTION public.complaints_stamp();

-- The complaint follows its parts.
CREATE OR REPLACE FUNCTION public.complaint_status_from_parts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c uuid := COALESCE(NEW.complaint_id, OLD.complaint_id); n int; open_n int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status <> 'CLOSED') INTO n, open_n
    FROM public.customer_complaint_parts WHERE complaint_id = c;
  UPDATE public.customer_complaints SET status = CASE
      WHEN n = 0 THEN CASE WHEN cause IS NOT NULL OR analysis IS NOT NULL THEN 'UNDER_REVIEW' ELSE 'OPEN' END::public.complaint_status
      WHEN open_n > 0 THEN 'PARTS_SENT'::public.complaint_status
      ELSE 'RESOLVED'::public.complaint_status END
   WHERE id = c AND status <> 'CLOSED';
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_complaint_status_from_parts ON public.customer_complaint_parts;
CREATE TRIGGER trg_complaint_status_from_parts AFTER INSERT OR UPDATE OF status OR DELETE ON public.customer_complaint_parts
  FOR EACH ROW EXECUTE FUNCTION public.complaint_status_from_parts();

-- One receipt, its lines, and one complaint per unit, in one go.
--   p_receipt: {customer_id, receipt_type, customer_reference, receipt_date, purchase_date, notes, plant_id}
--   p_items:   [{part_id, faulty_part_id, quantity, symptom, serial_numbers}]
CREATE OR REPLACE FUNCTION public.complaint_receipt_create(p_receipt jsonb, p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE
  r public.complaint_receipts; it jsonb; item public.complaint_receipt_items;
  serials text[]; i int; made int := 0; first_no text; last_no text; no text;
BEGIN
  IF NOT public.has_role('quality') THEN RAISE EXCEPTION 'Only Quality can receive complaints'; END IF;
  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Add at least one product'; END IF;
  INSERT INTO public.complaint_receipts (customer_id, plant_id, receipt_type, customer_reference, receipt_date, purchase_date, notes)
  VALUES ((p_receipt->>'customer_id')::uuid, NULLIF(p_receipt->>'plant_id', '')::uuid,
          COALESCE(NULLIF(p_receipt->>'receipt_type', ''), 'COMPLETE_PRODUCTS'), NULLIF(btrim(p_receipt->>'customer_reference'), ''),
          COALESCE(NULLIF(p_receipt->>'receipt_date', '')::date, public.ist_today()), NULLIF(p_receipt->>'purchase_date', '')::date,
          NULLIF(btrim(p_receipt->>'notes'), ''))
  RETURNING * INTO r;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.complaint_receipt_items (receipt_id, part_id, faulty_part_id, quantity, symptom, serial_numbers)
    VALUES (r.id, (it->>'part_id')::uuid, NULLIF(it->>'faulty_part_id', '')::uuid, COALESCE((it->>'quantity')::int, 1),
            NULLIF(btrim(it->>'symptom'), ''), NULLIF(btrim(it->>'serial_numbers'), ''))
    RETURNING * INTO item;
    IF r.receipt_type = 'FAULTY_PARTS_ONLY' AND item.faulty_part_id IS NULL THEN
      RAISE EXCEPTION 'Choose the faulty part for every line of a faulty-parts receipt';
    END IF;
    serials := ARRAY(SELECT btrim(s) FROM regexp_split_to_table(COALESCE(item.serial_numbers, ''), '[,;\s]+') s WHERE btrim(s) <> '');
    IF array_length(serials, 1) > item.quantity THEN
      RAISE EXCEPTION '% serial numbers given for a quantity of %', array_length(serials, 1), item.quantity;
    END IF;
    FOR i IN 1..item.quantity LOOP
      INSERT INTO public.customer_complaints (customer_id, plant_id, part_id, faulty_part_id, serial_number, received_date, purchase_date,
                                              quantity, complaint_details, receipt_id, receipt_item_id, created_by)
      VALUES (r.customer_id, r.plant_id, item.part_id, item.faulty_part_id, serials[i], r.receipt_date, r.purchase_date, 1,
              COALESCE(item.symptom, CASE r.receipt_type WHEN 'DATA_ONLY' THEN 'Data received for analysis'
                                                         WHEN 'FAULTY_PARTS_ONLY' THEN 'Faulty part received for analysis'
                                                         ELSE 'Product received for analysis' END),
              r.id, item.id, auth.uid())
      RETURNING complaint_number INTO no;
      first_no := COALESCE(first_no, no); last_no := no; made := made + 1;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('receipt_id', r.id, 'receipt_number', r.receipt_number, 'complaints', made, 'first', first_no, 'last', last_no);
END $$;
GRANT EXECUTE ON FUNCTION public.complaint_receipt_create(jsonb, jsonb) TO authenticated;

ALTER TABLE public.complaint_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_receipt_items ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['complaint_receipts', 'complaint_receipt_items'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role())', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(''quality'')) WITH CHECK (public.has_role(''quality''))', t || '_write', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaint_receipts, public.complaint_receipt_items TO authenticated;
GRANT USAGE ON SEQUENCE public.seq_complaint_receipt_number TO authenticated;
