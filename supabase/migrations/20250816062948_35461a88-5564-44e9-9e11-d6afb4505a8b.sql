-- Fix storage bucket RLS policies for iqc-reports bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('iqc-reports', 'iqc-reports', false)
ON CONFLICT (id) DO UPDATE SET 
  public = false,
  file_size_limit = 52428800, -- 50MB limit
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

-- Create comprehensive RLS policies for iqc-reports bucket
CREATE POLICY "Authenticated users can upload IQC reports"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'iqc-reports' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can view IQC reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'iqc-reports' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update IQC reports"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'iqc-reports' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete IQC reports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'iqc-reports' 
  AND auth.uid() IS NOT NULL
);

-- Ensure iqc_vendor_capa table has proper triggers for CAPA creation
-- This trigger should already exist but let's make sure it works properly
DROP TRIGGER IF EXISTS trigger_create_vendor_capa_and_whatsapp_notification ON grn_items;

CREATE TRIGGER trigger_create_vendor_capa_and_whatsapp_notification
  AFTER UPDATE ON grn_items
  FOR EACH ROW
  WHEN (OLD.iqc_status IS DISTINCT FROM NEW.iqc_status)
  EXECUTE FUNCTION create_vendor_capa_and_whatsapp_notification();