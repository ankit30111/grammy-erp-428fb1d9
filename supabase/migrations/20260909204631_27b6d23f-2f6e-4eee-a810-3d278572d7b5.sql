-- 1. stock_locations
CREATE TABLE public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  code text NOT NULL,
  name text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('STORE','STAGING','QUARANTINE')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, code)
);

GRANT SELECT ON public.stock_locations TO authenticated;
GRANT ALL ON public.stock_locations TO service_role;
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_locations select own plants"
  ON public.stock_locations FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR public.auth_user_in_plant(plant_id));

CREATE POLICY "stock_locations admin insert"
  ON public.stock_locations FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_admin());

CREATE POLICY "stock_locations admin update"
  ON public.stock_locations FOR UPDATE TO authenticated
  USING (public.auth_is_admin()) WITH CHECK (public.auth_is_admin());

CREATE POLICY "stock_locations admin delete"
  ON public.stock_locations FOR DELETE TO authenticated
  USING (public.auth_is_admin());

GRANT INSERT, UPDATE, DELETE ON public.stock_locations TO authenticated;

-- seed one MAIN + one QUAR per plant
INSERT INTO public.stock_locations (plant_id, code, name, location_type)
SELECT p.id, 'MAIN', 'Main Store', 'STORE' FROM public.plants p
ON CONFLICT (plant_id, code) DO NOTHING;

INSERT INTO public.stock_locations (plant_id, code, name, location_type)
SELECT p.id, 'QUAR', 'Quarantine', 'QUARANTINE' FROM public.plants p
ON CONFLICT (plant_id, code) DO NOTHING;

-- 2. stock_ledger (append-only)
CREATE TABLE public.stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  location_id uuid NOT NULL REFERENCES public.stock_locations(id),
  qty_delta numeric NOT NULL CHECK (qty_delta <> 0),
  movement_type text NOT NULL CHECK (movement_type IN (
    'RECEIPT','KIT_RETURN','OPENING','ADJUST_IN','KIT_ISSUE','SPARE_ISSUE',
    'REQUEST_ISSUE','ADJUST_OUT','QUAR_IN','QUAR_RELEASE','SCRAP',
    'VENDOR_RETURN','TRANSFER_IN','TRANSFER_OUT')),
  reason_code text,
  reference_type text,
  reference_id uuid,
  reference_number text,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stock_ledger_plant_material_idx ON public.stock_ledger (plant_id, raw_material_id);
CREATE INDEX stock_ledger_reference_idx ON public.stock_ledger (reference_type, reference_id);
CREATE INDEX stock_ledger_created_at_idx ON public.stock_ledger (created_at DESC);

GRANT SELECT ON public.stock_ledger TO authenticated;
GRANT ALL ON public.stock_ledger TO service_role;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_ledger select own plants"
  ON public.stock_ledger FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR public.auth_user_in_plant(plant_id));

CREATE OR REPLACE FUNCTION public.stock_ledger_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'stock_ledger is append-only; post a reversing movement instead';
END;
$$;

CREATE TRIGGER stock_ledger_no_update_delete
  BEFORE UPDATE OR DELETE ON public.stock_ledger
  FOR EACH ROW EXECUTE FUNCTION public.stock_ledger_append_only();

-- 3. stock_balance
CREATE TABLE public.stock_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  location_id uuid NOT NULL REFERENCES public.stock_locations(id),
  quantity numeric NOT NULL DEFAULT 0 CONSTRAINT stock_balance_quantity_non_negative CHECK (quantity >= 0),
  min_stock numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, raw_material_id, location_id)
);

GRANT SELECT ON public.stock_balance TO authenticated;
GRANT ALL ON public.stock_balance TO service_role;
ALTER TABLE public.stock_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_balance select own plants"
  ON public.stock_balance FOR SELECT TO authenticated
  USING (public.auth_is_admin() OR public.auth_user_in_plant(plant_id));

-- 4. single door
CREATE OR REPLACE FUNCTION public.post_stock_movement(
  p_plant_id uuid,
  p_raw_material_id uuid,
  p_location_id uuid,
  p_qty_delta numeric,
  p_movement_type text,
  p_reason_code text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
  v_material_code text;
  v_location_code text;
  v_available numeric;
BEGIN
  IF p_qty_delta IS NULL OR p_qty_delta = 0 THEN
    RAISE EXCEPTION 'Stock movement quantity cannot be zero';
  END IF;

  BEGIN
    INSERT INTO public.stock_balance (plant_id, raw_material_id, location_id, quantity)
    VALUES (p_plant_id, p_raw_material_id, p_location_id, p_qty_delta)
    ON CONFLICT (plant_id, raw_material_id, location_id)
    DO UPDATE SET quantity = public.stock_balance.quantity + p_qty_delta,
                  updated_at = now()
    RETURNING quantity INTO v_new_balance;
  EXCEPTION WHEN check_violation THEN
    SELECT rm.material_code INTO v_material_code
      FROM public.raw_materials rm WHERE rm.id = p_raw_material_id;
    SELECT sl.code INTO v_location_code
      FROM public.stock_locations sl WHERE sl.id = p_location_id;
    SELECT COALESCE(sb.quantity, 0) INTO v_available
      FROM public.stock_balance sb
      WHERE sb.plant_id = p_plant_id
        AND sb.raw_material_id = p_raw_material_id
        AND sb.location_id = p_location_id;
    RAISE EXCEPTION 'Insufficient stock for % at %: requested %, available %',
      COALESCE(v_material_code, p_raw_material_id::text),
      COALESCE(v_location_code, p_location_id::text),
      abs(p_qty_delta),
      COALESCE(v_available, 0);
  END;

  INSERT INTO public.stock_ledger (
    plant_id, raw_material_id, location_id, qty_delta, movement_type,
    reason_code, reference_type, reference_id, reference_number, notes, created_by
  ) VALUES (
    p_plant_id, p_raw_material_id, p_location_id, p_qty_delta, p_movement_type,
    p_reason_code, p_reference_type, p_reference_id, p_reference_number, p_notes,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );

  RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_stock_movement(uuid,uuid,uuid,numeric,text,text,text,uuid,text,text) TO authenticated;

-- 5. batch door
CREATE OR REPLACE FUNCTION public.post_stock_movements(p_movements jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m jsonb;
  v_balance numeric;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF p_movements IS NULL OR jsonb_typeof(p_movements) <> 'array' THEN
    RAISE EXCEPTION 'post_stock_movements expects a JSON array of movements';
  END IF;

  FOR m IN SELECT * FROM jsonb_array_elements(p_movements) LOOP
    v_balance := public.post_stock_movement(
      (m->>'plant_id')::uuid,
      (m->>'raw_material_id')::uuid,
      (m->>'location_id')::uuid,
      (m->>'qty_delta')::numeric,
      m->>'movement_type',
      m->>'reason_code',
      m->>'reference_type',
      NULLIF(m->>'reference_id','')::uuid,
      m->>'reference_number',
      m->>'notes'
    );
    v_results := v_results || jsonb_build_object(
      'raw_material_id', m->>'raw_material_id',
      'location_id', m->>'location_id',
      'new_balance', v_balance
    );
  END LOOP;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_stock_movements(jsonb) TO authenticated;

-- 6. reconciliation view
CREATE VIEW public.stock_balance_check
WITH (security_invoker = true)
AS
SELECT
  sb.plant_id,
  sb.raw_material_id,
  sb.location_id,
  sb.quantity AS balance_quantity,
  COALESCE(l.ledger_quantity, 0) AS ledger_quantity,
  sb.quantity - COALESCE(l.ledger_quantity, 0) AS difference
FROM public.stock_balance sb
LEFT JOIN (
  SELECT plant_id, raw_material_id, location_id, SUM(qty_delta) AS ledger_quantity
  FROM public.stock_ledger
  GROUP BY plant_id, raw_material_id, location_id
) l
  ON l.plant_id = sb.plant_id
 AND l.raw_material_id = sb.raw_material_id
 AND l.location_id = sb.location_id;

GRANT SELECT ON public.stock_balance_check TO authenticated;
GRANT SELECT ON public.stock_balance_check TO service_role;