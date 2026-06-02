## Current state (the duplication)

Right now there are two admin-only pages that both manage users:

1. **`/user-management`** (`src/pages/UserManagement.tsx` → `UserManagementPage`)
   - Tab 1: Create User (calls `admin-create-user` edge function)
   - Tab 2: Manage Users (list + `EditUserDialog` for name/role/active/department)

2. **`/management/access-control`** (`src/pages/management/AccessControl.tsx`)
   - Users tab: pick a user → assign plants + departments (multi)
   - Departments × Modules matrix
   - Plants hint tab

Both show in the sidebar (`User Management` and `Access Control`), both list the same users via `list_user_accounts_for_admin`, and editing a user is split across the two pages — you create here, you set plants/modules there. There is also an orphan `src/pages/Resources.tsx` rendering the same `UserManagementPage` (no route, no nav).

## Plan: one page, one workflow

Make **Access Control** the single home for everything user/permission related, and retire the separate User Management page.

### 1. Fold "Create user" into Access Control
- Add a primary `+ New user` button in the Users tab header of `AccessControl.tsx`.
- Clicking it opens a dialog that wraps the existing `CreateUserForm` (already calls the secure `admin-create-user` edge function). On success: close dialog, invalidate `ac-users`, auto-select the new user so admin can immediately assign plants/departments.

### 2. Fold "Edit user basics" into Access Control
- Extend the right-hand `UserAccessEditor` with an "Account" section at the top showing:
  - Full name (editable)
  - Role (user / admin)
  - Active toggle
  - "Reset password" button → calls existing `admin-update-user-password` edge function via a small dialog.
- Save uses the same `Save` button already in the editor (single call: updates `user_accounts` + `set_user_plants` + `set_user_departments`).
- This replaces what `EditUserDialog` does today.

### 3. Remove the duplicate surface
- Delete the `/user-management` route from `src/App.tsx`.
- Remove the `User Management` entry from `navigationConfig.tsx` (keep only `Access Control`).
- Delete now-unused files:
  - `src/pages/UserManagement.tsx`
  - `src/pages/Resources.tsx` (already orphaned)
  - `src/components/UserManagement/UserManagementPage.tsx`
  - `src/components/UserManagement/CreateUserForm.tsx` → keep, but move under `src/components/AccessControl/` and import from the dialog above (or leave path, just stop exporting the page wrapper).
  - `src/components/UserManagement/UsersList.tsx` (superseded by Access Control users list)
  - `src/components/UserManagement/EditUserDialog.tsx` (superseded by inline editor)

### 4. Small polish
- Rename sidebar label from "Access Control" to **"Users & Access"** so it's obvious this is where you create users too.
- Keep the existing tabs inside: `Users` · `Departments × Modules` · `Plants`.

## Out of scope
- No changes to the underlying RPCs (`list_user_accounts_for_admin`, `set_user_plants`, `set_user_departments`, `admin-create-user`, `admin-update-user-password`) — they already cover everything we need.
- No schema changes.
- No change to `AdminGuard` behavior.

## Result
One page (`/management/access-control`, sidebar "Users & Access") where an admin can: create a user → set role/active → assign plants → assign departments → manage department→module access. The duplicate `/user-management` page and its components are gone.
