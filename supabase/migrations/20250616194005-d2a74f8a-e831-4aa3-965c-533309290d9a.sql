
-- Clear all operational data while preserving master data
-- Delete in the correct order to respect ALL foreign key constraints

-- Clear HR operational data
DELETE FROM employee_training;
DELETE FROM employee_skills;
DELETE FROM performance_reviews;
DELETE FROM payroll;
DELETE FROM attendance;

-- Clear R&D project data
DELETE FROM npd_bom_materials;
DELETE FROM npd_project_bom;
DELETE FROM npd_benchmarks;
DELETE FROM npd_projects;
DELETE FROM pre_existing_projects;

-- Clear approval workflows
DELETE FROM approval_workflows;

-- Clear sales and dispatch data
DELETE FROM dispatch_order_items;
DELETE FROM dispatch_orders;
DELETE FROM finished_goods_inventory;

-- Clear customer complaints (parts first, then complaints)
DELETE FROM customer_complaint_parts;
DELETE FROM customer_complaints;

-- Clear material flow and inventory operations
DELETE FROM material_movements;
DELETE FROM material_requests;
DELETE FROM material_blocking;

-- Clear production operations that depend on other tables first
DELETE FROM hourly_production;
DELETE FROM production_line_assignments;
DELETE FROM production_material_receipts;

-- Clear production_material_discrepancies BEFORE clearing kit_items
DELETE FROM production_material_discrepancies;

-- Now clear kit preparation (items first, then preparation)
DELETE FROM kit_items;
DELETE FROM kit_preparation;

-- Continue with remaining production operations
DELETE FROM production_discrepancies;
DELETE FROM production_capa;
DELETE FROM line_rejections;
DELETE FROM pqc_reports;

-- Clear quality and discrepancy data that depend on GRN
DELETE FROM store_discrepancies;
DELETE FROM iqc_vendor_capa;

-- Clear production orders before clearing schedules
DELETE FROM production_orders;
DELETE FROM production_schedules;
DELETE FROM production_serial_numbers;

-- Clear GRN data (items first, then grn)
DELETE FROM grn_items;
DELETE FROM grn;

-- Clear purchase orders (items first, then orders)
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;

-- Clear projections
DELETE FROM projections;

-- Reset inventory quantities to zero (keep the records but reset quantities)
UPDATE inventory SET quantity = 0, last_updated = now();
