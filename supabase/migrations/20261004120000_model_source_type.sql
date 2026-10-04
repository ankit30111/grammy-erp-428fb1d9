-- A model (JA-006) is the product's identity: category + number, no brand.
-- It sits in parts beside its brand codes (JA-006-PH), but is never built,
-- stocked or scheduled, so it gets its own source type.
ALTER TYPE public.part_source_type ADD VALUE IF NOT EXISTS 'MODEL';
