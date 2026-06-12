## Goal
On the Factory Dashboard, the scope dropdown should only offer **two options** based on what's selected in the header Plant Switcher:

1. The plant currently active in the header (e.g. "Plant A")
2. **All plants (company)**

The other plant(s) you have access to should NOT appear in the dashboard dropdown — to switch to them, you use the header plant switcher first.

## Behavior

- **Default on load:** dashboard scope = the header's active plant (single-plant view).
- **Switching the header plant:** dashboard scope automatically follows the new header plant (resets to single-plant view of the newly chosen plant).
- **User flips dashboard scope to "All plants":** company-wide rollup is shown. This choice is *not* persisted across header plant changes — switching the header plant snaps the dashboard back to that plant.
- If you only have access to one plant, the dashboard dropdown still shows "[That plant]" + "All plants (company)" so company rollup is always reachable.

## Files to change

1. **`src/components/Dashboard/DashboardScopeSwitcher.tsx`**
   - Read `activePlant` from `usePlant()`.
   - Render only two `SelectItem`s: `activePlant` and "All plants (company)".
   - Remove the loop over all `plants`.
   - Remove the `if (plants.length <= 1) return null` guard so the company rollup is always available.

2. **`src/contexts/DashboardScopeContext.tsx`**
   - When `activePlant` changes (header switch), set `scopePlantId` to the new `activePlant.id` (overriding any stored value), so the dashboard always defaults to the header plant.
   - Drop the "remember last choice in localStorage across plant switches" behavior. localStorage can still cache the All-plants vs single-plant intent *within the same header plant session*, but a header change always wins.

## Out of scope
- No changes to operational pages, header plant switcher, or any widget data hooks. Widgets keep reading `scopePlantId` exactly as today.
