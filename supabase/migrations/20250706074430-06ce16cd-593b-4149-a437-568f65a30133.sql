-- Revert CASCADE DELETE constraints to NO ACTION for business logic validation
-- This ensures projections can only be deleted through proper business workflow validation

-- 1. Revert production_schedules constraint to NO ACTION
ALTER TABLE production_schedules 
DROP CONSTRAINT IF EXISTS production_schedules_projection_id_fkey;

ALTER TABLE production_schedules 
ADD CONSTRAINT production_schedules_projection_id_fkey 
FOREIGN KEY (projection_id) 
REFERENCES projections(id) 
ON DELETE NO ACTION;

-- 2. Revert production_orders constraint to NO ACTION  
ALTER TABLE production_orders 
DROP CONSTRAINT IF EXISTS production_orders_production_schedule_id_fkey;

ALTER TABLE production_orders 
ADD CONSTRAINT production_orders_production_schedule_id_fkey 
FOREIGN KEY (production_schedule_id) 
REFERENCES production_schedules(id) 
ON DELETE NO ACTION;

-- 3. Revert all production_orders child table constraints to NO ACTION
ALTER TABLE kit_preparation 
DROP CONSTRAINT IF EXISTS kit_preparation_production_order_id_fkey;
ALTER TABLE kit_preparation 
ADD CONSTRAINT kit_preparation_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE NO ACTION;

ALTER TABLE line_rejections 
DROP CONSTRAINT IF EXISTS line_rejections_production_order_id_fkey;
ALTER TABLE line_rejections 
ADD CONSTRAINT line_rejections_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE NO ACTION;

ALTER TABLE finished_goods_inventory 
DROP CONSTRAINT IF EXISTS finished_goods_inventory_production_order_id_fkey;
ALTER TABLE finished_goods_inventory 
ADD CONSTRAINT finished_goods_inventory_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE NO ACTION;

ALTER TABLE material_requests 
DROP CONSTRAINT IF EXISTS material_requests_production_order_id_fkey;
ALTER TABLE material_requests 
ADD CONSTRAINT material_requests_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE NO ACTION;

ALTER TABLE pqc_reports 
DROP CONSTRAINT IF EXISTS pqc_reports_production_order_id_fkey;
ALTER TABLE pqc_reports 
ADD CONSTRAINT pqc_reports_production_order_id_fkey 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE NO ACTION;

ALTER TABLE hourly_production 
DROP CONSTRAINT IF EXISTS fk_hourly_production_order;
ALTER TABLE hourly_production 
ADD CONSTRAINT fk_hourly_production_order 
FOREIGN KEY (production_order_id) 
REFERENCES production_orders(id) 
ON DELETE NO ACTION;