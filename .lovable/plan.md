# Plan: Search Raw Material / Spare Part by Name or Code

## What will change

On `https://erp.grammyelectronics.com/spare-orders`, the **Raw Material / Spare Part** selector inside **Create Spare Order** will be changed from the current basic dropdown to a searchable combobox.

The same search bar will match both:
- Spare/raw material name, e.g. `Woofer`, `Remote`, `PCB`
- Part/material code, e.g. `RM-001`, `DASH-SPK-REMOTE`

The selected item will continue to show as:
```text
Part Name (Part Code)
```

## Implementation

1. Update `src/pages/SpareOrders.tsx`
   - Replace the current `Select` used for **Raw Material / Spare Part** with the existing `RawMaterialDropdown` component.
   - Pass selected value through `currentItem.raw_material_id`.
   - Keep all current order item logic unchanged.

2. Improve `src/components/PPC/RawMaterialDropdown.tsx`
   - Make the search placeholder clearer: `Search by part name or code...`
   - Keep the command item search value as both code + name so one input searches both fields.
   - Optionally include category in the search value too, without changing the UI.

3. Fix the current build blocker in `supabase/functions/ldb-scraper/index.ts`
   - The current Firecrawl response type no longer exposes `scrapeResponse.data`.
   - Update the scraper to read `markdown` and `html` from the response shape safely, while keeping runtime compatibility.
   - This is needed because the project currently fails type-checking before the UI change can build cleanly.

## Files to modify

| File | Change |
|------|--------|
| `src/pages/SpareOrders.tsx` | Use searchable `RawMaterialDropdown` for spare part selection |
| `src/components/PPC/RawMaterialDropdown.tsx` | Clarify search and ensure name/code search works |
| `supabase/functions/ldb-scraper/index.ts` | Fix TypeScript error blocking build |

## Expected result

Users can open **Create Spare Order**, click **Raw Material / Spare Part**, and type either a part name or material/part code in the same search box to find the correct spare part quickly.