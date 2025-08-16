-- Remove the failing WhatsApp trigger and function that's blocking IQC completion
-- This will allow IQC completion to work while keeping CAPA creation intact

-- Drop the failing WhatsApp notification trigger
DROP TRIGGER IF EXISTS trigger_create_vendor_capa_and_whatsapp_notification ON grn_items;

-- Drop the failing WhatsApp notification function
DROP FUNCTION IF EXISTS public.create_vendor_capa_and_whatsapp_notification();

-- Ensure the main CAPA creation trigger still exists and works
-- This trigger should already exist and work properly
DO $$ 
BEGIN
    -- Check if the main CAPA trigger exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_create_vendor_capa' 
        AND event_object_table = 'grn_items'
    ) THEN
        -- Create the main CAPA creation trigger if it doesn't exist
        CREATE TRIGGER trigger_create_vendor_capa
            AFTER UPDATE ON grn_items
            FOR EACH ROW
            EXECUTE FUNCTION create_vendor_capa_on_iqc_status();
    END IF;
END $$;