-- A part is bought in one unit and, if ticked, consumed in another.
--
--   parts.uom             the consumed unit: stock, every BOM, kits, issues
--   parts.purchase_uom    the purchased unit, only when it differs (KG, ROLL...)
--   parts.purchase_factor how many consumed units one purchased unit is (1 KG = 250 PCS)
--
-- When the consumed unit of a part changes, everything held in the old unit is
-- converted, so no figure is ever read in the wrong unit:
--   * related units (MM <-> METER, GRAM <-> KG): by their fixed factor
--   * ticking "consumed in a different unit" (bought KG, now consumed PCS):
--     by the factor entered (x 250)
--   * unticking it (back to KG): by 1 / the old factor
-- Converted: BOM quantities, the purchase factor (when it was not edited at the
-- same time), active stock holds, and stock - stock by a pair of UNIT_CONVERSION
-- ledger rows per location, so the ledger still explains every balance.
-- A change with no known conversion (PCS -> SHEET) is refused while the part has stock.

CREATE OR REPLACE FUNCTION public.part_unit_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE f numeric; v_old text := coalesce(OLD.uom, 'PCS'); v_new text := coalesce(NEW.uom, 'PCS');
  v_was text; b record; v_has_stock boolean;
BEGIN
  IF v_old = v_new THEN RETURN NEW; END IF;

  f := public.unit_factor(v_old, v_new);                 -- 1 old unit = f new units
  IF f IS NULL AND upper(coalesce(NEW.purchase_uom, '')) = upper(v_old) AND coalesce(NEW.purchase_factor, 0) > 0 THEN
    f := NEW.purchase_factor;                            -- ticked: bought in old unit, consumed in new
  ELSIF f IS NULL AND upper(coalesce(OLD.purchase_uom, '')) = upper(v_new) AND coalesce(OLD.purchase_factor, 0) > 0 THEN
    f := 1 / OLD.purchase_factor;                        -- unticked: back to the bought unit
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.stock_balance WHERE part_id = NEW.id AND quantity <> 0) INTO v_has_stock;
  IF f IS NULL THEN
    IF v_has_stock THEN
      RAISE EXCEPTION '% has stock counted in %, and % cannot be converted into %. Tick "Consumed in a different unit" and give the conversion, or change the unit when its stock is zero.',
        NEW.part_code, v_old, v_old, v_new;
    END IF;
    RETURN NEW;   -- nothing in stock; BOM quantities have to be re-entered
  END IF;
  IF f = 1 THEN RETURN NEW; END IF;

  -- Related-unit change with the factor left as it was: 1 ROLL = 22000 MM -> 22 METER.
  IF public.unit_factor(v_old, v_new) IS NOT NULL
     AND NEW.purchase_uom IS NOT NULL AND NEW.purchase_factor IS NOT DISTINCT FROM OLD.purchase_factor THEN
    NEW.purchase_factor := trim_scale(OLD.purchase_factor * f);
  END IF;

  v_was := current_setting('app.brand_sync', true);
  PERFORM set_config('app.brand_sync', 'on', true);
  UPDATE public.bom SET quantity = trim_scale(quantity * f) WHERE child_part_id = NEW.id AND quantity IS NOT NULL;
  PERFORM set_config('app.brand_sync', coalesce(v_was, ''), true);

  UPDATE public.stock_holds SET quantity = trim_scale(quantity * f), updated_at = now()
   WHERE part_id = NEW.id AND status = 'ACTIVE';

  FOR b IN SELECT plant_id, location_id, quantity FROM public.stock_balance WHERE part_id = NEW.id AND quantity <> 0 LOOP
    INSERT INTO public.stock_ledger (plant_id, part_id, location_id, qty_delta, balance_after, movement_type,
                                     reason_code, reference_type, notes, created_by)
    VALUES (b.plant_id, NEW.id, b.location_id, -b.quantity, 0, 'UNIT_CONVERSION', 'UNIT_CHANGED', 'PART_UNIT',
            format('%s %s out: unit changed from %s to %s', b.quantity, v_old, v_old, v_new), auth.uid()),
           (b.plant_id, NEW.id, b.location_id, trim_scale(b.quantity * f), trim_scale(b.quantity * f), 'UNIT_CONVERSION', 'UNIT_CHANGED', 'PART_UNIT',
            format('%s %s in: %s %s at 1 %s = %s %s', trim_scale(b.quantity * f), v_new, b.quantity, v_old, v_old, trim_scale(f), v_new), auth.uid());
  END LOOP;
  RETURN NEW;
END $function$;
