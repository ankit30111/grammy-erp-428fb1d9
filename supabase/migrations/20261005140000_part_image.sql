-- A photo of the part, kept with its specification sheet and IQC checklist so
-- the person inspecting a delivery can see what the part should look like.
-- Stored like the other part documents: a path in the raw-material-documents
-- bucket (folder images/), opened through a signed URL.
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS image_url text;
COMMENT ON COLUMN public.parts.image_url IS
  'Photo of the part: path in the raw-material-documents bucket (images/...). Optional.';
