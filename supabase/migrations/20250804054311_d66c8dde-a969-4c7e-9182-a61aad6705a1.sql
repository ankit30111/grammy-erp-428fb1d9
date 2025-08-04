-- PHASE 1: CRITICAL SECURITY FIXES - Enable RLS on all exposed tables

-- Enable RLS on tables that have policies but RLS disabled
ALTER TABLE npd_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_bom_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE npd_project_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pqc_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_capa ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_material_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_material_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for PAYROLL (HR and Admin only)
CREATE POLICY "HR and admin can view all payroll records" 
ON payroll FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

CREATE POLICY "HR and admin can create payroll records" 
ON payroll FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

CREATE POLICY "HR and admin can update payroll records" 
ON payroll FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

-- Create comprehensive RLS policies for PERFORMANCE_REVIEWS
CREATE POLICY "HR, admin and employees can view relevant performance reviews" 
ON performance_reviews FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  ) OR 
  employee_id = auth.uid()
);

CREATE POLICY "HR and admin can create performance reviews" 
ON performance_reviews FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

CREATE POLICY "HR and admin can update performance reviews" 
ON performance_reviews FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

-- Create RLS policies for PRODUCTION_ORDERS (Production, Planning, Admin)
CREATE POLICY "Production team can view production orders" 
ON production_orders FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Production', 'Planning', 'Store') OR ua.role = 'admin')
  )
);

CREATE POLICY "Production team can create production orders" 
ON production_orders FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Production', 'Planning') OR ua.role = 'admin')
  )
);

CREATE POLICY "Production team can update production orders" 
ON production_orders FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Production', 'Planning', 'Store') OR ua.role = 'admin')
  )
);

-- Create RLS policies for PURCHASE_ORDERS (Purchase, Planning, Admin)
CREATE POLICY "Purchase team can view purchase orders" 
ON purchase_orders FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Purchase', 'Planning', 'Store') OR ua.role = 'admin')
  )
);

CREATE POLICY "Purchase team can create purchase orders" 
ON purchase_orders FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Purchase', 'Planning') OR ua.role = 'admin')
  )
);

CREATE POLICY "Purchase team can update purchase orders" 
ON purchase_orders FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Purchase', 'Planning') OR ua.role = 'admin')
  )
);

-- Create RLS policies for PROJECTIONS (Planning team and Admin)
CREATE POLICY "Planning team can view projections" 
ON projections FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Planning', 'Production', 'Sales') OR ua.role = 'admin')
  )
);

CREATE POLICY "Planning team can create projections" 
ON projections FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Planning', 'Sales') OR ua.role = 'admin')
  )
);

CREATE POLICY "Planning team can update projections" 
ON projections FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Planning', 'Sales') OR ua.role = 'admin')
  )
);

-- Create RLS policies for PRODUCTION_SCHEDULES (Production, Planning, Admin)
CREATE POLICY "Production team can view production schedules" 
ON production_schedules FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Production', 'Planning', 'Store') OR ua.role = 'admin')
  )
);

CREATE POLICY "Production team can create production schedules" 
ON production_schedules FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Production', 'Planning') OR ua.role = 'admin')
  )
);

CREATE POLICY "Production team can update production schedules" 
ON production_schedules FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Production', 'Planning') OR ua.role = 'admin')
  )
);

-- Create RLS policies for SKILLS (HR and Admin only)
CREATE POLICY "HR and admin can manage skills" 
ON skills FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

-- Create RLS policies for TRAINING_PROGRAMS (HR and Admin only)
CREATE POLICY "HR and admin can manage training programs" 
ON training_programs FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'HR' OR ua.role = 'admin')
  )
);

-- Create RLS policies for STORE_DISCREPANCIES (Store, Admin, Quality)
CREATE POLICY "Store team can view store discrepancies" 
ON store_discrepancies FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Store', 'Quality', 'Purchase') OR ua.role = 'admin')
  )
);

CREATE POLICY "Store team can create store discrepancies" 
ON store_discrepancies FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Store', 'Quality') OR ua.role = 'admin')
  )
);

CREATE POLICY "Store team can update store discrepancies" 
ON store_discrepancies FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Store', 'Quality', 'Purchase') OR ua.role = 'admin')
  )
);

-- Create RLS policies for NPD tables (R&D and Admin only)
CREATE POLICY "RnD can manage NPD benchmarks" 
ON npd_benchmarks FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'R&D' OR ua.role = 'admin')
  )
);

CREATE POLICY "RnD can manage NPD BOM materials" 
ON npd_bom_materials FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'R&D' OR ua.role = 'admin')
  )
);

CREATE POLICY "RnD can manage NPD project BOM" 
ON npd_project_bom FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name = 'R&D' OR ua.role = 'admin')
  )
);

-- Create RLS policies for remaining tables with basic authenticated access
CREATE POLICY "Authenticated users can view PQC reports" 
ON pqc_reports FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Quality team can manage PQC reports" 
ON pqc_reports FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Quality', 'Production') OR ua.role = 'admin')
  )
);

CREATE POLICY "Quality team can update PQC reports" 
ON pqc_reports FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Quality', 'Production') OR ua.role = 'admin')
  )
);

-- Create policies for production-related tables
CREATE POLICY "Production team can manage production CAPA" 
ON production_capa FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Production', 'Quality') OR ua.role = 'admin')
  )
);

CREATE POLICY "Production team can manage production discrepancies" 
ON production_discrepancies FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Production', 'Store', 'Quality') OR ua.role = 'admin')
  )
);

CREATE POLICY "Production team can manage material receipts" 
ON production_material_receipts FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Production', 'Store') OR ua.role = 'admin')
  )
);

-- Create policies for spare orders
CREATE POLICY "Sales team can manage spare orders" 
ON spare_orders FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Sales', 'Store') OR ua.role = 'admin')
  )
);

CREATE POLICY "Sales team can manage spare order items" 
ON spare_order_items FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Sales', 'Store') OR ua.role = 'admin')
  )
);

-- Create policy for raw material specifications
CREATE POLICY "Technical teams can manage raw material specifications" 
ON raw_material_specifications FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_accounts ua 
    JOIN departments d ON ua.department_id = d.id 
    WHERE ua.id = auth.uid() 
    AND (d.name IN ('Quality', 'R&D', 'Purchase') OR ua.role = 'admin')
  )
);