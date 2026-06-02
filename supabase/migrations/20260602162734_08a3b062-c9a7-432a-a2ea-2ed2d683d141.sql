
DO $$
DECLARE
  ge_id uuid;
  t text;
  tables text[] := ARRAY[
    'inventory','grn','grn_items','purchase_orders',
    'production_schedules','production_orders',
    'production_material_receipts','production_discrepancies',
    'material_movements','material_requests',
    'store_discrepancies','iqc_vendor_capa',
    'dispatch_orders','spare_orders'
  ];
BEGIN
  SELECT id INTO ge_id FROM public.plants WHERE code='GE';
  IF ge_id IS NULL THEN
    RAISE EXCEPTION 'Grammy Electronics plant (code GE) not found';
  END IF;

  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS plant_id uuid REFERENCES public.plants(id)', t);
    EXECUTE format('UPDATE public.%I SET plant_id = %L WHERE plant_id IS NULL', t, ge_id);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(plant_id)', 'idx_'||t||'_plant_id', t);
  END LOOP;
END $$;
