# Grammy ERP — Audit Findings & Go-Live Plan

_Audit date: 2026-04-22 · Project: `oacdhvmpkuadlyvvvbpq` (Grammy Electronics ERP, ap-south-1, Postgres 15.8)_

## TL;DR — why it feels unreliable today

1. **The Supabase project was paused** when I started — that alone causes "random" failures in production until it warms back up. (Restored.)
2. **134 RLS policies effectively allow any logged-in user to do anything** on 90 tables. Policies were never cleaned up between Lovable iterations, so each table has 3-9 stacked, redundant, "always-true" rules. This is a security and reliability problem (no audit trail of "who can do what"), and a perf problem (Postgres re-evaluates every policy on every row).
3. **The role/department model exists in the schema (`user_accounts.role`, `departments`, `department_permissions`) but is not wired into the database** — all access control is happening client-side, which means anyone with a valid login token + a few `curl` calls can read/write anything.
4. **76 foreign keys are missing covering indexes** — every join, every `DELETE` cascade check, every dropdown lookup is a sequential scan. This compounds as data grows.
5. **72 RLS policies call `auth.uid()` per row** instead of caching it once per query — a classic Lovable footgun, easy fix, big win.
6. **5 SECURITY DEFINER views** silently bypass RLS — data leakage waiting to happen.
7. **Edge function drift**: `send-whatsapp-iqc-notification`, `test-whatsapp-direct`, `whatsapp-webhook` are deployed in production but **not checked into the GitHub repo** — they could be lost if the project is ever rebuilt from source.
8. Postgres is on a version with outstanding security patches.
9. Leaked-password protection (HIBP check) is disabled.

---

## Detailed findings

### A. Security advisors — 147 findings

| Severity | Issue | Count | Fix |
|---|---|---|---|
| ERROR | `security_definer_view` — view bypasses RLS | 5 | Recreate as `SECURITY INVOKER` |
| WARN | `rls_policy_always_true` — policy with `USING(true)` | 134 | Replace with role/department-aware policies |
| WARN | `public_bucket_allows_listing` — storage bucket lists files publicly | 4 | Make private, serve via signed URLs |
| WARN | `auth_leaked_password_protection` disabled | 1 | Enable in Auth settings (HIBP) |
| WARN | `function_search_path_mutable` | 1 | Add `SET search_path = public, pg_catalog` |
| WARN | `vulnerable_postgres_version` | 1 | Upgrade Postgres to latest 15.x patch |
| INFO | `rls_enabled_no_policy` (locks the table out) | 1 | `production_line_assignments` — add a policy or disable RLS |

#### The 5 SECURITY DEFINER views
`material_requirements_view`, `capa_approvals_view`, `material_shortages_calculated`, `purchase_order_received_quantities`, `capa_tracking_with_links`

#### Tables with the most stacked permissive policies (all "always true")
| Table | Policies | All "always true" |
|---|---|---|
| `products` | 9 | 9 |
| `vendors` | 9 | 9 |
| `customers` | 9 | 9 |
| `user_accounts` | 7 | 7 |
| `vendor_capa` | 7 | 5 |
| `bom` | 5 | 5 |
| `raw_materials` | 5 | 5 |
| `projections` | 7 | 4 |
| `dispatch_orders` / `dispatch_order_items` | 4 each | 4 each |
| `kit_preparation` / `kit_items` | 4 each | 4 each |
| ...and ~25 more tables with 3-4 stacked policies | | |

### B. Performance advisors — 385 findings

| Severity | Issue | Count | Impact |
|---|---|---|---|
| WARN | `multiple_permissive_policies` — overlapping policies all run | 151 | 2-3× slowdown on every query |
| WARN | `auth_rls_initplan` — `auth.uid()` called per row | 72 | Massive at scale; trivial fix |
| INFO | `unindexed_foreign_keys` | 76 | Slow joins, slow cascades |
| INFO | `unused_index` | 86 | Slows down writes; safe to drop |

### C. Schema & data state

- 90 public tables, 0 rows in every table — system is **pre-production** (no real data yet). This means we can be aggressive with destructive fixes (drop/recreate policies, rename columns, etc.) without a backup-and-migrate dance.
- A parallel `dash_*` schema (~20 tables): `dash_products`, `dash_factory_orders`, `dash_inventory`, `dash_sales_orders`, `dash_service_tickets`, `dash_spare_parts`, etc. **Looks like a second product domain ("Dash") layered on top of the main ERP.** Need to confirm whether this is intentional or leftover.
- Auth model in place but unused by RLS:
  - `user_accounts(id, username, email, role text default 'user', is_active, department_id)`
  - `departments(id, name)`
  - `department_permissions(department_id, tab_name)` — UI-level only

### D. Edge functions — drift between repo and prod

| Function | In repo | Deployed | Notes |
|---|---|---|---|
| `admin-create-user` | ✅ v29 | ✅ ACTIVE | Looks solid; CORS wide-open (`*`); 6-char password min is weak |
| `admin-update-user-password` | ✅ v1 | ✅ ACTIVE | Looks solid; same CORS issue; same weak password rule |
| `ldb-scraper` | ✅ v26 | ✅ ACTIVE | (Not yet reviewed in detail) |
| `send-whatsapp-iqc-notification` | ❌ MISSING | ✅ ACTIVE v15 | Drift — at risk of loss |
| `test-whatsapp-direct` | ❌ MISSING | ✅ ACTIVE v8 | Drift — looks like a debug function in prod |
| `whatsapp-webhook` | ❌ MISSING | ✅ ACTIVE v8 | Drift |

### E. Frontend (high-level — deeper scan pending)
- Stack: React 18 + Vite + TypeScript + shadcn/ui + TanStack Query + react-hook-form + Zod
- 26 module folders under `src/components/` (Approvals, BOM, Container, Dash, Dashboard, HR, PPC, Planning, Production, Products, Projections, Purchase, PurchaseDiscrepancies, Quality, RnD, Store, UserManagement, plus Auth & Layout)
- 86 SQL migrations checked in (high churn from Lovable; many likely apply on top of each other)
- `.env` only contains the public anon key + project URL → safe to be in git, no leak

---

## Prioritized fix plan

I propose four phases, in order of go-live blocker severity. We can do each as a separate Supabase migration so changes are reversible.

### Phase 1 — Security & access control (BLOCKER for go-live)
1. **Build a `has_role()` SQL helper** that reads `user_accounts.role` and `user_accounts.department_id` for the current `auth.uid()`, marked `STABLE SECURITY DEFINER` with locked search_path.
2. **Drop all 134 "always true" policies**, replace with one consolidated policy per (table, action) that checks role/department via `has_role()`.
3. **Convert 5 `SECURITY DEFINER` views to `SECURITY INVOKER`** (or rewrite the few that genuinely need elevated access into RPC functions).
4. **Add the missing policy** on `production_line_assignments`.
5. **Make 4 public buckets private**, serve docs via signed URLs.
6. **Enable HIBP leaked-password check** + raise password min to 10 chars in the two admin edge functions.
7. **Lock down CORS** in edge functions to your real frontend origin instead of `*`.
8. **Upgrade Postgres** to latest 15.x patch.

### Phase 2 — Performance & query plumbing
9. Replace `auth.uid()` with `(SELECT auth.uid())` in remaining 72 policies (done as part of Phase 1 for tables we touch).
10. **Add 76 missing FK indexes** (single migration, ~3 lines each).
11. **Drop the 86 unused indexes** (safe — they're just slowing writes).
12. Fix `update_capa_implementation_checks_updated_at()` to set `search_path`.

### Phase 3 — Reliability & code hygiene
13. **Pull the 3 WhatsApp edge functions out of prod into the repo** so they're versioned.
14. **Decide the fate of the `dash_*` parallel schema** — merge, keep, or delete.
15. **Consolidate the 86 migrations** into a clean baseline so a fresh deploy works without 86 sequential applies (optional but recommended pre-launch).
16. **Add error boundaries + toast on every Supabase mutation in the frontend** (TanStack Query has nice patterns for this).
17. **Add a `supabase.from(...).throwOnError()` policy** in the client to surface silent failures.

### Phase 4 — Workflow polish (per module)
18. Walk through each module (IQC → PQC → OQC → Purchase/GRN → Vendor CAPA → Production → Forecasting → HR) and:
    - Validate forms with Zod (already a dep; many forms likely don't use it)
    - Add loading/empty/error states
    - Add optimistic updates where it matters
    - Confirm permissions block the action server-side, not just hide the button

---

## What I need from you to proceed

1. **Confirm the `dash_*` schema decision** (keep separate / merge / delete).
2. **List of intended user roles + per-module access** (e.g., "QC team can read+write IQC/PQC/OQC, view Purchase, no access to HR/Payroll"). I can suggest a default based on the `departments` you have.
3. **Approval to start applying Phase 1 fixes**. Since the DB is empty, I recommend applying directly to production rather than via a dev branch — but I'll show you each migration before running it.
