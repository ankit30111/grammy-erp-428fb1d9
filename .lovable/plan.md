### Summary
Add ascending/descending sort controls to the Raw Materials Management table for **Part Code**, **Category**, and **Vendors** columns.

### How
1. **State**: Add a `sortConfig` state in `RawMaterialsManagement.tsx` to track which column is sorted and in which direction (`asc` | `desc`).
2. **Sort Logic**: Apply the sort to the already-client-side `filteredMaterials` array before rendering. Sorting is done in-memory; no API changes are needed.
3. **UI Controls**: Add clickable header buttons on the **Material Code**, **Category**, and a derived vendors column. Each click toggles the sort direction for that column and resets other columns. Use `ArrowUpDown`/`ArrowUp`/`ArrowDown` icons from `lucide-react` to indicate the active sort state.
4. **Vendors Sort**: Sort by the primary vendor name (if assigned), then alphabetically by the first associated vendor name as a fallback.

### Files Changed
- `src/pages/management/RawMaterialsManagement.tsx` — add sort state, sort logic, and header controls

### Not in Scope
- No database or API changes (data is already fetched in full and filtered client-side).