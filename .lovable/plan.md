## Goal

Make scheduled production editable/deletable only **before the kit is sent from store**. After that, block edit/delete with a clear reason. Admins bypass the block. Completed orders disappear from "Scheduled Production".

## Rules

A schedule is **locked** when its linked `production_orders` row has any of:
- `kit_status` in (`KIT SCHEDULED`, `KIT PREPARING`, `KIT READY`, `KIT VERIFIED`, `KIT SENT`, `KIT SHORTAGE`) — i.e. anything past `NOT_PREPARED`
- `status` in (`MATERIALS_SENT`, `IN_PROGRESS`, `PENDING_OQC`, `COMPLETED`)

Admin (`auth_is_admin()`) ignores the lock.

A schedule is **completed** when production_order `status = 'COMPLETED'` → hidden from Scheduled Production list, shown under Completed Production.

## Database changes (single migration)

1. **Helper function** `public.production_schedule_locked(p_schedule_id uuid) returns text` — returns NULL if free to modify, otherwise a human reason like `"Kit already sent to production (voucher PROD_06_03)"` or `"Production already in progress"`. Used by both triggers and RPCs so the message is identical everywhere.

2. **BEFORE UPDATE/DELETE triggers** on `production_schedules` and on `production_orders` that:
   - Skip if `public.auth_is_admin()` is true.
   - Call the helper and `RAISE EXCEPTION '%', reason USING ERRCODE = 'P0001'` when locked.
   - Allow the cascade path from the RPC below (detected via a `set_config('app.cascade_delete','1', true)` flag set inside the RPC).

3. **RPC** `public.delete_production_schedule_cascade(p_schedule_id uuid)` — SECURITY DEFINER, runs inside a transaction:
   - Checks lock (with admin override).
   - Sets the cascade flag.
   - Deletes child rows in the correct order (`material_blocking`, `kit_preparation`, `material_requests`, `line_rejections`, `hourly_production`, `pqc_reports`, `production_capa`, `production_material_discrepancies`, `finished_goods_inventory`) — these are the non-cascading FKs blocking delete today.
   - Deletes `production_orders`, then `production_schedules`.
   - Returns void; raises with friendly message on failure.

4. **Align RLS** on `production_schedules` and `production_orders` DELETE/UPDATE policies to allow `auth_user_can_access_module('planning')` OR `'production'` OR admin (currently production-only, which silently blocks Planning users).

## Frontend changes

1. **`useProductionSchedules.ts`**
   - Rewrite `useDeleteProductionSchedule` to call `supabase.rpc('delete_production_schedule_cascade', { p_schedule_id })`. Surface the Postgres error message verbatim in the toast (e.g. "Kit already sent to production").
   - Same handling in `useUpdateProductionSchedule` — let the trigger reject and show its message.

2. **`useProductionSchedules` query**
   - Filter out schedules whose production_order `status = 'COMPLETED'` so they leave the Scheduled list. (Completed view already exists separately.)

3. **Lock-aware UI** in the schedules table / `EditScheduleDialog` / `DeleteScheduleDialog`:
   - Compute `isLocked` from the joined `production_orders` (`status !== 'SCHEDULED'` or `kit_status !== 'NOT_PREPARED'`).
   - If locked and user is not admin: disable Edit/Delete buttons and show a tooltip "Kit already sent — cannot modify". Admin sees the buttons enabled.
   - `DeleteScheduleDialog` displays the lock reason (if any) instead of the confirm button when non-admin.

4. **Admin detection** — read from `AuthContext` (existing `profile.role === 'admin'`); no new fetch.

## Technical notes

- All triggers/functions schema-qualified, `SET search_path = public, pg_catalog`, per project memory.
- The `set_config('app.cascade_delete',...,true)` flag is transaction-local; trigger checks `current_setting('app.cascade_delete', true) = '1'`.
- Toast wording uses Postgres `MESSAGE`; the RPC raises with `USING MESSAGE = ...` so the frontend gets the exact string.
- Completed orders already exist in `ProductionVoucherList`/Completed views — no new screen needed, just filter the scheduled query.

## Out of scope

- Restoring deleted child rows (delete is final once unlocked).
- Reworking kit status enum or store→production workflow.
- Edits to OQC/PQC/CAPA modules.
