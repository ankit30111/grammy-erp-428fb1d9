
-- Per-plant inventory: replace global unique(raw_material_id) with composite (plant_id, raw_material_id)
-- and teach trigger functions to stamp plant_id.

ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_raw_material_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_plant_material_unique
  ON public.inventory (plant_id, raw_material_id);

-- Trigger: GRN store_confirmed -> inventory (now plant-scoped)
CREATE OR REPLACE FUNCTION public.update_inventory_from_grn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_plant_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.store_confirmed = true AND OLD.store_confirmed = false THEN
    SELECT plant_id INTO v_plant_id FROM public.grn WHERE id = NEW.grn_id;
    INSERT INTO public.inventory (raw_material_id, quantity, location, last_updated, plant_id)
    VALUES (NEW.raw_material_id, NEW.accepted_quantity, 'Main Store', NOW(), v_plant_id)
    ON CONFLICT (plant_id, raw_material_id)
    DO UPDATE SET
      quantity = public.inventory.quantity + NEW.accepted_quantity,
      last_updated = NOW();
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger: store physical verification -> inventory (now plant-scoped)
CREATE OR REPLACE FUNCTION public.update_inventory_from_store_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_plant_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND
     NEW.store_physical_quantity IS NOT NULL AND
     OLD.store_physical_quantity IS NULL AND
     NEW.store_confirmed = true THEN

    SELECT plant_id INTO v_plant_id FROM public.grn WHERE id = NEW.grn_id;

    INSERT INTO public.inventory (raw_material_id, quantity, location, last_updated, plant_id)
    VALUES (NEW.raw_material_id, NEW.store_physical_quantity, 'Main Store', NOW(), v_plant_id)
    ON CONFLICT (plant_id, raw_material_id)
    DO UPDATE SET
      quantity = public.inventory.quantity + NEW.store_physical_quantity,
      last_updated = NOW();

    DECLARE
      grn_record RECORD;
    BEGIN
      SELECT grn_number INTO grn_record FROM public.grn WHERE id = NEW.grn_id;

      PERFORM public.log_material_movement(
        NEW.raw_material_id,
        'GRN_RECEIPT',
        NEW.store_physical_quantity,
        NEW.grn_id,
        'GRN',
        grn_record.grn_number,
        'Material received to store after physical verification. IQC Approved: ' || NEW.accepted_quantity || ', Store Verified: ' || NEW.store_physical_quantity
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;
