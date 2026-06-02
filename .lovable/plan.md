## Phase B — Add `plant_id` to plant-scoped tables

Goal: stamp every plant-scoped row with a plant. **Nullable column + backfill + index.** No RLS changes, no app-code changes. Existing reads keep working unchanged.

### Tables that get `plant_id uuid REFERENCES public.plants(id)`

Confirmed present in DB:
- `inventory`
- `grn`, `grn_items`
- `purchase_orders` (NOT `purchase_order_items` — derived via parent PO)
- `production_schedules`, `production_orders`
- `production_material_receipts`, `production_discrepancies`
- `material_movements`, `material_requests`
- `store_discrepancies`
- `iqc_vendor_capa`
- `dispatch_orders`, `spare_orders`

Skipped (universal): products, raw_materials, vendors, customers, BOMs, users, departments, NPD/R&D, DASH tables, container tables, complaints.

Note: `sales_orders` table doesn't exist in this DB — sales appears to flow through `dispatch_orders` / `spare_orders`. No action needed.

### Migration plan (single migration)

For each table above:
```sql
ALTER TABLE public.<t> ADD COLUMN IF NOT EXISTS plant_id uuid REFERENCES public.plants(id);
UPDATE public.<t> SET plant_id = (SELECT id FROM public.plants WHERE code='GE') WHERE plant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_<t>_plant_id ON public.<t>(plant_id);
```

All rows backfilled to **Grammy Electronics** (code `GE`). Column stays nullable in Phase B so any code path that inserts without `plant_id` still works.

### Safety

- No DROP, no NOT NULL, no RLS edits, no policy changes.
- Existing hooks/queries continue to ignore `plant_id` → no behavior change.
- Adds indexes so Phase C filtering will be fast.
- `types.ts` will auto-regenerate after migration runs.

### Out of scope (later phases)

- Phase C: page-by-page filter `.eq('plant_id', activePlantId)` + stamp inserts.
- Phase D: NOT NULL + RLS by plant access.

Confirm and I run the migration.
