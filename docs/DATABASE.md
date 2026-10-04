# ERP database map

Generated 28 Sep 2026 from the live database. Every table also carries this description as a Postgres comment, so it shows in the Supabase table editor.

## How stock and production flow

```
part_brands (tick) --sync_brand_variants--> parts (brand versions) + bom
projections --> production_schedules --> production_orders (voucher)
   production_orders.parent_order_id = sub-assembly voucher built for a finished-good voucher
stock_holds --> kit_preparation / kit_items --> stock_ledger (ISSUE)
hourly_production --> PQC --> OQC --> receive_finished_goods --> stock_ledger (SUBASSEMBLY_RECEIPT / FG)
grn / grn_items --IQC--> stock_ledger (GRN) ; post_stock_count --> stock_ledger (OPENING_STOCK / STOCK_RECONCILIATION)
stock_ledger --trigger--> stock_balance
```

When a screen looks wrong, open **Management → System Check** (`system_health_check()`): it lists which consistency rule is broken and which records.

## Access

| Table | What one row is | Links to |
|---|---|---|
| `approval_workflows` | Legacy generic approval records (masters use approval_status on the row itself). | — |
| `audit_logs` | Who changed what and when, written by audit_state_transition triggers. | — |
| `department_permissions` | Which app module a department may open. | departments |
| `departments` | A department (Management, R&D, Store...). Rights come from department membership. | — |
| `plants` | A factory / legal entity. Everything with plant_id belongs to one. | — |
| `user_accounts` | A person who can sign in (mirror of auth.users) with role and default plant. | departments, plants |
| `user_departments` | User x department. Drives can_approve / can_edit_masters / has_role. | departments, user_accounts |
| `user_plants` | User x plant. Drives in_plant() on every plant-scoped table. | plants, user_accounts |

## Masters

| Table | What one row is | Links to |
|---|---|---|
| `bom` | One line of a bill of materials: parent part contains child part x quantity. Written only through apply_bom. | parts |
| `bom_change_requests` | A BOM change by R&D waiting for Management approval. | parts |
| `brand_sync_issues` | What the last branding sync could not line up. Rebuilt on every sync. | parts |
| `brands` | Two-letter brand codes (PH, CR...) used in finished-good codes and brand versions. | — |
| `customer_warehouses` | Ship-to addresses of a customer. | customers |
| `customers` | Customer master. | — |
| `document_counters` | Running counters for document numbers (PO series). | — |
| `part_brands` | Printed part x brand it is printed for (the Branding tick). Drives sync_brand_variants. | brands, parts |
| `part_categories` | Part-code prefix registry (P, E, SA, JA...) and the tier each belongs to. | — |
| `part_specifications` | Versioned specification / IQC documents of a part. | parts |
| `part_vendors` | Approved vendor for a part (one may be primary). | parts, vendors |
| `model_versions` | A model's master BOM per version: 1.0, 1.1 by ECN (ecn_no, reason), 2.0 for a redesign. Draft until Management releases it. Lines are base parts. | parts (model) |
| `parts` | Every part code: purchased parts, sub-assemblies, finished goods (brand codes, JA-006-PH, with model_id + model_version), models (source_type MODEL, JA-006) and brand versions (branded_from). | brands, plants, parts (model) |
| `released_part_codes` | Codes freed by deleting unused parts, handed out again by next_part_code. | — |
| `vendor_contacts` | Extra contact people at a vendor. | vendors |
| `vendors` | Supplier master. Bank and PAN readable only via get_vendor_finance. | — |

## Planning

| Table | What one row is | Links to |
|---|---|---|
| `production_schedules` | A planned build on a date. One per voucher. Finished goods need a projection; sub-assemblies do not. | parts, plants, production_lines, projections |
| `projections` | Customer demand: finished good x quantity x month. Scheduled/vouchered/produced totals kept by trigger. | customers, parts |
| `shortages` | Material shortages computed from projections, for Purchase. | parts, plants, production_orders, production_schedules, purchase_order_items |

## Production

| Table | What one row is | Links to |
|---|---|---|
| `hourly_production` | Hourly output report of a voucher; sums into production_orders.produced_quantity. | production_lines, production_orders |
| `production_lines` | A production line or sub-assembly cell of a plant. | plants |
| `production_order_lines` | Which production line(s) a voucher runs on. | parts, production_lines, production_orders |
| `production_orders` | The production voucher (PV-...). parent_order_id = the voucher a sub-assembly is built for. | parts, plants, production_schedules, projections |
| `serial_number_assignments` | Serial number ranges given to a voucher. | plants, production_orders |

## Stock

| Table | What one row is | Links to |
|---|---|---|
| `finished_goods_inventory` | Finished goods booked in after OQC, one lot per voucher. | parts, plants, production_orders |
| `kit_feedback` | A difference production found in a kit, for the store to accept or reject. | kit_items, parts, plants, production_orders, stock_ledger |
| `kit_items` | One part in a kit: issued by store, received (counted) by production. | kit_preparation, parts |
| `kit_preparation` | The kit the store sends to production for a voucher. | plants, production_orders |
| `kit_returns` | Parts returned from the line to the store against a kit item. | kit_items, plants |
| `material_movement_log` | Legacy log of material requests (log_material_movement). | parts |
| `material_requests` | Extra material asked for by production outside the kit. | parts, plants, production_orders |
| `stock_balance` | Current quantity per part and location, kept equal to the ledger sum by trigger. | parts, plants, stock_locations |
| `stock_holds` | Stock reserved for a voucher until its kit is issued (sync_voucher_holds). | parts, plants, production_orders, stock_locations |
| `stock_ledger` | Every stock movement, append-only. The single source of truth for quantities. | parts, plants, stock_locations |
| `stock_locations` | MAIN / QUAR / REJECT store of a plant. | plants |

## Purchase

| Table | What one row is | Links to |
|---|---|---|
| `container_materials` | Parts packed in an import container. | import_containers, parts |
| `grn` | Goods received note: a delivery against a PO or without one. | import_containers, plants, purchase_orders, vendors |
| `grn_items` | One part received on a GRN, with IQC outcome. | grn, parts, purchase_order_items |
| `grn_variance_resolutions` | How a store receiving difference was resolved. | grn_items, plants, stock_ledger |
| `import_containers` | An import container and its shipping milestones. | purchase_orders |
| `purchase_order_items` | One part on a PO; received quantity kept by trigger from GRNs. | parts, purchase_orders |
| `purchase_orders` | A purchase order to a vendor. | plants, projections, vendors |

## Quality

| Table | What one row is | Links to |
|---|---|---|
| `capa` | Corrective / preventive action, internal or against a vendor. | grn_items, line_rejections, parts, plants, production_orders, vendors |
| `customer_complaint_parts` | Parts involved in a customer complaint. | customer_complaints, parts, vendors |
| `customer_complaints` | A complaint from a customer. | capa, customers, parts, plants |
| `line_rejections` | Parts rejected on the line during production. | employees, parts, plants, production_orders, vendors |
| `pqc_reports` | In-process (PQC) inspection report of a voucher. | plants, production_orders |
| `rca_reports` | Root-cause analysis report. | capa |
| `vendor_notifications` | Quality-claim mail to a vendor (sent by the send-vendor-notifications function). | capa, plants, vendors |

## Sales

| Table | What one row is | Links to |
|---|---|---|
| `dispatch_order_items` | Finished-goods lots on a dispatch. | dispatch_orders, finished_goods_inventory |
| `dispatch_orders` | A dispatch of finished goods to a customer. | customer_warehouses, customers, plants |
| `spare_order_items` | One part on a spare order. | parts, spare_orders |
| `spare_orders` | An order for spare parts. | customers, plants |

## R&D

| Table | What one row is | Links to |
|---|---|---|
| `npd_benchmarks` | Competitor benchmarks of an NPD project. | npd_projects |
| `npd_bom_materials` | Draft BOM lines of an NPD project (before it becomes a part). | npd_projects, parts, vendors |
| `npd_projects` | A new product development project. | customers, parts |
| `npd_sample_tracking` | Samples sent / received for an NPD project. | npd_projects |

## HR

| Table | What one row is | Links to |
|---|---|---|
| `attendance` | Daily attendance of an employee. | employees |
| `employee_skills` | Employee x skill with level. | employees, skills |
| `employee_training` | Employee x training attended. | employees, training_programs |
| `employees` | An employee. | — |
| `payroll` | Monthly payroll of an employee. | employees |
| `performance_reviews` | Performance review of an employee. | employees |
| `skills` | Skill catalogue. | — |
| `training_programs` | A training programme. | — |
