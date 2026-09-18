-- Serial numbers: the range assigned, and the units within it.
--
-- production_serial_numbers holds one row per unit (production_order_id,
-- serial_number, status). The PPC screen assigns a RANGE - start, end, quantity,
-- who assigned it and when - and inserted all of that into that table. None of
-- those are columns there, so assigning serial numbers failed every time, and the
-- PPC Serial Number Assignment screen has never worked.
--
-- Rather than bend the per-unit table into holding a range, the two ideas get one
-- table each. The assignment is the plan; the per-unit rows are what came off the
-- line. That also means the per-unit rows can carry their own status later (built,
-- dispatched, returned) without disturbing the assignment they came from.

CREATE TABLE public.serial_number_assignments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id               uuid NOT NULL REFERENCES public.plants(id),
  production_order_id    uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,

  starting_serial_number text NOT NULL,
  ending_serial_number   text NOT NULL,
  quantity               numeric NOT NULL CHECK (quantity > 0),

  status                 text NOT NULL DEFAULT 'ASSIGNED'
                           CHECK (status IN ('ASSIGNED', 'CONFIRMED', 'CANCELLED')),
  notes                  text,

  assigned_by            uuid,
  assigned_at            timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- One live assignment per voucher. A second range against the same voucher leaves
-- two answers to "which serials are these" and no way to choose between them.
CREATE UNIQUE INDEX serial_assignment_one_live_per_order
  ON public.serial_number_assignments (production_order_id)
  WHERE status <> 'CANCELLED';

CREATE INDEX serial_assignment_plant_idx
  ON public.serial_number_assignments (plant_id, status);

ALTER TABLE public.serial_number_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY serial_assignment_read ON public.serial_number_assignments
  FOR SELECT TO authenticated USING (public.in_plant(plant_id));

CREATE POLICY serial_assignment_write ON public.serial_number_assignments
  FOR ALL TO authenticated
  USING (public.in_plant(plant_id) AND public.has_role('ppc'))
  WITH CHECK (public.in_plant(plant_id) AND public.has_role('ppc'));

CREATE TRIGGER trg_serial_assignment_touch
  BEFORE UPDATE ON public.serial_number_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- plant_id is derived from the voucher rather than sent by the browser: it is not
-- a free choice, and letting the client pick it is how rows end up in the wrong
-- plant.
CREATE OR REPLACE FUNCTION public.set_serial_assignment_plant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT plant_id INTO NEW.plant_id
    FROM public.production_orders WHERE id = NEW.production_order_id;
  IF NEW.plant_id IS NULL THEN
    RAISE EXCEPTION 'Production order not found';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_serial_assignment_plant
  BEFORE INSERT ON public.serial_number_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_serial_assignment_plant();
