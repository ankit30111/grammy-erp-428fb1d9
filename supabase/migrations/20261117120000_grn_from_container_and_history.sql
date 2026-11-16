-- Import purchases, step 2.
--
--   a. A GRN can be made straight from a container's packing list.
--   b. Every stage change and every tracking update of a container is kept as
--      history, so average transit times can be worked out later.

-- 1. Container history ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_container_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.import_containers(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('STAGE', 'TRACKING', 'GRN')),
  stage        public.container_status,
  event_date   date,                 -- the business date (when it was loaded, shipped...)
  location     text,                 -- where the container or vessel is
  detail       text,                 -- status text from the tracking source, or a note
  eta          date,                 -- expected at destination, when the source gives one
  source       text NOT NULL DEFAULT 'ERP',   -- ERP, LDB, or the tracking service used
  created_by   uuid DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS import_container_events_container_idx
  ON public.import_container_events (container_id, created_at);

ALTER TABLE public.import_container_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_container_events_read ON public.import_container_events;
CREATE POLICY import_container_events_read ON public.import_container_events
  FOR SELECT TO authenticated USING (public.has_role(NULL));
REVOKE ALL ON public.import_container_events FROM PUBLIC, anon;
GRANT SELECT ON public.import_container_events TO authenticated;
GRANT ALL ON public.import_container_events TO service_role;

COMMENT ON TABLE public.import_container_events IS 'History of a container: every stage change, tracking update and GRN, never edited.';

ALTER TABLE public.import_containers
  ADD COLUMN IF NOT EXISTS last_location text,
  ADD COLUMN IF NOT EXISTS last_tracked_at timestamptz,
  ADD COLUMN IF NOT EXISTS eta date;

-- Stage changes are written to the history by the same action that makes them.
CREATE OR REPLACE FUNCTION public.container_set_stage(p_id uuid, p_stage public.container_status, p_date date DEFAULT NULL)
RETURNS public.container_status LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.import_containers%ROWTYPE;
  stages constant public.container_status[] := enum_range(NULL::public.container_status);
  v_old int;
  v_new int;
  v_date date := coalesce(p_date, public.ist_today());
  v_col text;
BEGIN
  IF NOT public.has_role('purchase') THEN
    RAISE EXCEPTION 'Only Purchase can move a container';
  END IF;
  SELECT * INTO c FROM public.import_containers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Container not found';
  END IF;

  v_old := array_position(stages, c.current_status);
  v_new := array_position(stages, p_stage);
  IF v_new = v_old THEN
    RETURN c.current_status;
  END IF;
  IF v_new < v_old - 1 THEN
    RAISE EXCEPTION 'A container can go back only one stage at a time';
  END IF;
  IF v_new > v_old AND v_date > public.ist_today() THEN
    RAISE EXCEPTION 'The date cannot be in the future';
  END IF;

  v_col := CASE CASE WHEN v_new > v_old THEN p_stage ELSE c.current_status END
    WHEN 'LOADED' THEN 'loaded_date'
    WHEN 'SHIPPED' THEN 'shipped_date'
    WHEN 'IN_TRANSIT' THEN 'in_transit_date'
    WHEN 'INDIA_CUSTOM' THEN 'india_custom_date'
    WHEN 'ARRIVED' THEN 'arrived_date'
    WHEN 'AT_FACTORY' THEN 'factory_arrival_date'
  END;

  EXECUTE format('UPDATE public.import_containers SET current_status = $1, %I = $2 WHERE id = $3', v_col)
    USING p_stage, CASE WHEN v_new > v_old THEN v_date END, p_id;

  PERFORM public.container_log(p_id, 'STAGE', p_stage, CASE WHEN v_new > v_old THEN v_date END, NULL,
    CASE WHEN v_new > v_old THEN NULL ELSE 'Undone: ' || c.current_status::text END, NULL, 'ERP');
  RETURN p_stage;
END $$;

-- The only way a history row is written. Not callable from a screen.
CREATE OR REPLACE FUNCTION public.container_log(
  p_container uuid, p_kind text, p_stage public.container_status, p_date date,
  p_location text, p_detail text, p_eta date, p_source text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.import_container_events (container_id, kind, stage, event_date, location, detail, eta, source)
  VALUES (p_container, p_kind, p_stage, p_date, nullif(btrim(p_location), ''), nullif(btrim(p_detail), ''), p_eta, coalesce(p_source, 'ERP'))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.container_log(uuid, text, public.container_status, date, text, text, date, text) FROM PUBLIC, anon, authenticated;

-- A tracking reading (from LDB today, a tracking service later): kept as history,
-- and the latest one shown on the container.
CREATE OR REPLACE FUNCTION public.container_add_tracking(
  p_id uuid, p_location text, p_detail text, p_eta date DEFAULT NULL, p_source text DEFAULT 'LDB')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_last public.import_container_events%ROWTYPE; v_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(NULL) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.import_containers WHERE id = p_id) THEN
    RAISE EXCEPTION 'Container not found';
  END IF;
  IF nullif(btrim(coalesce(p_location, '') || coalesce(p_detail, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Nothing to record';
  END IF;

  UPDATE public.import_containers
  SET last_location = coalesce(nullif(btrim(p_location), ''), nullif(btrim(p_detail), '')),
      last_tracked_at = now(), eta = coalesce(p_eta, eta)
  WHERE id = p_id;

  -- The same reading twice in a row is not history.
  SELECT * INTO v_last FROM public.import_container_events
  WHERE container_id = p_id AND kind = 'TRACKING' ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND v_last.location IS NOT DISTINCT FROM nullif(btrim(p_location), '')
           AND v_last.detail IS NOT DISTINCT FROM nullif(btrim(p_detail), '')
           AND v_last.eta IS NOT DISTINCT FROM p_eta THEN
    RETURN v_last.id;
  END IF;
  RETURN public.container_log(p_id, 'TRACKING', NULL, public.ist_today(), p_location, p_detail, p_eta, p_source);
END $$;
REVOKE ALL ON FUNCTION public.container_add_tracking(uuid, text, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.container_add_tracking(uuid, text, text, date, text) TO authenticated, service_role;

-- 2. Days between stages, per container (the learning data) ----------------------
CREATE OR REPLACE VIEW public.import_container_times WITH (security_invoker = true) AS
SELECT c.id AS container_id,
       c.container_number,
       c.shipping_line,
       c.current_status,
       c.ordered_date,
       c.loaded_date,
       c.shipped_date,
       c.india_custom_date,
       c.arrived_date,
       c.factory_arrival_date,
       c.planned_factory,
       c.loaded_date - c.ordered_date AS days_to_load,
       coalesce(c.india_custom_date, c.arrived_date) - coalesce(c.shipped_date, c.loaded_date) AS days_at_sea,
       c.factory_arrival_date - coalesce(c.india_custom_date, c.arrived_date) AS days_port_to_factory,
       c.factory_arrival_date - c.loaded_date AS days_loaded_to_factory,
       c.factory_arrival_date - c.planned_factory AS days_late
FROM public.import_containers c;
REVOKE ALL ON public.import_container_times FROM PUBLIC, anon;
GRANT SELECT ON public.import_container_times TO authenticated, service_role;
COMMENT ON VIEW public.import_container_times IS 'Days each container took between stages; averaged on the Import Tracking page.';

-- 3. GRN from a container's packing list -----------------------------------------
ALTER TABLE public.container_materials
  ADD COLUMN IF NOT EXISTS grn_item_id uuid REFERENCES public.grn_items(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.container_materials.grn_item_id IS 'The GRN line this packing-list line was received on. Empty = not received yet.';

-- One action: a GRN per PO in the container, its lines, the stock into
-- quarantine, and the container marked as at the factory. All or nothing.
-- p_lines = [{ "line_id": <container line>, "quantity": <as per the documents> }];
-- null receives every line not yet received at its packing-list quantity.
CREATE OR REPLACE FUNCTION public.grn_from_container(p_container uuid, p_received_date date DEFAULT NULL, p_lines jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.import_containers%ROWTYPE;
  v_date date := coalesce(p_received_date, public.ist_today());
  po record;
  l record;
  v_grn public.grn%ROWTYPE;
  v_item uuid;
  v_quar uuid;
  v_numbers text[] := '{}';
  v_lines int := 0;
BEGIN
  SELECT * INTO c FROM public.import_containers WHERE id = p_container FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Container not found';
  END IF;
  IF v_date > public.ist_today() THEN
    RAISE EXCEPTION 'The received date cannot be in the future';
  END IF;

  DROP TABLE IF EXISTS _recv;
  CREATE TEMP TABLE _recv ON COMMIT DROP AS
  SELECT m.id AS line_id, m.part_id, m.purchase_order_item_id,
         CASE WHEN p_lines IS NULL THEN m.quantity
              ELSE (SELECT nullif(x->>'quantity', '')::numeric FROM jsonb_array_elements(p_lines) x WHERE (x->>'line_id')::uuid = m.id) END AS qty,
         o.id AS po_id, o.plant_id, o.vendor_id
  FROM public.container_materials m
  JOIN public.purchase_order_items i ON i.id = m.purchase_order_item_id
  JOIN public.purchase_orders o ON o.id = i.purchase_order_id
  WHERE m.container_id = p_container AND m.grn_item_id IS NULL;

  DELETE FROM _recv WHERE qty IS NULL OR qty <= 0;
  IF NOT EXISTS (SELECT 1 FROM _recv) THEN
    RAISE EXCEPTION 'Nothing left to receive from container %', c.container_number;
  END IF;

  FOR po IN SELECT DISTINCT po_id, plant_id, vendor_id FROM _recv LOOP
    IF NOT (public.in_plant(po.plant_id) AND public.has_role('store')) THEN
      RAISE EXCEPTION 'Only Store can receive material for this plant' USING ERRCODE = '42501';
    END IF;
    SELECT id INTO v_quar FROM public.stock_locations WHERE plant_id = po.plant_id AND code = 'QUAR' AND is_active;
    IF v_quar IS NULL THEN
      RAISE EXCEPTION 'This plant has no quarantine store';
    END IF;

    INSERT INTO public.grn (grn_number, plant_id, vendor_id, purchase_order_id, import_container_id,
                            invoice_number, received_date, notes, created_by)
    VALUES ('', po.plant_id, po.vendor_id, po.po_id, p_container, c.invoice_number, v_date,
            'From the packing list of container ' || c.container_number, auth.uid())
    RETURNING * INTO v_grn;
    v_numbers := v_numbers || v_grn.grn_number;

    FOR l IN SELECT * FROM _recv r WHERE r.po_id = po.po_id LOOP
      INSERT INTO public.grn_items (grn_id, purchase_order_item_id, part_id, received_quantity, iqc_outcome)
      VALUES (v_grn.id, l.purchase_order_item_id, l.part_id, l.qty, 'PENDING')
      RETURNING id INTO v_item;
      UPDATE public.container_materials SET grn_item_id = v_item WHERE id = l.line_id;
      PERFORM public.post_stock_movements(jsonb_build_array(jsonb_build_object(
        'plant_id', po.plant_id, 'part_id', l.part_id, 'location_id', v_quar, 'qty_delta', l.qty,
        'movement_type', 'GRN_RECEIPT', 'reason_code', 'GRN_RECEIPT', 'reference_type', 'GRN_ITEM_RECEIPT',
        'reference_id', v_item, 'reference_number', v_grn.grn_number,
        'notes', format('Received into quarantine via GRN %s (container %s)', v_grn.grn_number, c.container_number))));
      v_lines := v_lines + 1;
    END LOOP;
  END LOOP;

  PERFORM public.container_log(p_container, 'GRN', NULL, v_date, NULL, 'GRN ' || array_to_string(v_numbers, ', '), NULL, 'ERP');

  -- Material received means the container is at the factory.
  IF c.current_status <> 'AT_FACTORY' THEN
    UPDATE public.import_containers SET current_status = 'AT_FACTORY', factory_arrival_date = v_date WHERE id = p_container;
    PERFORM public.container_log(p_container, 'STAGE', 'AT_FACTORY', v_date, NULL, 'Set by the GRN', NULL, 'ERP');
  END IF;

  RETURN jsonb_build_object('grn_numbers', to_jsonb(v_numbers), 'lines', v_lines);
END $$;
REVOKE ALL ON FUNCTION public.grn_from_container(uuid, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grn_from_container(uuid, date, jsonb) TO authenticated, service_role;

-- A received line is closed: its quantity belongs to the GRN from then on.
CREATE OR REPLACE FUNCTION public.container_line_received_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.grn_item_id IS NOT NULL THEN
      RAISE EXCEPTION 'This line has been received on a GRN and cannot be removed';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.grn_item_id IS NOT NULL AND NEW.grn_item_id IS NOT NULL AND NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    RAISE EXCEPTION 'This line has been received on a GRN; its quantity cannot be changed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_container_line_received_guard ON public.container_materials;
CREATE TRIGGER trg_container_line_received_guard
  BEFORE UPDATE OR DELETE ON public.container_materials
  FOR EACH ROW EXECUTE FUNCTION public.container_line_received_guard();

-- 4. An import shipment may deliver more than was ordered --------------------------
-- The rule stays as it was for the ordered quantity: it can never be edited below
-- what has been received. What changes: receiving more than ordered is accepted
-- on an import PO (containers are filled for efficiency). On a local PO it is
-- still refused.
CREATE OR REPLACE FUNCTION public.po_item_not_below_received()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF coalesce(OLD.received_quantity, 0) > 0 THEN
      RAISE EXCEPTION 'This line already has % received and cannot be removed',
        OLD.received_quantity;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.quantity < coalesce(NEW.received_quantity, 0) THEN
    IF TG_OP = 'UPDATE' AND NEW.quantity IS NOT DISTINCT FROM OLD.quantity
       AND EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id = NEW.purchase_order_id AND o.is_import) THEN
      RETURN NEW;   -- a receipt on an import PO
    END IF;
    RAISE EXCEPTION 'Quantity cannot be less than the % already received on this line',
      NEW.received_quantity;
  END IF;
  RETURN NEW;
END $$;
