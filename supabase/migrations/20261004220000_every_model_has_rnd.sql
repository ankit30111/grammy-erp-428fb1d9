-- Every model is an R&D product, whichever side created it. The Models page,
-- a new finished-good code on a new number, or R&D itself: the model and its
-- R&D product are made together and linked, so R&D owns its versions (ECNs)
-- from the start and there is one list of products, not two.
CREATE OR REPLACE FUNCTION public.model_needs_rnd()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NEW.source_type = 'MODEL' AND NEW.plm_product_id IS NULL THEN
    -- plm_product_model links the model back to the new product.
    INSERT INTO public.plm_products (product_code, name, kind)
    VALUES (NEW.part_code, NEW.name, 'NEW_MODEL');
  END IF;
  RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS trg_model_needs_rnd ON public.parts;
CREATE TRIGGER trg_model_needs_rnd AFTER INSERT ON public.parts
  FOR EACH ROW EXECUTE FUNCTION public.model_needs_rnd();

-- Today's models: they are already in production, so their R&D products start
-- released (stage 6), with the gates recorded as passed before R&D tracking.
DO $$
DECLARE m record; v_id uuid;
BEGIN
  FOR m IN SELECT id, part_code, name FROM public.parts WHERE source_type = 'MODEL' AND plm_product_id IS NULL LOOP
    INSERT INTO public.plm_products (product_code, name, kind) VALUES (m.part_code, m.name, 'NEW_MODEL') RETURNING id INTO v_id;
    INSERT INTO public.plm_gates (product_id, gate, how, note)
    SELECT v_id, g, 'IMPORTED', 'In production before R&D tracking' FROM generate_series(1, 5) g;
    PERFORM public.plm_refresh(v_id);
  END LOOP;
END $$;
