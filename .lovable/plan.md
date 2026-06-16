## Problem

On `/store` → Production Voucher tab, opening voucher **PROD_06_01** shows no stock for any BOM item (e.g. B-075). The console is full of:

```
invalid input syntax for type uuid: ""
  at ProductionVoucherDetails.tsx:78
```

### Root cause

`src/components/Store/ProductionVoucherDetails.tsx` (line 60–88) fetches inventory for the voucher's plant. To find the plant id it queries the **wrong table**:

```ts
.eq("plant_id",
  (await supabase
    .from("production_schedules")      // ← wrong table
    .select("plant_id")
    .eq("id", voucherId)               // voucherId is a production_orders.id
    .maybeSingle()
  ).data?.plant_id ?? "")              // → falls back to ""  → 22P02 uuid error
```

`voucherId` is the `production_orders.id`. The lookup against `production_schedules` returns nothing, the fallback becomes `""`, Postgres rejects the cast, and the inventory query errors out. Result: `inventoryMap` is empty → every material renders "Current Stock 0" → the "no plants / no stock" symptom the user sees.

Bonus bug nearby (line 233) in the dispatch mutation: `plan.plantId` is never set in the dispatch plan, and the fallback looks it up in the already-broken `inventoryData`. Once inventory loads correctly, this still won't have a `plantId` field — it'll silently rely on the inventory row's `plant_id`, which works only because that row now exists. Cleaner to stamp `plantId` from `productionOrder.plant_id` on each plan entry.

`production_orders` already has a `plant_id` column (confirmed) and it's loaded by the existing `production-order-details` query.

## Fix

Edit only `src/components/Store/ProductionVoucherDetails.tsx`:

1. **Inventory query** (lines 60–88):
   - Make it depend on `productionOrder?.plant_id`.
   - Guard with `enabled: !!productionOrder?.plant_id` so it doesn't run with an empty uuid.
   - Replace the nested `production_schedules` lookup with `.eq("plant_id", productionOrder.plant_id)`.
   - Update `queryKey` to include `productionOrder?.plant_id` so it refetches when the voucher (and therefore the plant) loads.

2. **Dispatch plan** (lines 177–185 and 233):
   - Add `plantId: productionOrder.plant_id` to each `dispatchPlan` entry.
   - Use `plan.plantId` directly in the inventory `.update().eq("plant_id", plan.plantId)` call — drop the `inventoryData.find(...)` fallback.

3. No DB migration, no other files touched.

## Verification

- Reload `/store` → Production Vouchers → open PROD_06_01.
- Console should no longer emit `22P02 invalid input syntax for type uuid: ""`.
- B-075 row should show its real stock (749 after yesterday's fix) instead of 0.
- Plant switcher in the header should still list both plants for the admin user (it already does — that part was a side effect of the broken stock display, not a separate bug).
- Dispatch a small qty of one material and confirm inventory decrements by exactly that qty for the active plant.
