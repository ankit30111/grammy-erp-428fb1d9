ALTER TABLE public.stock_locations DROP CONSTRAINT IF EXISTS stock_locations_location_type_check;
ALTER TABLE public.stock_locations ADD CONSTRAINT stock_locations_location_type_check
  CHECK (location_type = ANY (ARRAY['STORE'::text, 'STAGING'::text, 'QUARANTINE'::text, 'REJECT'::text]));

INSERT INTO public.stock_locations (plant_id, code, name, location_type)
SELECT p.id, 'REJECT', 'Rejected Material', 'REJECT'
FROM public.plants p
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock_locations sl
  WHERE sl.plant_id = p.id AND sl.code = 'REJECT'
);