
-- Create a default system user ID for operations that need a user reference
INSERT INTO user_accounts (id, username, email, full_name, role, is_active, password_hash) 
VALUES ('00000000-0000-0000-0000-000000000001', 'system', 'system@grammy.com', 'System User', 'admin', true, 'system_user_no_password')
ON CONFLICT (id) DO NOTHING;

-- Update existing records to use system user where user fields are null
UPDATE material_requests SET requested_by = '00000000-0000-0000-0000-000000000001' WHERE requested_by IS NULL;
UPDATE material_requests SET approved_by = '00000000-0000-0000-0000-000000000001' WHERE approved_by IS NULL;

-- Remove foreign key constraints that require user authentication
ALTER TABLE material_requests 
DROP CONSTRAINT IF EXISTS material_requests_requested_by_fkey,
DROP CONSTRAINT IF EXISTS material_requests_approved_by_fkey;

-- Update production_orders to remove user constraints
ALTER TABLE production_orders 
DROP CONSTRAINT IF EXISTS production_orders_created_by_fkey;

-- Update other tables to remove user authentication requirements
ALTER TABLE production_schedules 
DROP CONSTRAINT IF EXISTS production_schedules_created_by_fkey;

ALTER TABLE projections 
DROP CONSTRAINT IF EXISTS projections_created_by_fkey;

ALTER TABLE purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;

-- Disable RLS on all tables to allow universal access
ALTER TABLE material_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE projections DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE grn DISABLE ROW LEVEL SECURITY;
ALTER TABLE grn_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE hourly_production DISABLE ROW LEVEL SECURITY;
ALTER TABLE kit_preparation DISABLE ROW LEVEL SECURITY;
ALTER TABLE kit_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE line_rejections DISABLE ROW LEVEL SECURITY;
ALTER TABLE pqc_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_discrepancies DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_material_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE finished_goods_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_complaint_parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE spare_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_discrepancies DISABLE ROW LEVEL SECURITY;
