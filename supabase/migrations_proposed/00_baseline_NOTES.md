# Baseline schema notes (proposal — nothing applied)

File: `supabase/migrations_proposed/00_baseline.sql`. This folder is not the
migrations folder, so nothing runs until you say so.

## 1. Tables and their one-line purpose

### Access / masters (structure preserved so `backup/masters/*.json` restores as-is)
| table | purpose |
|---|---|
| plants | the two legal/production entities |
| departments | department list |
| department_permissions | which module tabs a department may use |
| user_accounts | mirror of the sign-in account plus role, default plant |
| user_departments / user_plants | which departments and plants a user may work in |
| products | finished-goods master |
| raw_materials | part master incl. sourcing, price, CBM |
| vendors | supplier master |
| customers / customer_warehouses | customer master and ship-to addresses |
| bom | product to part explosion |
| bom_versions | BOM change history snapshot |
| raw_material_vendors | approved vendors per part |
| raw_material_specifications | versioned spec/IQC-checklist documents |
| approval_workflows | generic submit/approve records |
| ht_store | small per-user key/value store used by the UI |

### Stock (one mechanism only)
| table | purpose |
|---|---|
| stock_locations | MAIN / QUAR / REJECT per plant |
| stock_ledger | append-only record of every stock movement |
| stock_balance | derived quantity per plant/part/location, non-negative |
| stock_holds | a dated claim on material for a voucher or other demand |

### Demand and production
projections (monthly customer demand) · production_schedules (a dated plan
against a projection) · production_orders (the voucher) · hourly_production
(shop-floor output) · production_serial_numbers · kit_preparation / kit_items
(store issue against a voucher) · material_requests (extra/short/damaged issue).

### Purchase and inbound
shortages (netted requirement) · purchase_orders / purchase_order_items ·
import_containers / container_materials (shipment + landed cost) · grn / grn_items
(receipt, IQC outcome, store count, invoice reconciliation).

### Quality
pqc_reports · line_rejections · capa (one table, `source` = IQC | PRODUCTION |
VENDOR | COMPLAINT) · capa_checks (effectiveness follow-up) · rca_reports.

### Outbound
finished_goods_inventory · dispatch_orders / dispatch_order_items ·
spare_orders / spare_order_items.

### Cross-cutting
audit_logs (every state transition, trigger-written).

## 2. Triggers and the single column each one owns

| trigger | table | owns |
|---|---|---|
| trg_touch_updated_at (all tables) | every table with the column | `updated_at` |
| trg_recalc_stock_balance | stock_ledger | `stock_balance.quantity` (SUM of ledger) |
| trg_stock_ledger_append_only | stock_ledger | blocks UPDATE/DELETE (owns nothing) |
| trg_recalc_projection_totals_from_schedule / _from_order | production_schedules, production_orders | `projections.scheduled_quantity`, `.vouchered_quantity`, `.produced_quantity` (all SUMs) |
| trg_recalc_order_produced | hourly_production | `production_orders.produced_quantity` (SUM) |
| trg_recalc_po_total | purchase_order_items | `purchase_orders.total_amount` (SUM) |
| trg_recalc_po_item_received | grn_items | `purchase_order_items.received_quantity` (SUM) |
| trg_recalc_grn_status | grn_items | `grn.status` |
| trg_recalc_fg_dispatched | dispatch_order_items | `finished_goods_inventory.quantity_dispatched` (SUM) |
| trg_allocate_container_cost | container_materials | `container_materials.unit_cost_allocation` (CBM-proportional, recomputed) |
| trg_production_orders_number | production_orders | `voucher_number` (sequence) |
| trg_purchase_orders_number | purchase_orders | `po_number` (sequence) |
| trg_grn_number | grn | `grn_number` (sequence) |
| trg_kit_number | kit_preparation | `kit_number` (sequence) |
| trg_request_number | material_requests | `request_number` (sequence) |
| trg_dispatch_number | dispatch_orders | `dispatch_number` (sequence) |
| trg_spare_order_number | spare_orders | `spare_order_number` (sequence) |
| trg_capa_number | capa | `capa_number` (sequence) |
| trg_guard_schedule_update / _delete | production_schedules | no column — enforces the lifecycle lock |
| trg_audit_<table> (17 tables) | tables with a status column | rows in `audit_logs` |

No function anywhere performs `x = x + n`. Every total is a recomputed SUM.

## 3. Foreign keys that do not exist today

| new FK | why |
|---|---|
| shortages.purchase_order_item_id → purchase_order_items | closes shortage to the order line that covers it |
| purchase_orders.projection_id → projections | records the demand a PO was raised for |
| import_containers.purchase_order_id → purchase_orders | ties a shipment to its order |
| grn.purchase_order_id → purchase_orders | receipt to order (today only loosely referenced) |
| grn.import_container_id → import_containers | receipt to shipment |
| grn_items.purchase_order_item_id → purchase_order_items | line-level receipt matching |
| finished_goods_inventory.production_order_id → production_orders | output traced to the voucher |
| dispatch_order_items.finished_goods_inventory_id → finished_goods_inventory | dispatch consumes a specific FG lot |
| stock_holds.production_order_id → production_orders | a hold always belongs to a demand |
| capa.grn_item_id / production_order_id / line_rejection_id | CAPA traced to the failure that caused it |
| production_orders.production_schedule_id / projection_id | voucher to plan to demand |
| line_rejections.raw_material_id / vendor_id | rejection attributable to a part and supplier |

## 4. Deliberately not carried over

| dropped | reason |
|---|---|
| `inventory` | replaced entirely by `stock_balance` derived from the ledger; it was the second stock reality that caused the divergence |
| `material_movements` | replaced by `stock_ledger`; its writer silently discarded rows whose reference number did not match a pattern |
| `material_blocking` | never released, ignored by shortage maths; replaced by `stock_holds` |
| `production_material_receipts`, `production_material_discrepancies`, `production_discrepancies`, `store_discrepancies` | four overlapping discrepancy logs; the receipt/count difference now lives on `grn_items` (`received` vs `iqc_*` vs `store_counted_quantity`) and on `kit_items` (`issued` vs `received`), with the ledger as the movement record |
| `vendor_capa`, `iqc_vendor_capa`, `production_capa`, `capa_implementation_checks` | folded into `capa` + `capa_checks` with a `source` discriminator |
| `material_requirements_view`, `material_shortages_calculated` | the netting layer is a later step and must be built once, on top of `stock_balance` + `stock_holds` + open PO lines; carrying the old views forward would carry the double-counting with them |
| `container_status_history`, `container_cost_breakdown` | status history is now `audit_logs`; costs live on `import_containers` and are allocated by trigger |
| `production_line_assignments` | a line is a column on the schedule/voucher, not a separate row |
| `customer_complaints` and its four child tables, `npd_*`, `pre_existing_projects` | out of the stated spine scope; they are a separate, self-contained cutover and were left untouched rather than half-rebuilt |
| all 22 `dash_*` tables, all HR tables | out of scope by instruction — not created, not dropped |
| `purchase_orders.expected_delivery_date` + `delivery_date` | collapsed into the single `promised_delivery_date` |

## 5. Things I could not cleanly replace — read this before cutover

1. **Netting / shortage calculation.** `shortages` is a table with real links, but
   nothing populates it in this baseline. The rule (demand − stock_balance −
   open PO lines − quarantine + holds) must be written as one function in a later
   step. Until then the shortage screens have no source.
2. **Complaints, NPD and pre-existing projects** are not in this file. If the old
   database is dropped, those tables and their 7 rows go with it. Say the word and
   I will add them, or export them first.
3. **`user_accounts.id` must equal `auth.users.id`.** The baseline keeps no FK
   (auth is a managed schema), so restoring `user_accounts.json` only works if the
   same sign-in accounts still exist with the same IDs. If auth is recreated,
   `created_by` / `granted_by` / `uploaded_by` across masters point at IDs that no
   longer exist — they are plain uuid columns, so the restore will not fail, but
   those attributions become meaningless.
4. **`grn_items.iqc_report_url` and CAPA document links** point at storage files
   that survive, but the rows carrying the links are transactional and will be
   wiped; the 153 IQC reports and 5 CAPA files then have no record pointing at
   them.
5. **Enum values.** `bom_type` in the live database has values I cannot fully
   enumerate from the backup; the baseline assumes MAIN / SUB_ASSEMBLY / PACKING.
   Verify against `bom.json` before applying or the BOM restore will reject rows.
6. **`document numbers change format`** (`PO-YYYYMM-00001`). Old numbers in the
   backup are not restored into these tables (they are working data), so there is
   no collision, but printed documents already issued will not match the new
   series.
7. **Realtime publication** and storage bucket policies are not in this file; they
   must be re-added after the cutover or the live-updating screens go quiet.
