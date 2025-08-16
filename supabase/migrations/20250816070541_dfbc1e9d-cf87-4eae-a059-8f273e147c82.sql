
-- 1) Drop the failing WhatsApp trigger and function that require missing pg_net extension
DROP TRIGGER IF EXISTS trigger_create_vendor_capa_and_whatsapp_notification ON public.grn_items;

DROP FUNCTION IF EXISTS public.create_vendor_capa_and_whatsapp_notification();

-- 2) Ensure CAPA creation still happens via the safe trigger/function
-- Create the function if it doesn't exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_vendor_capa_on_iqc_status'
  ) THEN
    CREATE OR REPLACE FUNCTION public.create_vendor_capa_on_iqc_status()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $f$
    BEGIN
      IF (NEW.iqc_status IN ('REJECTED', 'SEGREGATED') AND 
          (OLD.iqc_status IS DISTINCT FROM NEW.iqc_status) AND
          NOT EXISTS (SELECT 1 FROM iqc_vendor_capa WHERE grn_item_id = NEW.id)) THEN
        
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
      END IF;
      RETURN NEW;
    END;
    $f$;
  END IF;
END
$$;

-- Create the CAPA trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'grn_items'
      AND t.tgname = 'trigger_create_vendor_capa'
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER trigger_create_vendor_capa
      AFTER UPDATE ON public.grn_items
      FOR EACH ROW
      EXECUTE FUNCTION public.create_vendor_capa_on_iqc_status();
  END IF;
END
$$;
