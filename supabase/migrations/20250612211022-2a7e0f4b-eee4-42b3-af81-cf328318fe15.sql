
-- Fix the material_movements_movement_type_check constraint to allow all required movement types
ALTER TABLE material_movements DROP CONSTRAINT IF EXISTS material_movements_movement_type_check;

-- Add updated constraint with all necessary movement types
ALTER TABLE material_movements ADD CONSTRAINT material_movements_movement_type_check 
CHECK (movement_type IN (
  'ISSUED_TO_PRODUCTION',
  'PRODUCTION_RETURN', 
  'PRODUCTION_FEEDBACK_RETURN',
  'GRN_RECEIPT',
  'STOCK_ADJUSTMENT',
  'STOCK_RECONCILIATION',
  'INVENTORY_DEDUCTION',
  'INVENTORY_ADDITION'
));

-- Ensure the log_production_dispatch trigger is properly configured
DROP TRIGGER IF EXISTS log_inventory_movements_trigger ON public.inventory;
CREATE TRIGGER log_inventory_movements_trigger
  AFTER UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.log_production_dispatch();
