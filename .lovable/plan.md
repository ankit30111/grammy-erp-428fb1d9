# Approvals relocation + Plant-scoped Production Lines

## 1. Approvals → Overview (sidebar) + Dashboard widget

**Sidebar (`navigationConfig.tsx`)**
- Remove the Approvals entry from `managementItems`.
- Add it to `navigationItems` directly after Dashboard, in the `OVERVIEW` group, keeping `module: "approvals"` so visibility is unchanged (admins + Approvals module).

**Dashboard widget (`src/pages/Index.tsx`)**
- Add a new `PendingApprovalsWidget` card at the top of the dashboard, visible only when `canAccessModule('approvals') || isAdmin`.
- Shows three counters — Purchase Orders pending, CAPAs pending, CAPA tracking open — each linking to `/approvals` with the matching tab preselected.
- Counts come from existing tables: `purchase_orders` (status pending approval), `iqc_vendor_capa` (status AWAITED), and CAPA tracking source already used in `CAPATrackingTab`. Read via the same hooks those tabs already use, so no new RPCs.
- `Approvals.tsx` accepts a `?tab=purchase-orders|capa-approvals|capa-tracking` query param to drive `defaultValue`.

## 2. Production Lines managed from Plants page

**UI (`src/pages/management/PlantsManagement.tsx`)**
- Add a "Manage Lines" button on each plant row that opens a new `<PlantLinesDialog plantId=… />`.
- Dialog lists that plant's lines/sub-assemblies/cells with inline add / edit / delete and an active toggle.
- Remove the standalone `/management/production-lines` sidebar entry and route (the page is no longer the entry point — keep the page file as the dialog's internals, or delete it; plan deletes it to avoid two ways in).

**Schema additions (single migration)**
- `ALTER TABLE public.production_lines` add:
  - `location_building text`
  - `location_floor text`
  - `location_bay text`
- No data backfill needed; existing rows get NULLs.
- Keep existing RLS/grants intact.

**Form fields in the dialog**
- Code, Name, Type (line / sub_assembly / cell), Sort order, Active.
- Location group: Building, Floor, Bay (three text inputs side by side).
- Notes.

**Validation**
- `(plant_id, code)` uniqueness already enforced — surface as inline error.
- Building/Floor/Bay optional but if any one is filled the others stay optional (no required combo).

## 3. Routing & cleanup

- `App.tsx`: remove the `/management/production-lines` route (replaced by dialog). Approvals route unchanged.
- Sidebar groups end up: OVERVIEW (Dashboard, Approvals), COMMERCE, STORE, PRODUCTION, QUALITY, R&D, WORKSPACES, MANAGEMENT (Products, Raw Materials, Customers, Vendors, Plants, HR, Access Control, User Management).

## Technical notes

- New file: `src/components/Plants/PlantLinesDialog.tsx` (uses existing shadcn Dialog + Table; mirrors current CRUD logic from `ProductionLinesManagement.tsx`).
- New file: `src/components/Dashboard/PendingApprovalsWidget.tsx`.
- Migration file under `supabase/migrations/` adding the three location columns; no GRANT/RLS changes required.
- Types regenerate after migration runs.

## Out of scope

- No changes to permission model, plant assignment, or department×module matrix.
- No structured "locations" lookup table (deferred until you want dropdowns).
