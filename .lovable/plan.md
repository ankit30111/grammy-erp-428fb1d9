Move the Plants Management page into the MANAGEMENT navigation group so it appears alongside Products, Raw Materials, Customers, and Vendors.

Changes:
1. **File move**: `src/pages/PlantsManagement.tsx` → `src/pages/management/PlantsManagement.tsx`
2. **Route**: In `src/App.tsx`, change `/settings/plants` → `/management/plants` and update the import path.
3. **Navigation**: In `src/components/Navigation/navigationConfig.tsx`, add a Plants entry to `managementItems` (icon: `Building2`, label: "Plants", route `/management/plants`).
4. **Settings page**: In `src/pages/Settings.tsx`, remove the Plants card/link.