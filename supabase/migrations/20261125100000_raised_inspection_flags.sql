-- Raised inspection while a CAPA is awaited.
--
-- When a part from a vendor is found faulty (a complaint part IQC judged faulty with a vendor
-- named, an IQC lot rejected or segregated, or a part rejected as faulty on the line) the part
-- and vendor are FLAGGED. Nothing is blocked: goods are received, inspected and issued as usual,
-- but IQC inspects that part from that vendor at a higher level (G2, G3, S1-S4 or every piece),
-- which Quality chooses. The flag stays until the QA head releases it, normally once the
-- vendor's CAPA has been received and accepted.
--
-- Sampling follows ISO 2859-1 (IS 2500 Part 1), single sampling, normal inspection,
-- AQL 1.0 for major and 2.5 for minor defects. The normal level is G1.

-- 1. The flags and their history ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.iqc_flags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id       uuid NOT NULL REFERENCES public.parts(id),
  vendor_id     uuid REFERENCES public.vendors(id),          -- null: whichever vendor supplies it
  level         text CHECK (level IN ('G1','G2','G3','S1','S2','S3','S4','FULL')),  -- null: Quality to choose
  status        text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RELEASED')),
  capa_status   text NOT NULL DEFAULT 'AWAITED' CHECK (capa_status IN ('AWAITED','RECEIVED','ACCEPTED','REJECTED')),
  capa_path     text,
  first_reason  text,
  raised_at     timestamptz NOT NULL DEFAULT now(),
  level_set_by  uuid,
  level_set_at  timestamptz,
  released_by   uuid,
  released_at   timestamptz,
  release_note  text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.iqc_flags IS '[Quality] A part (and vendor) inspected at a raised IQC level while its CAPA is awaited. Never blocks receipt.';
CREATE UNIQUE INDEX IF NOT EXISTS iqc_flags_one_open
  ON public.iqc_flags (part_id, coalesce(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS public.iqc_flag_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id    uuid NOT NULL REFERENCES public.iqc_flags(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('RAISED','TRIGGER','LEVEL','CAPA','LOT','RELEASED')),
  source     text,          -- COMPLAINT, IQC_LOT, LINE, MANUAL
  source_id  uuid,
  detail     text,
  by_user    uuid DEFAULT auth.uid(),
  at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.iqc_flag_events IS '[Quality] History of a raised-inspection flag: what raised it, level changes, CAPA, lots inspected, release.';
CREATE INDEX IF NOT EXISTS iqc_flag_events_flag ON public.iqc_flag_events (flag_id, at);

ALTER TABLE public.iqc_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iqc_flag_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS iqc_flags_read ON public.iqc_flags;
CREATE POLICY iqc_flags_read ON public.iqc_flags FOR SELECT TO authenticated USING (public.has_role(NULL));
DROP POLICY IF EXISTS iqc_flag_events_read ON public.iqc_flag_events;
CREATE POLICY iqc_flag_events_read ON public.iqc_flag_events FOR SELECT TO authenticated USING (public.has_role(NULL));
REVOKE ALL ON public.iqc_flags, public.iqc_flag_events FROM anon, PUBLIC;
GRANT SELECT ON public.iqc_flags, public.iqc_flag_events TO authenticated;

-- 2. Who may do what ------------------------------------------------------------------------
-- QA head: Admin, Management, or anyone placed in a department named "QA Head".
CREATE OR REPLACE FUNCTION public.is_qa_head()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.can_approve() OR public.in_department(ARRAY['QA Head']) $$;

-- 3. The sampling plan ----------------------------------------------------------------------
-- Lot size, level -> code letter (ISO 2859-1 table 1) -> sample size and accept/reject
-- numbers (table 2-A, single sampling, normal inspection). Arrows in the standard are resolved:
-- a "use the plan below/above" row takes that plan's sample size too.
CREATE OR REPLACE FUNCTION public.iqc_sample_plan(p_lot integer, p_level text DEFAULT 'G1')
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
  bands   int[]  := ARRAY[8,15,25,50,90,150,280,500,1200,3200,10000,35000,150000,500000,2147483647];
  letters text   := 'ABCDEFGHJKLMNPQR';
  sizes   int[]  := ARRAY[2,3,5,8,13,20,32,50,80,125,200,315,500,800,1250,2000];
  -- one letter per lot band, per level
  tbl jsonb := jsonb_build_object(
    'G1', 'AABCCDEFGHJKLMN', 'G2', 'ABCDEFGHJKLMNPQ', 'G3', 'BCDEFGHJKLMNPQR',
    'S1', 'AAAABBBBCCCCDDD', 'S2', 'AAABBBCCCDDDEEE', 'S3', 'AABBCCDDEEFFGGH', 'S4', 'AABCCDEEFGGHJJK');
  -- per code letter A..R: 'd' = use the plan below, 'u' = use the plan above, else 'Ac/Re'
  aql10 text[] := ARRAY['d','d','d','d','0/1','u','d','1/2','2/3','3/4','5/6','7/8','10/11','14/15','21/22','u'];
  aql25 text[] := ARRAY['d','d','0/1','u','d','1/2','2/3','3/4','5/6','7/8','10/11','14/15','21/22','u','u','u'];
  v_band int; v_letter text; v_i int; maj jsonb; mnr jsonb; v_lot int := greatest(coalesce(p_lot, 0), 0);
  v_level text := upper(coalesce(p_level, 'G1'));
BEGIN
  IF v_level = 'FULL' OR v_lot <= 1 THEN
    RETURN jsonb_build_object('level', v_level, 'lot', v_lot, 'letter', NULL, 'sample', v_lot, 'every_piece', true,
      'major', jsonb_build_object('aql', 1.0, 'n', v_lot, 'ac', 0, 're', 1),
      'minor', jsonb_build_object('aql', 2.5, 'n', v_lot, 'ac', 0, 're', 1));
  END IF;
  IF NOT (tbl ? v_level) THEN RAISE EXCEPTION 'Unknown inspection level %', p_level; END IF;
  SELECT min(i) INTO v_band FROM generate_subscripts(bands, 1) i WHERE v_lot <= bands[i];
  v_letter := substr(tbl ->> v_level, v_band, 1);
  v_i := strpos(letters, v_letter);

  -- resolve each AQL column from the letter's row
  FOR k IN 1..2 LOOP
    DECLARE col text[] := CASE k WHEN 1 THEN aql10 ELSE aql25 END; j int := v_i; cell text; n int; plan jsonb;
    BEGIN
      cell := col[j];
      IF cell = 'd' THEN
        WHILE col[j] IN ('d','u') AND j < 16 LOOP j := j + 1; END LOOP;
      ELSIF cell = 'u' THEN
        WHILE col[j] IN ('d','u') AND j > 1 LOOP j := j - 1; END LOOP;
      END IF;
      n := least(sizes[j], v_lot);
      plan := jsonb_build_object('aql', CASE k WHEN 1 THEN 1.0 ELSE 2.5 END, 'letter', substr(letters, j, 1), 'n', n,
                                 'ac', split_part(col[j], '/', 1)::int, 're', split_part(col[j], '/', 2)::int);
      IF k = 1 THEN maj := plan; ELSE mnr := plan; END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('level', v_level, 'lot', v_lot, 'letter', v_letter,
    'sample', greatest((maj ->> 'n')::int, (mnr ->> 'n')::int), 'every_piece', greatest((maj ->> 'n')::int, (mnr ->> 'n')::int) >= v_lot,
    'major', maj, 'minor', mnr);
END $$;
GRANT EXECUTE ON FUNCTION public.iqc_sample_plan(integer, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.iqc_sample_plan(integer, text) FROM PUBLIC, anon;

-- 4. Raising a flag (only from the triggers below and the manual call) -----------------------
CREATE OR REPLACE FUNCTION public.iqc_flag_raise(p_part uuid, p_vendor uuid, p_source text, p_source_id uuid, p_detail text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v uuid;
BEGIN
  IF p_part IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v FROM public.iqc_flags
   WHERE part_id = p_part AND vendor_id IS NOT DISTINCT FROM p_vendor AND status = 'OPEN';
  IF v IS NULL THEN
    INSERT INTO public.iqc_flags (part_id, vendor_id, first_reason) VALUES (p_part, p_vendor, p_detail) RETURNING id INTO v;
    INSERT INTO public.iqc_flag_events (flag_id, kind, source, source_id, detail) VALUES (v, 'RAISED', p_source, p_source_id, p_detail);
  ELSIF p_source_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.iqc_flag_events WHERE flag_id = v AND source_id = p_source_id AND kind IN ('RAISED','TRIGGER')) THEN
    INSERT INTO public.iqc_flag_events (flag_id, kind, source, source_id, detail) VALUES (v, 'TRIGGER', p_source, p_source_id, p_detail);
    -- The fault came back after the CAPA was accepted: the CAPA did not work, so it is awaited again.
    UPDATE public.iqc_flags SET capa_status = 'AWAITED', updated_at = now() WHERE id = v AND capa_status = 'ACCEPTED';
  END IF;
  RETURN v;
END $$;
REVOKE EXECUTE ON FUNCTION public.iqc_flag_raise(uuid, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- The open flag that applies to a part from a vendor: the vendor's own first, then the part's.
CREATE OR REPLACE FUNCTION public.iqc_flag_for(p_part uuid, p_vendor uuid)
RETURNS public.iqc_flags LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f.* FROM public.iqc_flags f
   WHERE f.part_id = p_part AND f.status = 'OPEN' AND (f.vendor_id = p_vendor OR f.vendor_id IS NULL)
   ORDER BY (f.vendor_id IS NULL), f.raised_at LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.iqc_flag_for(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iqc_flag_for(uuid, uuid) TO authenticated, service_role;

-- 5. The three triggers ---------------------------------------------------------------------
-- a. A complaint part IQC judged faulty, with a vendor named.
CREATE OR REPLACE FUNCTION public.trg_flag_from_complaint_part()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_no text;
BEGIN
  IF NEW.verdict = 'FAULTY' AND NEW.vendor_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.verdict IS DISTINCT FROM NEW.verdict OR OLD.vendor_id IS DISTINCT FROM NEW.vendor_id) THEN
    SELECT complaint_number INTO v_no FROM public.customer_complaints WHERE id = NEW.complaint_id;
    PERFORM public.iqc_flag_raise(NEW.part_id, NEW.vendor_id, 'COMPLAINT', NEW.id,
      'Complaint ' || coalesce(v_no, '') || ': ' || coalesce(nullif(btrim(NEW.root_cause), ''), nullif(btrim(NEW.problem), ''), 'faulty'));
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_flag_from_complaint_part ON public.customer_complaint_parts;
CREATE TRIGGER trg_flag_from_complaint_part AFTER INSERT OR UPDATE OF verdict, vendor_id ON public.customer_complaint_parts
  FOR EACH ROW EXECUTE FUNCTION public.trg_flag_from_complaint_part();

-- b. An IQC lot: every lot of a flagged part is logged with its level; a rejected or
--    segregated lot raises (or adds to) the flag.
CREATE OR REPLACE FUNCTION public.trg_flag_from_iqc_lot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE g public.grn%ROWTYPE; f public.iqc_flags;
BEGIN
  IF NEW.iqc_outcome IS NOT DISTINCT FROM OLD.iqc_outcome OR NEW.iqc_outcome = 'PENDING' THEN RETURN NULL; END IF;
  SELECT * INTO g FROM public.grn WHERE id = NEW.grn_id;
  f := public.iqc_flag_for(NEW.part_id, g.vendor_id);
  IF f.id IS NOT NULL THEN
    INSERT INTO public.iqc_flag_events (flag_id, kind, source, source_id, detail)
    VALUES (f.id, 'LOT', 'IQC_LOT', NEW.id, g.grn_number || ' at ' || coalesce(f.level, 'G2 (level not set)') || ': ' || lower(NEW.iqc_outcome::text)
      || ', ' || coalesce(NEW.iqc_rejected_quantity, 0) || ' of ' || NEW.received_quantity || ' rejected');
  END IF;
  IF NEW.iqc_outcome IN ('REJECTED', 'PARTIAL') THEN
    PERFORM public.iqc_flag_raise(NEW.part_id, g.vendor_id, 'IQC_LOT', NEW.id,
      g.grn_number || ': lot ' || lower(NEW.iqc_outcome::text) || ', ' || coalesce(NEW.iqc_rejected_quantity, 0) || ' of ' || NEW.received_quantity || ' rejected');
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_flag_from_iqc_lot ON public.grn_items;
CREATE TRIGGER trg_flag_from_iqc_lot AFTER UPDATE OF iqc_outcome ON public.grn_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_flag_from_iqc_lot();

-- c. A part rejected on the line as faulty (not mishandling). The vendor is the one recorded
--    on the rejection, else the part's primary vendor, else any vendor of the part.
CREATE OR REPLACE FUNCTION public.trg_flag_from_line_rejection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_vendor uuid; v_no text;
BEGIN
  IF NEW.verdict = 'FAULTY' AND coalesce(NEW.defect, '') <> 'User Mishandling'
     AND (TG_OP = 'INSERT' OR OLD.verdict IS DISTINCT FROM NEW.verdict) THEN
    v_vendor := coalesce(NEW.vendor_id, (SELECT pv.vendor_id FROM public.part_vendors pv WHERE pv.part_id = NEW.part_id AND pv.is_primary LIMIT 1));
    SELECT voucher_number INTO v_no FROM public.production_orders WHERE id = NEW.production_order_id;
    PERFORM public.iqc_flag_raise(NEW.part_id, v_vendor, 'LINE', NEW.id,
      'Line rejection on ' || coalesce(v_no, 'a voucher') || ': ' || NEW.quantity || ' faulty' || coalesce(' (' || nullif(btrim(NEW.defect), '') || ')', ''));
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_flag_from_line_rejection ON public.line_rejections;
CREATE TRIGGER trg_flag_from_line_rejection AFTER INSERT OR UPDATE OF verdict ON public.line_rejections
  FOR EACH ROW EXECUTE FUNCTION public.trg_flag_from_line_rejection();

REVOKE EXECUTE ON FUNCTION public.trg_flag_from_complaint_part(), public.trg_flag_from_iqc_lot(), public.trg_flag_from_line_rejection() FROM PUBLIC, anon, authenticated;

-- 6. What Quality and the QA head do --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.iqc_flag_set_level(p_flag uuid, p_level text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE f public.iqc_flags;
BEGIN
  IF NOT (public.has_role('quality') OR public.can_approve()) THEN RAISE EXCEPTION 'Only Quality can set the inspection level' USING ERRCODE = '42501'; END IF;
  IF upper(p_level) NOT IN ('G1','G2','G3','S1','S2','S3','S4','FULL') THEN RAISE EXCEPTION 'Unknown inspection level %', p_level; END IF;
  SELECT * INTO f FROM public.iqc_flags WHERE id = p_flag FOR UPDATE;
  IF f.id IS NULL OR f.status <> 'OPEN' THEN RAISE EXCEPTION 'This flag is not open'; END IF;
  UPDATE public.iqc_flags SET level = upper(p_level), level_set_by = auth.uid(), level_set_at = now(), updated_at = now() WHERE id = p_flag;
  INSERT INTO public.iqc_flag_events (flag_id, kind, source, detail)
  VALUES (p_flag, 'LEVEL', 'MANUAL', coalesce(f.level, 'not set') || ' to ' || upper(p_level) || coalesce(': ' || nullif(btrim(p_note), ''), ''));
END $$;

CREATE OR REPLACE FUNCTION public.iqc_flag_capa(p_flag uuid, p_status text, p_path text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE f public.iqc_flags;
BEGIN
  IF NOT (public.has_role('quality') OR public.can_approve()) THEN RAISE EXCEPTION 'Only Quality can record the CAPA' USING ERRCODE = '42501'; END IF;
  IF upper(p_status) NOT IN ('AWAITED','RECEIVED','ACCEPTED','REJECTED') THEN RAISE EXCEPTION 'Unknown CAPA status %', p_status; END IF;
  SELECT * INTO f FROM public.iqc_flags WHERE id = p_flag FOR UPDATE;
  IF f.id IS NULL OR f.status <> 'OPEN' THEN RAISE EXCEPTION 'This flag is not open'; END IF;
  IF upper(p_status) IN ('ACCEPTED','REJECTED') AND coalesce(p_path, f.capa_path) IS NULL THEN
    RAISE EXCEPTION 'Attach the vendor''s CAPA before accepting or rejecting it';
  END IF;
  UPDATE public.iqc_flags SET capa_status = upper(p_status), capa_path = coalesce(p_path, capa_path), updated_at = now() WHERE id = p_flag;
  INSERT INTO public.iqc_flag_events (flag_id, kind, source, detail)
  VALUES (p_flag, 'CAPA', 'MANUAL', 'CAPA ' || lower(upper(p_status)) || coalesce(': ' || nullif(btrim(p_note), ''), ''));
END $$;

-- The QA head decides when inspection goes back to normal. Without an accepted CAPA a reason is required.
CREATE OR REPLACE FUNCTION public.iqc_flag_release(p_flag uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE f public.iqc_flags;
BEGIN
  IF NOT public.is_qa_head() THEN RAISE EXCEPTION 'Only the QA head, Management or Admin can release a flag' USING ERRCODE = '42501'; END IF;
  SELECT * INTO f FROM public.iqc_flags WHERE id = p_flag FOR UPDATE;
  IF f.id IS NULL OR f.status <> 'OPEN' THEN RAISE EXCEPTION 'This flag is not open'; END IF;
  IF f.capa_status <> 'ACCEPTED' AND nullif(btrim(coalesce(p_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'The CAPA is not accepted yet: say why inspection can go back to normal';
  END IF;
  UPDATE public.iqc_flags SET status = 'RELEASED', released_by = auth.uid(), released_at = now(),
         release_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now() WHERE id = p_flag;
  INSERT INTO public.iqc_flag_events (flag_id, kind, source, detail)
  VALUES (p_flag, 'RELEASED', 'MANUAL', 'Back to normal inspection' || coalesce(': ' || nullif(btrim(p_note), ''), ''));
END $$;

-- Quality may also flag a part by hand (a vendor warning, a field issue seen elsewhere).
CREATE OR REPLACE FUNCTION public.iqc_flag_manual(p_part uuid, p_vendor uuid, p_level text, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v uuid;
BEGIN
  IF NOT (public.has_role('quality') OR public.can_approve()) THEN RAISE EXCEPTION 'Only Quality can flag a part' USING ERRCODE = '42501'; END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'Say why the part is flagged'; END IF;
  v := public.iqc_flag_raise(p_part, p_vendor, 'MANUAL', NULL, btrim(p_reason));
  IF p_level IS NOT NULL THEN PERFORM public.iqc_flag_set_level(v, p_level, NULL); END IF;
  RETURN v;
END $$;

REVOKE EXECUTE ON FUNCTION public.is_qa_head(), public.iqc_flag_set_level(uuid, text, text), public.iqc_flag_capa(uuid, text, text, text),
  public.iqc_flag_release(uuid, text), public.iqc_flag_manual(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_qa_head(), public.iqc_flag_set_level(uuid, text, text), public.iqc_flag_capa(uuid, text, text, text),
  public.iqc_flag_release(uuid, text), public.iqc_flag_manual(uuid, uuid, text, text) TO authenticated, service_role;

-- 7. What IQC sees on a GRN: per line, the flag (if any) and the sampling plan --------------
-- A flagged part whose level is not chosen yet is inspected at G2 until Quality chooses.
CREATE OR REPLACE FUNCTION public.grn_inspection_plans(p_grn uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT coalesce(jsonb_object_agg(gi.id, jsonb_build_object(
           'flag', CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object('id', f.id, 'level', f.level, 'capa_status', f.capa_status,
                     'since', f.raised_at, 'reason', f.first_reason, 'vendor_specific', f.vendor_id IS NOT NULL) END,
           'plan', public.iqc_sample_plan(gi.received_quantity::int,
                     CASE WHEN f.id IS NULL THEN 'G1' ELSE coalesce(f.level, 'G2') END))), '{}'::jsonb)
    FROM public.grn g JOIN public.grn_items gi ON gi.grn_id = g.id
    LEFT JOIN LATERAL public.iqc_flag_for(gi.part_id, g.vendor_id) f ON true
   WHERE g.id = p_grn AND public.has_role(NULL)
$$;

-- GRNs waiting for IQC that hold a flagged part, for the chip on the pending list.
CREATE OR REPLACE FUNCTION public.pending_iqc_flags()
RETURNS TABLE (grn_id uuid, part_code text, level text, capa_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT g.id, p.part_code, coalesce(f.level, 'G2'), f.capa_status
    FROM public.grn g JOIN public.grn_items gi ON gi.grn_id = g.id
    JOIN public.parts p ON p.id = gi.part_id
    JOIN LATERAL public.iqc_flag_for(gi.part_id, g.vendor_id) f ON f.id IS NOT NULL
   WHERE gi.iqc_outcome = 'PENDING' AND public.has_role(NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.grn_inspection_plans(uuid), public.pending_iqc_flags() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grn_inspection_plans(uuid), public.pending_iqc_flags() TO authenticated, service_role;

-- 8. Tasks: Quality chooses levels and chases CAPAs; the QA head releases ------------------
ALTER FUNCTION public.my_tasks() RENAME TO my_tasks_core;
CREATE OR REPLACE FUNCTION public.my_tasks()
RETURNS TABLE (key text, area text, title text, waiting integer, oldest date, link text)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT * FROM public.my_tasks_core()
  UNION ALL
  SELECT 'flag-level', 'Quality', 'Flagged parts: choose the inspection level', count(*)::int, min(raised_at)::date, '/quality/capa?tab=raised'
    FROM public.iqc_flags WHERE status = 'OPEN' AND level IS NULL AND (public.has_role('quality') OR public.can_approve())
  HAVING count(*) > 0
  UNION ALL
  SELECT 'flag-capa', 'Quality', 'Vendor CAPAs awaited (inspection raised)', count(*)::int, min(raised_at)::date, '/quality/capa?tab=raised'
    FROM public.iqc_flags WHERE status = 'OPEN' AND capa_status IN ('AWAITED','REJECTED') AND (public.has_role('quality') OR public.can_approve())
  HAVING count(*) > 0
  UNION ALL
  SELECT 'flag-release', 'Approvals', 'CAPA accepted: decide on normal inspection', count(*)::int, min(updated_at)::date, '/quality/capa?tab=raised'
    FROM public.iqc_flags WHERE status = 'OPEN' AND capa_status = 'ACCEPTED' AND public.is_qa_head()
  HAVING count(*) > 0
$$;
REVOKE EXECUTE ON FUNCTION public.my_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_tasks() TO authenticated, service_role;
