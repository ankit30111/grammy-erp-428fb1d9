-- Import purchases, step 1.
--
-- An import purchase starts as a normal PO with is_import = true. Once it is
-- approved, its lines are loaded into containers, and each container is
-- followed stage by stage: ORDERED > LOADED > SHIPPED > IN_TRANSIT >
-- INDIA_CUSTOM > ARRIVED > AT_FACTORY. Receiving stays a normal GRN.
-- Exchange rate, duty and landed cost come later.

-- 1. What a container carries, and from which PO line ------------------------
ALTER TABLE public.import_containers
  ADD COLUMN IF NOT EXISTS shipping_line text,
  ADD COLUMN IF NOT EXISTS bl_number text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_amount numeric CHECK (invoice_amount IS NULL OR invoice_amount >= 0),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS in_transit_date date;

ALTER TABLE public.container_materials
  ADD COLUMN IF NOT EXISTS purchase_order_item_id uuid REFERENCES public.purchase_order_items(id);

CREATE INDEX IF NOT EXISTS container_materials_po_item_idx
  ON public.container_materials (purchase_order_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS container_materials_one_line_per_po_item
  ON public.container_materials (container_id, purchase_order_item_id)
  WHERE purchase_order_item_id IS NOT NULL;

-- A container line must come from an approved import PO, and all containers
-- together can never carry more of a PO line than was ordered.
CREATE OR REPLACE FUNCTION public.container_line_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v record;
  v_loaded numeric;
BEGIN
  IF NEW.purchase_order_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT i.part_id, i.quantity, po.is_import, po.status, po.po_number INTO v
  FROM public.purchase_order_items i
  JOIN public.purchase_orders po ON po.id = i.purchase_order_id
  WHERE i.id = NEW.purchase_order_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That PO line does not exist';
  END IF;
  IF NOT v.is_import THEN
    RAISE EXCEPTION '% is not an import PO', v.po_number;
  END IF;
  IF v.status NOT IN ('APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED') THEN
    RAISE EXCEPTION '% is not approved yet', v.po_number;
  END IF;

  NEW.part_id := v.part_id;

  SELECT coalesce(sum(m.quantity), 0) INTO v_loaded
  FROM public.container_materials m
  WHERE m.purchase_order_item_id = NEW.purchase_order_item_id AND m.id <> NEW.id;
  IF v_loaded + NEW.quantity > v.quantity THEN
    RAISE EXCEPTION 'Only % of this PO line is left to load (ordered %, already in containers %)',
      v.quantity - v_loaded, v.quantity, v_loaded;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_container_line_guard ON public.container_materials;
CREATE TRIGGER trg_container_line_guard
  BEFORE INSERT OR UPDATE OF quantity, purchase_order_item_id ON public.container_materials
  FOR EACH ROW EXECUTE FUNCTION public.container_line_guard();

-- 2. Save a container with its lines in one step ------------------------------
CREATE OR REPLACE FUNCTION public.container_save(p_id uuid, p_header jsonb, p_lines jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_id uuid := p_id;
  v_status public.container_status;
  l jsonb;
  v_item uuid;
  v_qty numeric;
  v_keep uuid[] := '{}';
  h jsonb := coalesce(p_header, '{}'::jsonb);
BEGIN
  IF NOT public.has_role('purchase') THEN
    RAISE EXCEPTION 'Only Purchase can save a container';
  END IF;
  IF nullif(btrim(h->>'container_number'), '') IS NULL THEN
    RAISE EXCEPTION 'Enter the container number';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.import_containers (
      container_number, shipping_line, vessel_name, bl_number, invoice_number, invoice_amount, currency,
      freight_cost, planned_loaded, planned_factory, notes, ordered_date, created_by)
    VALUES (
      upper(btrim(h->>'container_number')), nullif(btrim(h->>'shipping_line'), ''), nullif(btrim(h->>'vessel_name'), ''),
      nullif(btrim(h->>'bl_number'), ''), nullif(btrim(h->>'invoice_number'), ''), nullif(h->>'invoice_amount', '')::numeric,
      nullif(btrim(h->>'currency'), ''), nullif(h->>'freight_cost', '')::numeric, nullif(h->>'planned_loaded', '')::date,
      nullif(h->>'planned_factory', '')::date, nullif(btrim(h->>'notes'), ''), public.ist_today(), auth.uid())
    RETURNING id, current_status INTO v_id, v_status;
  ELSE
    UPDATE public.import_containers SET
      container_number = upper(btrim(h->>'container_number')),
      shipping_line = nullif(btrim(h->>'shipping_line'), ''),
      vessel_name = nullif(btrim(h->>'vessel_name'), ''),
      bl_number = nullif(btrim(h->>'bl_number'), ''),
      invoice_number = nullif(btrim(h->>'invoice_number'), ''),
      invoice_amount = nullif(h->>'invoice_amount', '')::numeric,
      currency = nullif(btrim(h->>'currency'), ''),
      freight_cost = nullif(h->>'freight_cost', '')::numeric,
      planned_loaded = nullif(h->>'planned_loaded', '')::date,
      planned_factory = nullif(h->>'planned_factory', '')::date,
      notes = nullif(btrim(h->>'notes'), '')
    WHERE id = v_id
    RETURNING current_status INTO v_status;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Container not found';
    END IF;
  END IF;

  -- p_lines = null leaves the lines as they are (details-only edit).
  IF p_lines IS NOT NULL THEN
    IF v_status = 'AT_FACTORY' AND p_id IS NOT NULL THEN
      RAISE EXCEPTION 'This container has reached the factory. Its lines can no longer be changed';
    END IF;

    FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
      v_item := (l->>'purchase_order_item_id')::uuid;
      v_qty := coalesce(nullif(l->>'quantity', '')::numeric, 0);
      IF v_item IS NULL OR v_qty <= 0 THEN
        CONTINUE;
      END IF;
      v_keep := v_keep || v_item;
    END LOOP;

    -- Lines taken off the list go first, so their quantity is free again.
    DELETE FROM public.container_materials
    WHERE container_id = v_id AND purchase_order_item_id IS NOT NULL
      AND NOT (purchase_order_item_id = ANY (v_keep));

    FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
      v_item := (l->>'purchase_order_item_id')::uuid;
      v_qty := coalesce(nullif(l->>'quantity', '')::numeric, 0);
      IF v_item IS NULL OR v_qty <= 0 THEN
        CONTINUE;
      END IF;
      UPDATE public.container_materials
      SET quantity = v_qty, cbm_occupied = nullif(l->>'cbm', '')::numeric
      WHERE container_id = v_id AND purchase_order_item_id = v_item;
      IF NOT FOUND THEN
        INSERT INTO public.container_materials (container_id, purchase_order_item_id, quantity, cbm_occupied)
        VALUES (v_id, v_item, v_qty, nullif(l->>'cbm', '')::numeric);
      END IF;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM public.container_materials WHERE container_id = v_id) THEN
      RAISE EXCEPTION 'Add at least one PO line with a quantity';
    END IF;

    -- purchase_order_id is kept only when the container carries a single PO.
    UPDATE public.import_containers c
    SET purchase_order_id = (
      SELECT CASE WHEN count(DISTINCT i.purchase_order_id) = 1 THEN (array_agg(i.purchase_order_id))[1] END
      FROM public.container_materials m
      JOIN public.purchase_order_items i ON i.id = m.purchase_order_item_id
      WHERE m.container_id = v_id)
    WHERE c.id = v_id;
  END IF;

  RETURN v_id;
END $$;

-- 3. Move a container to a stage ----------------------------------------------
-- Forward any number of stages (the date is recorded against the stage reached),
-- or back one stage to undo a mistake (the date of the stage left is cleared).
CREATE OR REPLACE FUNCTION public.container_set_stage(p_id uuid, p_stage public.container_status, p_date date DEFAULT NULL)
RETURNS public.container_status LANGUAGE plpgsql SET search_path = public AS $$
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

  -- The date column of the stage being entered (forward) or left (back).
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
  RETURN p_stage;
END $$;

REVOKE ALL ON FUNCTION public.container_save(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.container_set_stage(uuid, public.container_status, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.container_save(uuid, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.container_set_stage(uuid, public.container_status, date) TO authenticated, service_role;

-- 4. Every line of every approved import PO: ordered, in containers, received --
CREATE OR REPLACE VIEW public.import_po_lines WITH (security_invoker = true) AS
SELECT i.id AS po_item_id,
       po.id AS purchase_order_id,
       po.po_number,
       po.po_date,
       po.status::text AS po_status,
       po.plant_id,
       po.vendor_id,
       v.name AS vendor_name,
       po.origin_country,
       po.currency,
       po.promised_loading_date,
       po.promised_delivery_date,
       i.part_id,
       p.part_code,
       p.name AS part_name,
       p.uom,
       i.quantity AS ordered,
       i.received_quantity AS received,
       coalesce(l.loaded, 0) AS loaded,
       greatest(i.quantity - coalesce(l.loaded, 0), 0) AS to_load,
       coalesce(l.on_the_way, 0) AS on_the_way
FROM public.purchase_orders po
JOIN public.purchase_order_items i ON i.purchase_order_id = po.id
JOIN public.parts p ON p.id = i.part_id
JOIN public.vendors v ON v.id = po.vendor_id
LEFT JOIN LATERAL (
  SELECT sum(m.quantity) AS loaded,
         sum(m.quantity) FILTER (WHERE c.current_status <> 'AT_FACTORY') AS on_the_way
  FROM public.container_materials m
  JOIN public.import_containers c ON c.id = m.container_id
  WHERE m.purchase_order_item_id = i.id
) l ON true
WHERE po.is_import AND po.status IN ('APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED');

REVOKE ALL ON public.import_po_lines FROM PUBLIC, anon;
GRANT SELECT ON public.import_po_lines TO authenticated, service_role;

COMMENT ON VIEW public.import_po_lines IS 'One row per line of an approved import PO: ordered, loaded into containers, still on the way, received.';
COMMENT ON COLUMN public.container_materials.purchase_order_item_id IS 'The PO line this container line carries.';
