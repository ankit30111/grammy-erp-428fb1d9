-- Uploads: JPG, PNG and PDF everywhere, no size limit of our own.
-- npd-specifications (R&D product files) took only PDFs up to 10 MB.
-- The project-wide cap (50 MB on the current plan) still applies.
UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL
 WHERE file_size_limit IS NOT NULL OR allowed_mime_types IS NOT NULL;
