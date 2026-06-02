ALTER TABLE public.production_lines
  ADD COLUMN IF NOT EXISTS location_building text,
  ADD COLUMN IF NOT EXISTS location_floor text,
  ADD COLUMN IF NOT EXISTS location_bay text;