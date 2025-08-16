
-- 1) Fix CAPA creation function: set proper search_path and schema-qualify tables
CREATE OR REPLACE FUNCTION public.create_vendor_capa_on_iqc_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only create CAPA if status changed to REJECTED or SEGREGATED and no CAPA exists yet
  IF (NEW.iqc_status IN ('REJECTED', 'SEGREGATED')
      AND (OLD.iqc_status IS DISTINCT FROM NEW.iqc_status)
      AND NOT EXISTS (
        SELECT 1 FROM public.iqc_vendor_capa 
        WHERE grn_item_id = NEW.id
      )) THEN
    
    INSERT INTO public.iqc_vendor_capa (
      grn_item_id,
      vendor_id,
      initiated_by,
      capa_status,
      remarks
    )
    SELECT 
      NEW.id,
      g.vendor_id,
      NEW.iqc_completed_by,
      'AWAITED',
      'CAPA required for ' || NEW.iqc_status || ' material: ' || rm.name
    FROM public.grn g
    JOIN public.raw_materials rm ON rm.id = NEW.raw_material_id
    WHERE g.id = NEW.grn_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure the CAPA trigger exists on grn_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE event_object_table = 'grn_items'
      AND trigger_name = 'trigger_create_vendor_capa'
  ) THEN
    CREATE TRIGGER trigger_create_vendor_capa
      AFTER UPDATE ON public.grn_items
      FOR EACH ROW
      WHEN (OLD.iqc_status IS DISTINCT FROM NEW.iqc_status)
      EXECUTE FUNCTION public.create_vendor_capa_on_iqc_status();
  END IF;
END $$;

-- 2) Allow authenticated users to upload to the private "iqc-reports" bucket (keep it private)
-- Ensure bucket exists (no-op if it already does)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'iqc-reports') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('iqc-reports', 'iqc-reports', false);
  END IF;
END $$;

-- Create Storage RLS policies for uploads (drop if previously created with same names)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'iqc-reports-insert') THEN
    EXECUTE 'DROP POLICY "iqc-reports-insert" ON storage.objects';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'iqc-reports-select') THEN
    EXECUTE 'DROP POLICY "iqc-reports-select" ON storage.objects';
  END IF;
END $$;

-- Allow authenticated users to INSERT into iqc-reports
CREATE POLICY "iqc-reports-insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'iqc-reports');

-- (Optional) Allow authenticated users to SELECT IQC reports (if you want in-app listing without signed URLs)
-- Otherwise you can rely on signed URLs.
CREATE POLICY "iqc-reports-select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'iqc-reports');

-- 3) Purge WhatsApp-related DB objects

-- Drop WhatsApp-related trigger/function (in case any remnants remain)
DROP TRIGGER IF EXISTS trigger_create_vendor_capa_and_whatsapp_notification ON public.grn_items;
DROP FUNCTION IF EXISTS public.create_vendor_capa_and_whatsapp_notification();

-- Drop WhatsApp-related columns from grn_items
ALTER TABLE public.grn_items
  DROP COLUMN IF EXISTS whatsapp_notification_sent,
  DROP COLUMN IF EXISTS whatsapp_notification_sent_at;

-- Drop WhatsApp-related columns from vendors (only if present)
ALTER TABLE public.vendors
  DROP COLUMN IF EXISTS whatsapp_notifications_enabled,
  DROP COLUMN IF EXISTS whatsapp_number;

-- Drop WhatsApp-related tables if they exist
DROP TABLE IF EXISTS public.whatsapp_notifications CASCADE;
DROP TABLE IF EXISTS public.whatsapp_replies CASCADE;
