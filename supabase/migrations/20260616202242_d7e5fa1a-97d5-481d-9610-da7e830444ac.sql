
-- Drop the legacy trigger that double-counts inventory on store receipt.
-- The store_verification trigger remains as the single source of truth.
DROP TRIGGER IF EXISTS trigger_update_inventory_from_grn ON public.grn_items;

-- Correct the one known double-counted row (B-075 in the reported plant): 1499 -> 749
UPDATE public.inventory
SET quantity = 749, last_updated = NOW()
WHERE raw_material_id = 'e52bb69b-2348-48f5-ba8a-22888720fc2a'
  AND plant_id = 'dfb1df59-e77f-46a7-9b9e-0f9d13c01e25'
  AND quantity = 1499;
