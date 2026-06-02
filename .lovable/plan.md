## Confirmed Architecture

**Universal (shared across all plants):**
- Products, Raw Materials, BOMs, R&D / NPD
- Customers, Vendors
- Departments, Users, Permissions
- Master data (categories, units, etc.)

**Plant-scoped (separate per plant):**
- Store / Inventory (raw material stock)
- GRN receiving + IQC quality
- Production orders, schedules, vouchers
- PQC, OQC quality records
- Sales orders, dispatch
- Material movements, discrepancies, CAPAs

Plants: **Grammy Electronics**, **Grammy Acoustics**

---

## Phased Rollout (one phase per turn, verify before next)

### Phase A — Foundation (this turn, safe)
1. Migration: create `public.plants` table, seed both plants. Add `default_plant_id uuid` (nullable) to `user_accounts`.
2. Build `PlantContext` (React) + `usePlant()` hook. Reads `default_plant_id`, falls back to first plant, persists selection to `localStorage` and writes back to `user_accounts.default_plant_id`.
3. Add **plant switcher dropdown** in `DashboardLayout` header (next to ThemeToggle).
4. **No query filtering yet.** Switcher is live but every page still reads global data exactly as today. Zero breakage risk.

### Phase B — Add plant_id columns (next turn)
- Add nullable `plant_id uuid references public.plants(id)` to:
  - `inventory`, `grn`, `grn_items`, `purchase_orders`
  - `production_schedules`, `production_orders`, `material_movements`
  - `material_requests`, `store_discrepancies`, `production_discrepancies`
  - `sales_orders`, `dispatch_orders`, `spare_orders`
  - IQC/PQC/OQC tables
- Backfill all existing rows → **Grammy Electronics**.
- Keep columns nullable for safety; no RLS changes yet.

### Phase C — Wire reads page-by-page (subsequent turns)
- One module per turn: Store → Inventory → PPC/GRN → Production → Quality (IQC/PQC) → Sales/Dispatch.
- Update each hook to filter `.eq('plant_id', activePlantId)`.
- Update inserts to stamp `activePlantId`.
- Verify each module before moving to the next.

### Phase D — Lock down (final turn)
- Make `plant_id` NOT NULL on all plant-scoped tables.
- Optional: tighten RLS to enforce plant access via user's allowed plants.

---

## What I'll deliver this turn (Phase A only)

**Migration:**
```sql
CREATE TABLE public.plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.plants TO authenticated;
GRANT ALL ON public.plants TO service_role;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read plants" ON public.plants FOR SELECT TO authenticated USING (true);

INSERT INTO public.plants (code, name) VALUES
  ('GE', 'Grammy Electronics'),
  ('GA', 'Grammy Acoustics');

ALTER TABLE public.user_accounts
  ADD COLUMN default_plant_id uuid REFERENCES public.plants(id);
```

**Code:**
- `src/contexts/PlantContext.tsx` — provider + `usePlant()` hook
- Wrap app in `<PlantProvider>` in `App.tsx`
- `src/components/Layout/PlantSwitcher.tsx` — dropdown in header
- Mount switcher in `DashboardLayout.tsx`

**Zero functional changes to any existing page.** Sidebar/theme already blue from previous turn.

---

Confirm and I'll execute Phase A. After you verify the switcher works on the dashboard, say "Phase B" and I'll add the `plant_id` columns + backfill.
