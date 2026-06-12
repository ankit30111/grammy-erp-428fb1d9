## Part 1 — What is plant-scoped vs common

I checked which tables actually carry a `plant_id` column. That's the source of truth.

### A. Plant-scoped data (lives at one specific plant)
These tables stamp `plant_id` on every row, so the dashboard can filter to the active plant:

- **Production:** `production_schedules`, `production_orders`, `production_lines`
- **Materials in/out:** `grn`, `grn_items`, `material_movements`, `material_requests`, `inventory`
- **Purchase & sales motion:** `purchase_orders`, `dispatch_orders`, `spare_orders`
- **Plant-specific issues:** `iqc_vendor_capa`, `store_discrepancies`, `production_discrepancies`, `production_material_receipts`
- **Access:** `user_plants` (who can see which plant)

### B. Tables without `plant_id` — but conceptually plant-scoped via parents
Some transactional tables don't carry `plant_id` directly; they inherit it through a foreign key. Treat them as plant-scoped through their parent:

- `purchase_order_items` → via `purchase_orders.plant_id`
- `dispatch_order_items`, `spare_order_items` → via order parent
- `production_serial_numbers`, `hourly_production`, `line_rejections`, `pqc_reports`, `production_capa`, `kit_preparation`, `kit_items`, `material_blocking`, `finished_goods_inventory`, `production_material_discrepancies` → via `production_orders` / `production_schedules`
- `capa_implementation_checks` → via the parent CAPA row
- `projections` → currently no `plant_id`; today it's treated as company-wide demand and split into plant-specific `production_schedules` at scheduling time

### C. Common / company-wide (master data — same across plants)
- **People & access:** `user_accounts`, `user_departments`, `departments`, `department_permissions`
- **Catalog masters:** `products`, `raw_materials`, `raw_material_specifications`, `raw_material_vendors`, `vendors`, `customers`, `customer_warehouses`
- **BOM:** `bom`, `bom_versions`
- **DASH workspace masters:** `dash_products`, `dash_product_*`, `dash_customers`, `dash_spare_parts`, `dash_product_spare_parts`
- **R&D:** `npd_projects`, `npd_bom_*`, `npd_sample_tracking`, `npd_benchmarks`, `pre_existing_projects`
- **HR masters:** `employees`, `skills`, `training_programs`, `employee_skills`, `employee_training`, `performance_reviews`, `payroll`, `attendance`
- **Plant directory:** `plants`
- **Imports:** `import_containers`, `container_materials`, `container_cost_breakdown`, `container_status_history`
- **Customer service masters & history:** `customer_complaints`, `customer_complaint_parts`, `customer_complaint_batches`, `customer_complaint_batch_items` (currently no `plant_id`)
- **Logs/approvals:** `audit_logs`, `approval_workflows`, `vendor_capa` (no `plant_id` today)

### CAPA — the specific case you asked about
- `iqc_vendor_capa` IS plant-stamped — incoming material issues are owned by the plant that received them. Dashboard scoped to "Plant A" shows only Plant A's IQC CAPAs.
- `production_capa` flows through `production_orders.plant_id` — also plant-scoped.
- `vendor_capa` (legacy/global vendor-level corrective action) has no `plant_id` and is treated as company-wide.

**"All plants" scope** on the dashboard rolls them all up, so you can see "where what is happening" across both plants at once. **A specific plant scope** filters everything plant-stamped (directly or via parent) to just that plant. Master data is unaffected by scope.

---

## Part 2 — Cleanup: delete transactional data, keep masters

Current row counts (worth knowing before nuking):

| Area | Rows |
|---|---|
| projections | 6 |
| production_schedules / orders | 6 / 6 |
| hourly_production | 2 |
| finished_goods_inventory | 1 |
| inventory | 1,497 |
| material_movements | 17 |
| kit_preparation / items | 2 / 2 |
| grn / grn_items | 114 / 490 |
| purchase_orders / items | 10 / 16 |
| spare_orders / items | 1 / 1 |
| iqc_vendor_capa | 21 |
| store_discrepancies | 11 |
| line_rejections | 1 |
| production_material_discrepancies | 2 |
| customer_complaints / parts | 2 / 3 |
| approval_workflows | 14 |

### What I will DELETE (transactional)
In dependency-safe order (children first), inside a single transaction:

1. `hourly_production`, `line_rejections`, `pqc_reports`, `production_capa`, `capa_implementation_checks`, `production_material_receipts`, `production_material_discrepancies`, `production_serial_numbers`, `finished_goods_inventory`
2. `kit_items`, `kit_preparation`, `material_blocking`, `material_requests`, `material_movements`
3. `production_orders`, `production_schedules`
4. `grn_items`, `grn`
5. `iqc_vendor_capa`, `store_discrepancies`, `vendor_capa`
6. `purchase_order_items`, `purchase_orders`
7. `dispatch_order_items`, `dispatch_orders`
8. `spare_order_items`, `spare_orders`
9. `inventory` (stock = 0 across the board, per your request)
10. `projections`
11. `approval_workflows` (these reference deleted POs/vouchers)
12. `production_discrepancies` (if any remain)

### What I will KEEP (master & reference data)
- All `plants`, `production_lines` (line definitions, not runs)
- `vendors`, `raw_materials`, `raw_material_vendors`, `raw_material_specifications`
- `products`, `bom`, `bom_versions`
- `customers`, `customer_warehouses`
- All DASH masters (`dash_products`, `dash_customers`, `dash_spare_parts`, `dash_product_*`)
- All NPD / R&D data (`npd_*`, `pre_existing_projects`)
- HR (`employees`, `skills`, `training_programs`, etc.)
- Imports (`import_containers` and children) — these are master/in-flight reference data
- Users, departments, permissions
- `audit_logs` (history record)

### Open questions before I run it
1. **Customer complaints** (`customer_complaints`, `customer_complaint_parts`, `customer_complaint_batches`, `customer_complaint_batch_items`) — keep as history, or delete too?
2. **Import containers** — keep all 4 tables intact, or also wipe?
3. **Audit logs** — keep (recommended) or wipe?
4. This is **destructive and irreversible**. Confirm I should proceed on the live database. I will run it in one transaction so it's all-or-nothing.

Once you answer, I'll execute the deletes via the data tool (no schema changes).
