-- CRITICAL SECURITY FIXES

-- Phase 1: Enable RLS on all unprotected tables (CRITICAL)
-- Tables with RLS disabled that need immediate protection

-- Core business tables
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_bom_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_project_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_sample_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_stage_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_capa ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_material_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Add basic authenticated user policies for critical business tables
CREATE POLICY "Authenticated users can view products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify products" ON products FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view raw materials" ON raw_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify raw materials" ON raw_materials FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view vendors" ON vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify vendors" ON vendors FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view projections" ON projections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify projections" ON projections FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view production orders" ON production_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify production orders" ON production_orders FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view production schedules" ON production_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify production schedules" ON production_schedules FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view purchase orders" ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify purchase orders" ON purchase_orders FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view purchase order items" ON purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify purchase order items" ON purchase_order_items FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view user accounts" ON user_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin users can modify user accounts" ON user_accounts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role = 'admin')
);

-- Employee and HR data - restricted access
CREATE POLICY "Authenticated users can view employees" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin and HR can modify employees" ON employees FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('admin', 'hr'))
);

CREATE POLICY "Authenticated users can view attendance" ON attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR can modify attendance" ON attendance FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('admin', 'hr'))
);

CREATE POLICY "Authenticated users can view payroll" ON payroll FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('admin', 'hr'))
);
CREATE POLICY "Admin and HR can modify payroll" ON payroll FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('admin', 'hr'))
);

-- NPD and R&D data
CREATE POLICY "Authenticated users can view npd projects" ON npd_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify npd projects" ON npd_projects FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view npd project bom" ON npd_project_bom FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify npd project bom" ON npd_project_bom FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view npd bom materials" ON npd_bom_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify npd bom materials" ON npd_bom_materials FOR ALL TO authenticated USING (true);

-- Quality and production data
CREATE POLICY "Authenticated users can view production discrepancies" ON production_discrepancies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify production discrepancies" ON production_discrepancies FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view store discrepancies" ON store_discrepancies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify store discrepancies" ON store_discrepancies FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view production capa" ON production_capa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify production capa" ON production_capa FOR ALL TO authenticated USING (true);

-- Serial numbers and tracking
CREATE POLICY "Authenticated users can view production serial numbers" ON production_serial_numbers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify production serial numbers" ON production_serial_numbers FOR ALL TO authenticated USING (true);

-- Spare orders
CREATE POLICY "Authenticated users can view spare orders" ON spare_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify spare orders" ON spare_orders FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view spare order items" ON spare_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify spare order items" ON spare_order_items FOR ALL TO authenticated USING (true);

-- Skills and training
CREATE POLICY "Authenticated users can view skills" ON skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR and admin can modify skills" ON skills FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('admin', 'hr'))
);

CREATE POLICY "Authenticated users can view training programs" ON training_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR and admin can modify training programs" ON training_programs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('admin', 'hr'))
);

CREATE POLICY "Authenticated users can view employee skills" ON employee_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR and admin can modify employee skills" ON employee_skills FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('admin', 'hr'))
);

CREATE POLICY "Authenticated users can view employee training" ON employee_training FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR and admin can modify employee training" ON employee_training FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('admin', 'hr'))
);

CREATE POLICY "Authenticated users can view performance reviews" ON performance_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR and admin can modify performance reviews" ON performance_reviews FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_accounts WHERE id = auth.uid() AND role IN ('admin', 'hr'))
);

-- Material receipts and tracking
CREATE POLICY "Authenticated users can view production material receipts" ON production_material_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify production material receipts" ON production_material_receipts FOR ALL TO authenticated USING (true);

-- NPD tracking and milestones
CREATE POLICY "Authenticated users can view npd benchmarks" ON npd_benchmarks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify npd benchmarks" ON npd_benchmarks FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view npd project milestones" ON npd_project_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify npd project milestones" ON npd_project_milestones FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view npd project tasks" ON npd_project_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify npd project tasks" ON npd_project_tasks FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view npd sample tracking" ON npd_sample_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify npd sample tracking" ON npd_sample_tracking FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view npd stage transitions" ON npd_stage_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify npd stage transitions" ON npd_stage_transitions FOR ALL TO authenticated USING (true);