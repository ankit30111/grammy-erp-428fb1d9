-- Complete fix for projection deletion - Update all production_orders foreign key constraints to CASCADE DELETE
-- This ensures complete cascade deletion chain: projections -> production_schedules -> production_orders -> all child tables

-- 1. Fix kit_preparation constraint
ALTER TABLE kit_preparation 
DROP CONSTRAINT IF EXISTS kit_preparation_production_order_id_fkey;

ALTER TABLE kit_preparation 
ADD CONSTRAINT kit_preparation_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE CASCADE;

-- 2. Fix line_rejections constraint  
ALTER TABLE line_rejections 
DROP CONSTRAINT IF EXISTS line_rejections_production_order_id_fkey;

ALTER TABLE line_rejections 
ADD CONSTRAINT line_rejections_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE CASCADE;

-- 3. Fix finished_goods_inventory constraint
ALTER TABLE finished_goods_inventory 
DROP CONSTRAINT IF EXISTS finished_goods_inventory_production_order_id_fkey;

ALTER TABLE finished_goods_inventory 
ADD CONSTRAINT finished_goods_inventory_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE CASCADE;

-- 4. Fix material_requests constraint
ALTER TABLE material_requests 
DROP CONSTRAINT IF EXISTS material_requests_production_order_id_fkey;

ALTER TABLE material_requests 
ADD CONSTRAINT material_requests_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE CASCADE;

-- 5. Fix pqc_reports constraint
ALTER TABLE pqc_reports 
DROP CONSTRAINT IF EXISTS pqc_reports_production_order_id_fkey;

ALTER TABLE pqc_reports 
ADD CONSTRAINT pqc_reports_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE CASCADE;

-- 6. Fix hourly_production constraint
ALTER TABLE hourly_production 
DROP CONSTRAINT IF EXISTS fk_hourly_production_order;

ALTER TABLE hourly_production 
ADD CONSTRAINT fk_hourly_production_order 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE CASCADE;