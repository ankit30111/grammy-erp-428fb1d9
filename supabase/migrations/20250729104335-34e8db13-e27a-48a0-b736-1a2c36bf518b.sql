-- Add WhatsApp notification fields to grn_items table
ALTER TABLE public.grn_items 
ADD COLUMN iqc_report_url TEXT,
ADD COLUMN whatsapp_notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN whatsapp_notification_sent_at TIMESTAMP WITH TIME ZONE;

-- Add WhatsApp fields to vendors table
ALTER TABLE public.vendors 
ADD COLUMN whatsapp_number TEXT,
ADD COLUMN whatsapp_notifications_enabled BOOLEAN DEFAULT TRUE;

-- Create iqc-reports storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('iqc-reports', 'iqc-reports', false);

-- Create storage policies for iqc-reports bucket
CREATE POLICY "Authenticated users can upload IQC reports" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'iqc-reports' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view IQC reports" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'iqc-reports' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete IQC reports" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'iqc-reports' AND auth.role() = 'authenticated');

-- Create whatsapp_notifications tracking table
CREATE TABLE public.whatsapp_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_item_id UUID NOT NULL REFERENCES public.grn_items(id),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  message_content TEXT NOT NULL,
  file_url TEXT,
  whatsapp_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on whatsapp_notifications
ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for whatsapp_notifications
CREATE POLICY "Authenticated users can view whatsapp notifications" 
ON public.whatsapp_notifications 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert whatsapp notifications" 
ON public.whatsapp_notifications 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update whatsapp notifications" 
ON public.whatsapp_notifications 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Create trigger for updated_at on whatsapp_notifications
CREATE TRIGGER update_whatsapp_notifications_updated_at
  BEFORE UPDATE ON public.whatsapp_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update the existing trigger to call WhatsApp notification function
DROP TRIGGER IF EXISTS trigger_create_vendor_capa_on_iqc_status ON public.grn_items;

-- Create enhanced trigger function for CAPA and WhatsApp notifications
CREATE OR REPLACE FUNCTION public.create_vendor_capa_and_whatsapp_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create CAPA if status changed to REJECTED or SEGREGATED and no CAPA exists yet
  IF (NEW.iqc_status IN ('REJECTED', 'SEGREGATED') AND 
      OLD.iqc_status != NEW.iqc_status AND
      NOT EXISTS (
        SELECT 1 FROM iqc_vendor_capa 
        WHERE grn_item_id = NEW.id
      )) THEN
    
    -- Create CAPA record
    INSERT INTO iqc_vendor_capa (
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
    FROM grn g
    JOIN raw_materials rm ON rm.id = NEW.raw_material_id
    WHERE g.id = NEW.grn_id;

    -- Call WhatsApp notification edge function
    PERFORM
      net.http_post(
        url := 'https://oacdhvmpkuadlyvvvbpq.supabase.co/functions/v1/send-whatsapp-iqc-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
          'grn_item_id', NEW.id
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the new trigger
CREATE TRIGGER trigger_create_vendor_capa_and_whatsapp_notification
  AFTER UPDATE ON public.grn_items
  FOR EACH ROW
  EXECUTE FUNCTION public.create_vendor_capa_and_whatsapp_notification();