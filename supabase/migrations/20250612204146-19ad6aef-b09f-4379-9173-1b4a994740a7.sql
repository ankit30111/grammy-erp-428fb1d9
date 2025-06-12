
-- Add new columns to grn_items table for store physical verification
ALTER TABLE public.grn_items 
ADD COLUMN IF NOT EXISTS store_physical_quantity integer,
ADD COLUMN IF NOT EXISTS physical_verification_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS physical_verified_by uuid;

-- Create store_discrepancies table to track quantity differences
CREATE TABLE IF NOT EXISTS public.store_discrepancies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_item_id uuid NOT NULL REFERENCES public.grn_items(id),
  grn_id uuid NOT NULL REFERENCES public.grn(id),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  iqc_accepted_quantity integer NOT NULL,
  store_physical_quantity integer NOT NULL,
  discrepancy_quantity integer NOT NULL,
  discrepancy_type text NOT NULL CHECK (discrepancy_type IN ('SHORTAGE', 'EXCESS')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'CLOSED')),
  reported_by uuid,
  reported_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolution_notes text,
  vendor_notified boolean DEFAULT false,
  vendor_notified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE public.store_discrepancies IS 'Tracks discrepancies between IQC accepted quantities and store physical verification quantities';
COMMENT ON COLUMN public.grn_items.store_physical_quantity IS 'Actual quantity physically verified and counted by store personnel';
COMMENT ON COLUMN public.grn_items.physical_verification_date IS 'Date when store completed physical verification';
COMMENT ON COLUMN public.grn_items.physical_verified_by IS 'Store personnel who performed the physical verification';

-- Create function to automatically create discrepancy records
CREATE OR REPLACE FUNCTION public.create_store_discrepancy()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only create discrepancy if physical quantity differs from accepted quantity
  IF NEW.store_physical_quantity IS NOT NULL AND 
     NEW.accepted_quantity IS NOT NULL AND 
     NEW.store_physical_quantity != NEW.accepted_quantity THEN
    
    INSERT INTO public.store_discrepancies (
      grn_item_id,
      grn_id,
      raw_material_id,
      iqc_accepted_quantity,
      store_physical_quantity,
      discrepancy_quantity,
      discrepancy_type,
      reported_by
    ) VALUES (
      NEW.id,
      NEW.grn_id,
      NEW.raw_material_id,
      NEW.accepted_quantity,
      NEW.store_physical_quantity,
      ABS(NEW.accepted_quantity - NEW.store_physical_quantity),
      CASE 
        WHEN NEW.store_physical_quantity < NEW.accepted_quantity THEN 'SHORTAGE'
        ELSE 'EXCESS'
      END,
      NEW.physical_verified_by
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to automatically create discrepancy records
DROP TRIGGER IF EXISTS create_store_discrepancy_trigger ON public.grn_items;
CREATE TRIGGER create_store_discrepancy_trigger
  AFTER UPDATE ON public.grn_items
  FOR EACH ROW
  WHEN (NEW.store_physical_quantity IS NOT NULL AND OLD.store_physical_quantity IS NULL)
  EXECUTE FUNCTION public.create_store_discrepancy();

-- Update the inventory update function to use store physical quantity
CREATE OR REPLACE FUNCTION public.update_inventory_from_store_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Update inventory when store completes physical verification
  IF TG_OP = 'UPDATE' AND 
     NEW.store_physical_quantity IS NOT NULL AND 
     OLD.store_physical_quantity IS NULL AND
     NEW.store_confirmed = true THEN
    
    -- Update inventory with the actual physically verified quantity
    INSERT INTO inventory (raw_material_id, quantity, location, last_updated)
    VALUES (NEW.raw_material_id, NEW.store_physical_quantity, 'Main Store', NOW())
    ON CONFLICT (raw_material_id)
    DO UPDATE SET 
      quantity = inventory.quantity + NEW.store_physical_quantity,
      last_updated = NOW();
  END IF;
  RETURN NEW;
END;
$function$;

-- Replace the old inventory update trigger
DROP TRIGGER IF EXISTS update_inventory_from_grn_trigger ON public.grn_items;
CREATE TRIGGER update_inventory_from_store_verification_trigger
  AFTER UPDATE ON public.grn_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inventory_from_store_verification();
