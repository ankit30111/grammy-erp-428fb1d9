
-- Update BOM table to include bom_type categorization
DO $$ 
BEGIN
    -- Create enum for BOM types if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bom_type_enum') THEN
        CREATE TYPE bom_type_enum AS ENUM ('main_assembly', 'sub_assembly', 'accessory');
    END IF;
END $$;

-- Add bom_type column to BOM table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bom' AND column_name = 'bom_type') THEN
        ALTER TABLE bom ADD COLUMN bom_type bom_type_enum NOT NULL DEFAULT 'main_assembly';
    END IF;
END $$;

-- Create production_line_assignments table to track line assignments per production order
CREATE TABLE IF NOT EXISTS production_line_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    bom_category bom_type_enum NOT NULL,
    production_line TEXT NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    assigned_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(production_order_id, bom_category)
);

-- Add RLS policies for production_line_assignments
ALTER TABLE production_line_assignments ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_production_line_assignments_order_id ON production_line_assignments(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_line_assignments_line ON production_line_assignments(production_line);
CREATE INDEX IF NOT EXISTS idx_bom_type ON bom(bom_type);

-- Update existing BOM records with default categorization based on material names/categories
-- This is a simple heuristic - you may want to adjust based on your actual data
UPDATE bom SET bom_type = 'sub_assembly' 
WHERE id IN (
    SELECT b.id FROM bom b 
    JOIN raw_materials rm ON b.raw_material_id = rm.id 
    WHERE LOWER(rm.name) LIKE '%sub%' OR LOWER(rm.category) LIKE '%sub%'
);

UPDATE bom SET bom_type = 'accessory' 
WHERE id IN (
    SELECT b.id FROM bom b 
    JOIN raw_materials rm ON b.raw_material_id = rm.id 
    WHERE LOWER(rm.name) LIKE '%accessory%' OR LOWER(rm.category) IN ('sticker', 'screw', 'packaging')
);
