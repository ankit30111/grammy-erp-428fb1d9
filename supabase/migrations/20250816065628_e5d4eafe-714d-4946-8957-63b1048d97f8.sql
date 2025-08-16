-- Add RLS policies for grn and grn_items tables

-- Enable RLS on grn table if not already enabled
ALTER TABLE grn ENABLE ROW LEVEL SECURITY;

-- Enable RLS on grn_items table if not already enabled  
ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for grn table
DROP POLICY IF EXISTS "Allow authenticated users to view grn" ON grn;
CREATE POLICY "Allow authenticated users to view grn" 
ON grn FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update grn" ON grn;
CREATE POLICY "Allow authenticated users to update grn" 
ON grn FOR UPDATE 
TO authenticated 
USING (true);

-- Add RLS policies for grn_items table
DROP POLICY IF EXISTS "Allow authenticated users to view grn_items" ON grn_items;
CREATE POLICY "Allow authenticated users to view grn_items" 
ON grn_items FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update grn_items" ON grn_items;
CREATE POLICY "Allow authenticated users to update grn_items" 
ON grn_items FOR UPDATE 
TO authenticated 
USING (true);

-- Ensure required columns exist on grn_items
DO $$ 
BEGIN
    -- Check and add iqc_report_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'grn_items' AND column_name = 'iqc_report_url') THEN
        ALTER TABLE grn_items ADD COLUMN iqc_report_url text;
    END IF;
    
    -- Check and add accepted_quantity if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'grn_items' AND column_name = 'accepted_quantity') THEN
        ALTER TABLE grn_items ADD COLUMN accepted_quantity integer DEFAULT 0;
    END IF;
    
    -- Check and add rejected_quantity if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'grn_items' AND column_name = 'rejected_quantity') THEN
        ALTER TABLE grn_items ADD COLUMN rejected_quantity integer DEFAULT 0;
    END IF;
END $$;