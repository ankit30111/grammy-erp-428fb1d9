-- Remove the trigger that auto-generates material codes
DROP TRIGGER IF EXISTS set_material_code_trigger ON raw_materials;

-- The material_code column should remain with a UNIQUE constraint
-- which already exists, so no changes needed to the table structure