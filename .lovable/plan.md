
## Problem

The schema already has `plant_id` on the operational tables (`inventory`, `production_schedules`, `production_orders`, `material_movements`, `grn`, `grn_items`, `material_requests`, `purchase_orders`, `dispatch_orders`), but most front-end queries do **not** filter by the active plant. That's why both plants' scheduled productions, stock and store data appear together. `projections`, `products` and `raw_materials` do **not** have `plant_id` — those stay shared (projections common, masters shared), as you described.

## Design

```text
Common (shared)     : projections, products, raw_materials, vendors, customers, BOM
Plant-scoped        : production_schedules, production_orders, inventory,
                      material_movements, material_requests,
                      grn + grn_items, purchase_orders, dispatch_orders,
                      finished_goods stock

Dashboard           : toggle [ All plants ▾ | Plant A | Plant B ]
                      - "All plants" = company-wide rollup (no plant filter)
                      - Single plant   = uses activePlant filter
```

## What I'll change

### 1. Plant-scope every operational read/write

Add `.eq('plant_id', plantId)` on selects and stamp `plant_id: plantId` on inserts in:

- `src/hooks/inventory/useInventoryQuery.ts`, `useInventoryMutations.ts`, `useInventorySync.ts`, `useInventoryDiagnostics.ts`
- `src/hooks/useInventorySync.ts`, `src/hooks/useKitManagement.ts`
- `src/hooks/useGRN.ts` (verify), `src/hooks/useDispatchOrders.ts` (verify), `src/hooks/usePurchaseOrders.ts` (verify)
- All `from("inventory")` call-sites in `src/components/Production/*`, `src/components/Store/*`
- `src/components/Production/ProductionQueueDashboard.tsx` — currently fetches all `production_orders` without plant filter; add filter and use dynamic lines from `useProductionLinesList`
- `src/hooks/useDashboardData.ts` — `useStoreDashboardData`, `useProductionDashboardData`, `useQualityDashboardData` all unfiltered; add plant filter (with "all plants" override — see step 3)

Guard every hook: if `plantId` is undefined, return empty/disabled query rather than leaking cross-plant rows.

### 2. Finished goods / store stock per plant

`finished_goods` has no `plant_id` today. Add it via migration (nullable, backfill with default plant for existing rows), then filter the FG views/hooks the same way.

### 3. Consolidated vs per-plant dashboard

- New context value `dashboardScope: 'all' | <plantId>` (separate from `activePlant`, so operational pages keep using `activePlant` and only the dashboard widgets read `dashboardScope`).
- New `<DashboardScopeSwitcher />` in `src/pages/Index.tsx` header: "All plants" + each permitted plant.
- Update dashboard widgets (`InventoryWidget`, `PendingApprovalsWidget`, `ProductionOverviewWidget`, `ProductionStatusWidget`, `QualityMetricsWidget`, `OrderFulfillmentWidget`, `VendorPerformanceWidget`, `useDashboardData` hooks) to:
  - When scope is a plant → `.eq('plant_id', scopePlantId)`
  - When scope is "all" → no plant filter (rollup)
- Same toggle reused on PPC dashboard (`/dashboard/ppc`) so you can see one plant or both.

### 4. RLS sanity (defence in depth)

Confirm existing RLS on plant-scoped tables uses `auth_user_in_plant(plant_id)` so even if a UI bug forgets the filter, users only see plants they're permitted on. If any of these tables are missing that policy I'll add it in a migration.

### 5. Backfill

One-time migration to set `plant_id` on existing rows in plant-scoped tables that are currently NULL → assign to the default/primary plant so historical data stays visible after filters are enforced.

## Out of scope (intentionally)

- Projections stay common — no schema change there.
- Products / raw materials / vendors / customers / BOM stay shared masters.
- No change to Plants → Lines management you already built.

## Result

- PPC's "scheduled productions" list only shows the active plant's vouchers.
- Stock, GRN, dispatch, material movements stay strictly per plant — no more cross-plant mess-ups.
- Dashboard has one switcher: pick a plant to see that plant's KPIs, or "All plants" for the company rollup.

Approve and I'll implement.
