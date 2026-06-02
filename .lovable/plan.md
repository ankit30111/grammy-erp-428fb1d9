## Phase C + Plants Management Page

Two parallel workstreams:

### 1. Plants Management Page (new)

**Route:** `/settings/plants` (admin-only, guarded by `AdminGuard`)

**File:** `src/pages/PlantsManagement.tsx` + nav entry under Settings.

**Features:**
- Lists all plants from `public.plants` (both Grammy Electronics `GE` and the second plant) — code, name, address, is_active, created_at.
- **Add plant** dialog: code (unique, uppercase), name, address (optional), is_active (default true).
- **Edit plant** dialog: name, address, is_active. `code` is read-only after creation (it's the stable key used in joins/backfills).
- **Deactivate** (soft) toggle via `is_active`. No hard delete — plants are referenced by 14 plant-scoped tables now; deletion would cascade-break history. Show a "Deactivate" action instead of "Delete" with a tooltip explaining why.
- Uses `usePlant()` to refresh the switcher list after changes.

**RLS:** new policies on `public.plants` so only admins (`auth_is_admin()`) can `INSERT`/`UPDATE`; everyone authenticated can `SELECT` (already needed for the switcher).

### 2. Phase C — page-by-page plant filtering + insert stamping

Goal: every plant-scoped read filters by `activePlant.id`, every insert stamps `plant_id = activePlant.id`. Column stays nullable; legacy rows are already backfilled to `GE` so nothing disappears.

**Approach: one hook at a time, in safe order.** Each step = edit hook + verify page still loads. No NOT NULL, no RLS-by-plant yet (that's Phase D).

**Order (lowest risk first):**

1. **`useInventory` / `useInventoryQuery`** — add `.eq('plant_id', activePlant.id)` to select; stamp `plant_id` on insert. Verify Inventory page.
2. **`useGRN`** — filter list + stamp `plant_id` on GRN header insert. `grn_items.plant_id` derived from parent GRN at insert time.
3. **`usePurchaseOrders`** — filter list + stamp on PO insert.
4. **`useProductionSchedules` + `useProductionOrders`** — filter + stamp. Schedules drive PPC + Planning.
5. **`useDispatchOrders`** — filter + stamp. Sales / RegularDispatch.
6. **Spare orders** (`SpareOrders.tsx` direct queries or hook) — filter + stamp.
7. **Material movements / material requests / store_discrepancies / production_discrepancies / production_material_receipts / iqc_vendor_capa** — these are mostly written by triggers/RPCs from the rows above. For reads on their pages (IQC, Store, PurchaseDiscrepancies), add `.eq('plant_id', activePlant.id)`. For direct inserts from UI, stamp `plant_id`. Trigger-inserted rows inherit via a small follow-up (Phase D) — for now they remain nullable, which is fine.

**Helper:** add `usePlantId()` thin wrapper around `usePlant()` returning `activePlant?.id` so hooks don't all import context boilerplate. Hooks early-return `[]` / skip query when `plantId` is undefined (still loading).

**Universal tables untouched:** products, raw_materials, vendors, customers, BOMs, NPD/R&D, DASH, containers, complaints, users — they remain shared across plants exactly as you confirmed.

### Safety / rollback

- Each hook edit is a single file. If a page breaks, revert that one hook.
- `plant_id` stays nullable through Phase C, so any code path we miss still inserts successfully (just unscoped — visible to all plants temporarily, fixed when that hook is updated).
- No migration in Phase C except the RLS policies on `public.plants` for the management page.
- Phase D (later): NOT NULL on `plant_id`, RLS filtering by user's allowed plants, trigger-side stamping for receipts/discrepancies/movements.

### Deliverables this round

1. Migration: RLS policies on `public.plants` (admin write, authenticated read).
2. `src/pages/PlantsManagement.tsx` + add/edit dialogs.
3. Route + nav entry under Settings.
4. `src/hooks/usePlantId.ts` helper.
5. Phase C hook edits in the order above — I'll do them step by step and pause after each major hook so you can confirm the corresponding page still works before moving on.

Confirm and I'll start with the Plants Management page + step 1 (Inventory).
