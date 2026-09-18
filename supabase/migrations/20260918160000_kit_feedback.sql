-- Production feedback on a kit, and the store's decision on it.
--
-- The old production_material_discrepancies table was dropped in the rebuild with
-- no replacement, so the Store > Production Feedback tab had nowhere to read from.
-- This is the flow Ankit described:
--
--   store issues a kit  ->  production counts what actually arrived  ->  production
--   raises feedback saying they got more or less  ->  the store accepts or rejects
--   it  ->  only on acceptance does main-store stock move.
--
-- Two properties this table is built around:
--
-- 1. Feedback is a CLAIM, not a stock movement. Raising it changes no balance. The
--    store accepting it is what posts to the ledger. Production must not be able to
--    move stock by asserting a number, and the store must not silently overwrite
--    what production reported.
--
-- 2. The posting is recorded on the row (resolved_at / resolved_by), so the ledger
--    entry and the decision that caused it can always be tied together. A stock
--    correction whose reason cannot be traced is how the old system lost trust.

CREATE TYPE public.kit_feedback_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE public.kit_feedback (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id            uuid NOT NULL REFERENCES public.plants(id),
  kit_item_id         uuid NOT NULL REFERENCES public.kit_items(id) ON DELETE CASCADE,
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  part_id             uuid NOT NULL REFERENCES public.parts(id),

  -- What the store recorded as issued, captured at the moment feedback is raised so
  -- later edits to the kit cannot rewrite what the dispute was about.
  issued_quantity     numeric NOT NULL CHECK (issued_quantity >= 0),
  -- What production says actually arrived.
  received_quantity   numeric NOT NULL CHECK (received_quantity >= 0),
  -- Positive = production got more than issued, negative = short.
  variance            numeric GENERATED ALWAYS AS (received_quantity - issued_quantity) STORED,

  reason              text,
  status              public.kit_feedback_status NOT NULL DEFAULT 'PENDING',

  raised_by           uuid,
  raised_at           timestamptz NOT NULL DEFAULT now(),
  resolved_by         uuid,
  resolved_at         timestamptz,
  store_remarks       text,
  -- The ledger row the acceptance produced, so the correction is traceable.
  stock_ledger_id     uuid REFERENCES public.stock_ledger(id),

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- A resolved row must say who resolved it and when.
  CONSTRAINT kit_feedback_resolution_complete CHECK (
    (status = 'PENDING' AND resolved_at IS NULL AND resolved_by IS NULL)
    OR (status <> 'PENDING' AND resolved_at IS NOT NULL)
  )
);

-- One open dispute per kit line. Raising a second while the first is unresolved
-- would leave the store two numbers for the same line and no way to choose.
CREATE UNIQUE INDEX kit_feedback_one_open_per_item
  ON public.kit_feedback (kit_item_id) WHERE status = 'PENDING';

CREATE INDEX kit_feedback_status_idx ON public.kit_feedback (status, plant_id);
CREATE INDEX kit_feedback_order_idx  ON public.kit_feedback (production_order_id);

ALTER TABLE public.kit_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY kit_feedback_read ON public.kit_feedback
  FOR SELECT TO authenticated USING (public.in_plant(plant_id));

-- Production raises it.
CREATE POLICY kit_feedback_raise ON public.kit_feedback
  FOR INSERT TO authenticated
  WITH CHECK (public.in_plant(plant_id) AND public.has_role('production') AND status = 'PENDING');

-- The store resolves it. Production cannot accept its own claim.
CREATE POLICY kit_feedback_resolve ON public.kit_feedback
  FOR UPDATE TO authenticated
  USING (public.in_plant(plant_id) AND public.has_role('store'))
  WITH CHECK (public.in_plant(plant_id) AND public.has_role('store'));

CREATE TRIGGER trg_kit_feedback_touch
  BEFORE UPDATE ON public.kit_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Accepting feedback is the only thing that moves stock.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_kit_feedback(
  p_feedback_id uuid,
  p_remarks     text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f           public.kit_feedback%ROWTYPE;
  v_main      uuid;
  v_ledger_id uuid;
BEGIN
  SELECT * INTO f FROM public.kit_feedback WHERE id = p_feedback_id FOR UPDATE;
  IF f.id IS NULL THEN
    RAISE EXCEPTION 'Feedback not found';
  END IF;
  IF f.status <> 'PENDING' THEN
    RAISE EXCEPTION 'This feedback has already been %', lower(f.status::text);
  END IF;

  -- SECURITY DEFINER bypasses RLS, so authorisation is checked explicitly.
  IF NOT (public.in_plant(f.plant_id) AND public.has_role('store')) THEN
    RAISE EXCEPTION 'Only the store can accept kit feedback';
  END IF;

  SELECT id INTO v_main FROM public.stock_locations
   WHERE plant_id = f.plant_id AND code = 'MAIN' AND is_active;
  IF v_main IS NULL THEN
    RAISE EXCEPTION 'Main store location is not configured for this plant';
  END IF;

  -- Production received LESS than issued: the missing quantity never reached them,
  -- so it is still the store's to account for - stock comes back in.
  -- Production received MORE: the store issued more than it recorded, so stock goes out.
  -- Either way the correction is the variance, and zero variance posts nothing
  -- (the ledger rejects a zero delta anyway).
  IF f.variance <> 0 THEN
    INSERT INTO public.stock_ledger (
      plant_id, part_id, location_id, qty_delta, movement_type, reason_code,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      f.plant_id, f.part_id, v_main, -f.variance, 'ADJUSTMENT', 'KIT_FEEDBACK_ACCEPTED',
      'KIT_FEEDBACK', f.id,
      format('Kit feedback accepted: issued %s, production received %s',
             f.issued_quantity, f.received_quantity),
      auth.uid()
    ) RETURNING id INTO v_ledger_id;
  END IF;

  -- The kit line now carries what production actually received.
  UPDATE public.kit_items SET received_quantity = f.received_quantity, updated_at = now()
   WHERE id = f.kit_item_id;

  UPDATE public.kit_feedback
     SET status = 'ACCEPTED', resolved_by = auth.uid(), resolved_at = now(),
         store_remarks = p_remarks, stock_ledger_id = v_ledger_id, updated_at = now()
   WHERE id = p_feedback_id;

  RETURN v_ledger_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_kit_feedback(
  p_feedback_id uuid,
  p_remarks     text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.kit_feedback%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.kit_feedback WHERE id = p_feedback_id FOR UPDATE;
  IF f.id IS NULL THEN RAISE EXCEPTION 'Feedback not found'; END IF;
  IF f.status <> 'PENDING' THEN
    RAISE EXCEPTION 'This feedback has already been %', lower(f.status::text);
  END IF;
  IF NOT (public.in_plant(f.plant_id) AND public.has_role('store')) THEN
    RAISE EXCEPTION 'Only the store can reject kit feedback';
  END IF;
  IF coalesce(btrim(p_remarks), '') = '' THEN
    -- A rejection with no reason is how disputes become arguments.
    RAISE EXCEPTION 'Give a reason when rejecting production feedback';
  END IF;

  UPDATE public.kit_feedback
     SET status = 'REJECTED', resolved_by = auth.uid(), resolved_at = now(),
         store_remarks = p_remarks, updated_at = now()
   WHERE id = p_feedback_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_kit_feedback(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_kit_feedback(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_kit_feedback(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_kit_feedback(uuid, text) TO authenticated;
