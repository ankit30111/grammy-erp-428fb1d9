

# DASH Module - Complete Implementation Plan

## Overview

DASH is a fully independent brand management system within the Grammy ERP for managing Home Audio Products (speakers, party speakers, soundbars, etc.). It covers product master, factory orders, inventory, sales, service, spares, reporting, and order tracking -- all isolated from other ERP verticals.

---

## Database Schema Design

### Core Tables (14 new tables)

**1. `dash_products`** - Product/SKU Master
- id, product_name, model_number, category (enum: Party Speaker, Tower Speaker, Soundbar, Multimedia Speaker, Portable Speaker, etc.), description, technical_specs (JSONB), mrp, dealer_price, distributor_price, barcode_ean, warranty_period_months, status (Active/Discontinued), created_at, updated_at

**2. `dash_product_artwork`** - Artwork files linked to products
- id, product_id (FK), file_type (box_artwork, product_artwork, marketing_creative), file_url, file_name, uploaded_by, created_at

**3. `dash_factory_orders`** - Factory Purchase Orders
- id, fo_number (auto-generated), product_id (FK), quantity_ordered, cost_per_unit, total_cost, expected_production_date, dispatch_date, shipment_tracking_number, factory_invoice_url, status (Draft/Ordered/In Production/Dispatched/Received/QC Pending/QC Done), batch_number, qc_status (Pending/Passed/Failed/Partial), notes, created_by, created_at, updated_at

**4. `dash_inventory`** - Warehouse Inventory (separate from main ERP)
- id, product_id (FK), batch_number, total_stock, reserved_stock, damaged_stock, in_transit_stock, available_stock (computed), location, low_stock_threshold, unit_cost, created_at, updated_at

**5. `dash_inventory_movements`** - All stock movements audit trail
- id, product_id (FK), batch_number, movement_type (GRN_RECEIPT, SALES_DISPATCH, DAMAGE, RETURN, ADJUSTMENT, TRANSFER), quantity, reference_id, reference_type, notes, created_by, created_at

**6. `dash_customers`** - Dealer/Distributor/Retailer network
- id, customer_name, customer_type (enum: Distributor, Dealer, Retailer, Institutional), gst_number, credit_limit, outstanding_balance, contact_person, phone, email, address, city, state, territory, assigned_sales_manager, is_active, created_at, updated_at

**7. `dash_sales_orders`** - Sales Orders
- id, so_number (auto-generated), customer_id (FK), order_date, total_amount, discount_amount, net_amount, scheme_details, payment_status (Pending/Partial/Paid), dispatch_status (Pending/Dispatched/Delivered), e_invoice_url, notes, created_by, created_at, updated_at

**8. `dash_sales_order_items`** - Line items for each sales order
- id, sales_order_id (FK), product_id (FK), quantity, unit_price, discount_percent, line_total, batch_number

**9. `dash_service_tickets`** - After-sales service
- id, ticket_number (auto-generated), product_id (FK), serial_number, customer_name, customer_phone, warranty_valid (boolean), issue_description, assigned_engineer, repair_status (Open/Assigned/In Progress/Awaiting Parts/Repaired/Replaced/Closed), replacement_approved (boolean), replacement_approval_notes, service_notes, created_at, updated_at, closed_at

**10. `dash_service_history`** - Service history per serial number
- id, ticket_id (FK), serial_number, action_type, description, performed_by, created_at

**11. `dash_spare_parts`** - Spare SKU Master
- id, spare_code, spare_name, description, linked_product_ids (JSONB array), cost_price, selling_price, stock_quantity, low_stock_threshold, created_at, updated_at

**12. `dash_spare_consumption`** - Spare parts usage tracking
- id, spare_id (FK), ticket_id (FK), quantity_used, consumed_by, notes, created_at

**13. `dash_spare_dispatch_log`** - Spare parts dispatch
- id, spare_id (FK), quantity, dispatched_to, dispatch_type (Service/Customer/Warehouse), reference_number, notes, dispatched_by, created_at

**14. `dash_payments`** - Payment tracking / ledger
- id, customer_id (FK), sales_order_id (FK), amount, payment_date, payment_mode, reference_number, notes, created_by, created_at

### Auto-generated Numbers
- Database functions: `generate_dash_fo_number()`, `generate_dash_so_number()`, `generate_dash_ticket_number()`
- Triggers on INSERT for each table

### RLS Policies
- All tables: authenticated users can SELECT, INSERT, UPDATE
- DELETE restricted to specific tables where appropriate
- Uses existing ERP auth system (user_accounts + departments)

---

## Frontend Architecture

### Navigation
- New "DASH" entry in sidebar navigation with sub-items
- Route prefix: `/dash/*`

### Pages and Components Structure

```text
src/pages/dash/
  DashDashboard.tsx          -- Main dashboard with KPIs & charts
  DashProducts.tsx           -- Product master CRUD
  DashFactoryOrders.tsx      -- Factory PO management
  DashInventory.tsx          -- Warehouse inventory view
  DashSales.tsx              -- Sales orders management
  DashCustomers.tsx          -- Customer network management
  DashService.tsx            -- Service tickets & tracking
  DashSpares.tsx             -- Spare parts management
  DashOrderTracking.tsx      -- Full lifecycle tracking

src/components/Dash/
  ProductMasterPanel.tsx     -- Product CRUD form & table
  AddProductDialog.tsx       -- Dialog for adding new product
  EditProductDialog.tsx      -- Dialog for editing product
  FactoryOrderForm.tsx       -- Create/edit factory PO
  FactoryOrdersList.tsx      -- Factory orders table with filters
  InventoryView.tsx          -- SKU-wise & batch-wise stock view
  InventoryAlerts.tsx        -- Low stock alerts
  CustomerForm.tsx           -- Customer CRUD
  CustomersList.tsx          -- Customer table with filters
  SalesOrderForm.tsx         -- Create sales order with auto-pricing
  SalesOrdersList.tsx        -- Sales orders table
  ServiceTicketForm.tsx      -- Create/manage service ticket
  ServiceTicketsList.tsx     -- Service tickets table
  SparePartsMaster.tsx       -- Spare parts CRUD
  SpareConsumptionLog.tsx    -- Track spare usage
  OrderLifecycleTracker.tsx  -- Visual flow tracker
  DashKPICards.tsx           -- Dashboard KPI cards
  DashCharts.tsx             -- Dashboard charts (recharts)
  LedgerView.tsx             -- Customer payment ledger

src/hooks/
  useDashProducts.ts         -- CRUD hooks for products
  useDashFactoryOrders.ts    -- Factory order hooks
  useDashInventory.ts        -- Inventory query/mutation hooks
  useDashSales.ts            -- Sales order hooks
  useDashCustomers.ts        -- Customer hooks
  useDashService.ts          -- Service ticket hooks
  useDashSpares.ts           -- Spare parts hooks
```

### Routes (9 new routes)
- `/dash` -- Dashboard
- `/dash/products` -- Product Master
- `/dash/factory-orders` -- Factory Orders
- `/dash/inventory` -- Inventory Management
- `/dash/sales` -- Sales Orders
- `/dash/customers` -- Customer Network
- `/dash/service` -- Service & After-Sales
- `/dash/spares` -- Spare Parts
- `/dash/tracking` -- Order Lifecycle Tracking

### Key UI Features
- Filters on every list page (status, date range, category, customer type)
- Global search by SKU / Serial / Customer across DASH module
- Export to Excel (CSV) and PDF on all data tables
- Activity logs shown in dashboard feed
- Tabs-based layout within pages (matching existing ERP pattern)
- Recharts for dashboard visualizations
- Toast notifications for all actions

---

## Implementation Sequence

Due to the comprehensive scope, implementation will follow this order within a single build:

1. **Database migration** -- All 14 tables, enums, functions, triggers, RLS policies
2. **Storage bucket** -- `dash-documents` for artwork & invoices
3. **Navigation** -- Add DASH section to sidebar
4. **Hooks** -- All 7 custom hooks for data operations
5. **Product Master** -- Full CRUD with artwork upload
6. **Factory Orders** -- PO creation, GRN, batch generation, QC
7. **Inventory** -- Stock view, movements, alerts, valuation
8. **Customers** -- Customer CRUD with types & territories
9. **Sales Orders** -- Order creation with auto-pricing, dispatch
10. **Service Module** -- Tickets, warranty, repairs, history
11. **Spare Parts** -- Master, consumption, dispatch log
12. **Dashboard** -- KPIs, charts, reports
13. **Order Tracking** -- Lifecycle visualization
14. **Routing** -- All routes in App.tsx with AuthGuard

---

## Technical Details

### Auto-Pricing Logic
- When creating a sales order, selecting a customer auto-fills pricing based on customer_type
- Distributor gets `distributor_price`, Dealer gets `dealer_price`, Retailer/Institutional gets `mrp`
- Discount structure applied on top

### Inventory Auto-Updates
- Factory order GRN completion -> increases `dash_inventory`
- Sales order dispatch -> decreases `dash_inventory`
- Service spare consumption -> decreases `dash_spare_parts` stock
- All movements logged to `dash_inventory_movements`

### Data Isolation
- All DASH tables are prefixed with `dash_` 
- No foreign keys to existing ERP tables (products, inventory, etc.)
- Completely independent data silo

### Export Support
- CSV export using browser-native Blob/download
- PDF export using existing jspdf dependency

