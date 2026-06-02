## Goal

Replace "everyone sees everything" with a real, enforced access model built on three pillars: **Role → Plants → Modules**. Plus give Admin/Management a UI to manage the production-floor structure (lines, sub-assemblies).

## The three concepts

```text
USER ── role ──► admin | user
   │
   ├── belongs to ──► one or more PLANTS   (Grammy Electronics, Grammy Acoustics, …)
   └── belongs to ──► one or more DEPARTMENTS
                           │
                           └── grants ──► one or more MODULES
```

- **Admin** (role = `admin`) bypasses every check — sees and edits everything across all plants.
- Every other user sees only the plants they're in and the modules their department(s) unlock.

## Revised module map (per your call)

We collapse the 12 fine-grained module flags into **7 user-facing modules**. DB keeps the underlying tab names but the UI groups them.

| Module key | Label | Sidebar items it unlocks |
|---|---|---|
| `commerce` | Purchase, Planning, Sales & Imports | Add Projection, PPC, Purchase, Vendors edit, Sales, Spare Orders, Container Tracking (import side) |
| `store` | Store | Store, Inventory, Container Tracking (store side) |
| `production` | Production | Production, Finished Goods, **Production Lines & Sub-Assemblies** |
| `quality` | Quality | Quality Control, Customer Complaints |
| `rnd` | R&D | R&D (NPD, Pre-Existing) |
| `dash` | DASH Brand | /dash workspace |
| `hr` | Human Resources | Management → HR |

Plus two admin-only areas (not a "module" — gated by role + Management department):
- **Management & Master Data** (Products, Raw Materials, Customers, Vendors, Plants, Production Lines, User & Access Control)
- **Approvals** (moves out of Planning into Management/Admin only)

Dashboard / Overview is visible to anyone who is logged in.

## Phase 1 — Database

Single migration:

1. `public.user_plants(user_id, plant_id, granted_at, granted_by)` — PK `(user_id, plant_id)`, FK cascade. GRANT to authenticated (self-read) + service_role; RLS on; self-read policy.
2. Backfill from `user_accounts.default_plant_id`.
3. Helper `public.auth_user_in_plant(plant_id uuid)` — STABLE SECURITY DEFINER, schema-qualified, admin bypass.
4. Re-seed `department_permissions` to the 7-module map above:
   - `Admin`, `Management` → all 7 modules + `approvals`
   - `PPC` / Planning / Purchase / Sales → `commerce`
   - `Store` → `store`
   - `Production` → `production`
   - `Quality` → `quality`
   - `R&D` → `rnd`
   - `HR` → `hr`
   - `Dash` → `dash`
   - `approvals` only to `Admin` and `Management`
5. Admin-only RPCs (mirror `set_user_departments`):
   - `set_user_plants(p_user_id uuid, p_plant_ids uuid[])` — atomic replace + sync `default_plant_id`.
   - `get_user_plants(p_user_id uuid)` → rows with `is_default`.
   - `set_department_modules(p_department_id uuid, p_modules text[])` — atomic replace.
6. **Production lines table** (new):
   - `public.production_lines(id, plant_id FK, code, name, line_type ENUM[`line`,`sub_assembly`,`cell`], is_active, sort_order, notes)`. GRANT + RLS: read for authenticated who can access `production` for that plant; write for admin or `production` module members in that plant.

No existing-table RLS is rewritten in this PR — keeps blast radius small. Tightening other tables to use `auth_user_in_plant` is a separate follow-up.

## Phase 2 — Access Control admin page

New route `/management/access-control` (added to MANAGEMENT sidebar, AdminGuard'd). Three tabs:

**Users**
- Table of all users.
- Row click → side panel: Role (user/admin), Active, **Plants** (multi-select + default star), **Departments** (multi-select + primary star).
- Save calls `set_user_plants` + `set_user_departments` in one go.

**Departments × Modules**
- Matrix: rows = departments, columns = the 7 modules + `approvals`.
- Checkbox toggles call `set_department_modules`.
- Admin row is read-only (always all-on).

**Plants**
- Link to existing `/management/plants` page.

A small header banner shows: *"3 users have no plant assigned, 1 has no department"* so admins catch dead accounts before users complain.

## Phase 3 — Production Lines & Sub-Assemblies management

New page `/management/production-lines` (AdminGuard + `production` module).
- Filter by active plant (uses `PlantContext`).
- Table of lines/sub-assemblies/cells with inline add, edit, deactivate.
- Columns: Code, Name, Type (Line / Sub-Assembly / Cell), Active.
- Cross-linked from Production page so production staff with module access can also manage their own floor structure.

Add it to `managementItems` in `navigationConfig.tsx` with icon `Factory`.

## Phase 4 — Frontend guards (no crashes, graceful denial)

1. **AuthContext** gains:
   - `permittedPlants: Set<string>` loaded via new `auth_my_plants()` RPC at login.
   - `canAccessPlant(plantId)` helper (admin bypass).
   - `canAccessModule(key)` already exists — extend to also map the new collapsed keys.
2. **PlantContext** intersects loaded plants with `permittedPlants`. If empty → render "No plants assigned — contact your administrator" page state, never crash.
3. **Sidebar** filters `navigationItems` and `managementItems` through a `routeToModule` map (lives next to `navigationConfig.tsx`). Items the user can't access simply don't render.
4. **Approvals** moves: remove from the Planning group; render only when the user is admin or in Management. Page wrapped in `<AdminGuard requireModule="approvals" />`.
5. Every top-level page wrapped in `<ModuleGuard module="…" area="…">` so direct URL hits get the friendly Access Denied card instead of a blank page or RLS error.
6. `EditUserDialog` in the existing User Management page gets the same Plants picker so both entry points stay in sync.

## Phase 5 — Defensive polish

- Admin "View sidebar as <user>" preview dropdown — purely client-side filter, no auth switch — to QA permission changes without logging out.
- Toasts on permission save: "User can now access X, Y, Z."

## Technical notes (for the engineer reading this later)

- All new DB functions: `LANGUAGE sql/plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog`, schema-qualified everywhere (per project memory).
- Every `auth.uid()` read stays inside SECURITY DEFINER helpers; frontend reads auth state only from `AuthContext` (per project memory — no direct `supabase.auth.getSession()`).
- New tables: explicit `GRANT … TO authenticated` + `GRANT ALL … TO service_role`. No `anon` grants.
- No existing RLS policies are rewritten in this PR.

## Out of scope (called out so we don't sprawl)

- Per-module read-vs-write split — still single "access / no access" per module.
- Plant-scoping legacy data (PO, GRN, inventory) via RLS — separate PR once this is live and verified.
- Audit-log UI for permission changes (rows already written by existing triggers).
