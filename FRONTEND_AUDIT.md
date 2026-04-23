# Grammy ERP Frontend Audit Report
**Date:** April 22, 2026  
**Scope:** React 18 + Vite + TypeScript Frontend (src/components, src/pages, src/contexts)  
**Stack:** shadcn/ui, TanStack Query, react-hook-form, Zod, Supabase JS client  

**Context:** Recently rebuilt Supabase RLS layer with `auth_user_can_access_module()` permission checks based on user departments + department_permissions. Frontend may have broken access patterns or missing permission error handling.

---

## CRITICAL FINDINGS

### 1. Missing Permission Error Handling on Supabase Queries
**File:** `src/components/Store/EnhancedGRNReceiving.tsx:34-62, src/components/Store/MaterialRequestsTab.tsx:28-71`  
**Lines:** 59-62, 88  
**Issue:** Queries throw errors when RLS denies access, but no specific handling for permission errors (PGRST116 "new row violates row-level security policy"). Users will see generic "Error fetching data" instead of "You don't have access to this module."  
**Fix:** Check error.code for 'PGRST116' or 'PGRST119' and show permission-specific toast message directing users to contact admins.

### 2. Hardcoded Client-Side Permission Checks vs. Server RLS
**File:** `src/components/Auth/AdminGuard.tsx:46`, `src/components/UserManagement/EditUserDialog.tsx:61`, `src/components/Layout/UserProfileDropdown.tsx:15`  
**Lines:** Multiple  
**Issue:** Components check `isAdmin` or `userProfile.role` from AuthContext (derived from user_accounts.role). With new `auth_user_can_access_module()` function, role-based UI gates are now incomplete—a user with 'admin' role might still lack department permissions to access modules. Frontend allows viewing of non-permissioned data in lazy-loaded views.  
**Fix:** Wrap module-specific views with module-level permission check (call DB function or expose permission state in AuthContext), not just role check.

### 3. No Handling of Permission Denied in Promise.all() Parallel Queries
**File:** `src/pages/FinishedGoods.tsx:18-25`  
**Lines:** 18-25  
**Issue:** Promise.all() chains three Supabase queries without error catching per query. If one fails due to RLS (e.g., dispatch_orders denied), Promise.all rejects completely; user sees no data, no clear error reason.  
**Fix:** Wrap each query in try-catch or use `.then().catch()` to allow partial data display (show what succeeded, toast error for what failed).

### 4. Silent Failures in useMutation onError Without Permission Checking
**File:** `src/components/Store/MaterialRequestsTab.tsx:94-138`, `src/components/Store/EnhancedGRNReceiving.tsx:142-200`  
**Lines:** Multiple  
**Issue:** Mutations update records without distinguishing between "permission denied" (PGRST116) and other errors. User sees generic "Failed to process" message. If new RLS causes the mutation to fail silently, user won't know why.  
**Fix:** In `onError`, check error.code and surface specific message: if PGRST116, say "Your department doesn't have permission to modify this record."

### 5. Auth Context Does Not Handle Expired/Refresh Token Errors from RLS Layer
**File:** `src/contexts/AuthContext.tsx:99-143`  
**Lines:** 103-130  
**Issue:** AuthContext listens to onAuthStateChange but doesn't handle TOKEN_REFRESHED with no session gracefully across all queries. If Supabase backend rejects refresh due to RLS policy on the auth.users table (if such policy exists), the user may be silently logged out mid-flow without proper signout.  
**Fix:** Add handler for TOKEN_REFRESHED failure, and cache user profile so brief auth dips don't wipe the UI.

### 6. No RLS Permission Error UI Pattern Across Data Tables
**File:** `src/components/Approvals/PurchaseOrderApprovalsEnhanced.tsx:50-104`, `src/components/Purchase/GRNManagement.tsx` (multiple)  
**Lines:** Multiple  
**Issue:** Data tables (Purchase Orders, GRNs, Material Requests) fetch on mount. If user lacks department access, the table renders loading spinner forever (no isError state shown). New RLS layer will cause many queries to silently fail to fetch.  
**Fix:** Show "Access Denied" card if query throws with PGRST116; provide contact admin button.

---

## HIGH SEVERITY FINDINGS

### 7. Supabase Query Without throwOnError and Unhandled Error in Fetch
**File:** `src/components/Approvals/PurchaseOrderApprovalsEnhanced.tsx:50-67`  
**Lines:** 53-76  
**Issue:** `fetchPendingPOs()` calls `supabase.from().select()` without `.throwOnError()`. Error is caught with `if (error) throw error`, but if supabase client is not configured to throw, error silently returns and causes type errors downstream (trying to map undefined data).  
**Fix:** Add `.throwOnError()` chaining or always check error before accessing data.

### 8. Missing Error Handling on Multiple Sequential Inserts
**File:** `src/components/Quality/BatchReceiptEntry.tsx:93-132`  
**Lines:** 93-132  
**Issue:** Three sequential `.insert()` calls in createBatchMutation: batch create, batch items, then rpc call. If second insert fails, first insert succeeds (orphaned records). No rollback mechanism.  
**Fix:** Use Supabase transactions (if available) or wrap in try-catch with manual cleanup on error.

### 9. dangerouslySetInnerHTML in Chart Component Without Sanitization
**File:** `src/components/ui/chart.tsx:79-96`  
**Lines:** 79-96  
**Issue:** Chart component injects CSS via dangerouslySetInnerHTML with user-controlled config colors. If colors come from DB (user input), could inject arbitrary CSS or HTML. Not a direct XSS risk if colors are enum/validated, but violates principle of least privilege.  
**Fix:** Use `<style>` tag with template literals and explicitly validate color hex values (regex `^#[0-9a-f]{6}$`).

### 10. No Protection Against RLS Bypass via .insert() with count Flag
**File:** `src/components/Store/MaterialRequestsTab.tsx:110-115`  
**Lines:** 110-115  
**Issue:** `.update().select().single()` assumes the update returns exactly one row. If RLS filters the row out, `.single()` throws "No rows returned". Error is caught but user just sees generic "Failed to update" without knowing their department lacks write permission.  
**Fix:** Check error message for "no rows" and map to "insufficient permissions" message.

### 11. useEffect Missing Dependency Array in Auth State Listeners
**File:** `src/contexts/AuthContext.tsx:99`, `src/components/Auth/AuthGuard.tsx:18`  
**Lines:** 99, 18  
**Issue:** Both have `useEffect(..., [])` with empty dependency array. If ever AuthContext or AuthGuard logic needs to respond to external state changes, the listener won't re-subscribe. Currently safe due to empty deps, but fragile pattern.  
**Fix:** Document why deps are empty; consider moving subscription cleanup to useRef if behavior changes in future.

### 12. Large Component Size Increases Bug Surface Area
**File:** `src/components/Approvals/PurchaseOrderApprovalsEnhanced.tsx` (725 lines)  
**Lines:** Entire file  
**Issue:** 725-line component mixes data fetching, UI rendering, and complex approval workflow logic. Hard to test, easy to miss edge cases like permission errors during approval.  
**Fix:** Extract approval action handler and batch data fetch into custom hook (usePurchaseOrderApprovals).

### 13. No Empty State for Permission-Denied Tables
**File:** `src/components/Purchase/GRNManagement.tsx`, `src/components/PPC/ProductionScheduleManagement.tsx`  
**Lines:** Render data directly without checking isLoading/isError  
**Issue:** Tables assume data is always available. If RLS denies access, query errors silently and table renders nothing. User can't distinguish between "no GRNs" and "you don't have access."  
**Fix:** Add explicit empty state: `{isError && error?.code === 'PGRST116' ? <AccessDenied /> : data?.length === 0 ? <NoData /> : <Table />}`

### 14. Console Logging Left in Production Code (Information Leak)
**File:** `src/contexts/AuthContext.tsx:40, 45, 49, 69, 72, 75, 80, 95, 107`, `src/pages/PPC.tsx:49, 64`, `src/components/Store/MaterialRequestsTab.tsx:31, 66, 100, 108, 122, 135`  
**Lines:** Multiple  
**Issue:** console.log, console.error, console.warn statements expose user IDs, auth state, internal business logic (e.g., "Profile fetch already in progress" in line 40 of AuthContext). Should be removed in production build or wrapped in `if (process.env.DEBUG)`.  
**Fix:** Use environment variable to gate console logs: `if (import.meta.env.DEV) console.log(...)`

### 15. No Session Expiration Handling in Deep-Linked Routes
**File:** `src/components/Auth/AuthPage.tsx:29-30`, `src/components/Auth/AuthGuard.tsx:90`  
**Lines:** 29-30, 90  
**Issue:** If user is deep-linked to `/dashboard` with expired refresh token, AuthGuard redirects to `/` but loses the original destination. User is logged out and navigated to home; on re-login, must manually navigate back to original page.  
**Fix:** Store attempted URL in sessionStorage/URL param and redirect there after successful auth.

---

## MEDIUM SEVERITY FINDINGS

### 16. Type Safety Issue: `as any` Casting in Badge Variant
**File:** `src/components/Store/ProductionVoucherList.tsx:139, 144`, `src/components/Production/ProductionLinesOverview.tsx:131`  
**Lines:** Multiple  
**Issue:** Multiple badge variant assignments use `as any` to cast status colors to shadcn Badge variant. If status value is not a valid Badge variant, TypeScript won't catch it; runtime renders wrong styling.  
**Fix:** Create typed status-to-variant mapper function with exhaustive check.

### 17. Form Validation Missing in Multiple Components
**File:** `src/components/Auth/SignInForm.tsx:17-49`  
**Lines:** 17-49  
**Issue:** SignInForm uses basic HTML `required` attribute, not Zod schema. No email format validation, password strength rules. If backend rejects weak password, generic auth error is shown.  
**Fix:** Use react-hook-form + Zod schema for SignInForm.

### 18. Inventory Mutation Race Condition
**File:** `src/components/Store/ProductionVoucherDetails.tsx:147-240`  
**Lines:** 147-240  
**Issue:** sendMaterialsMutation creates kit_preparation, updates inventory, creates kit_items in sequence. Between inventory check and update, another user might dispatch same material. No atomic transaction wraps all three operations.  
**Fix:** Use Supabase transactions or wrap in RPC with SERIALIZABLE isolation.

### 19. No Graceful Degradation if useToast Hook is Missing
**File:** Throughout (100+ files import useToast)  
**Lines:** Implicit  
**Issue:** All toast calls assume `useToast()` succeeds. If hook context is missing, app crashes silently (React throws in console but doesn't propagate).  
**Fix:** Wrap useToast in try-catch or add context boundary error handler.

### 20. Missing Stale Time and Refetch Interval Inconsistency
**File:** `src/components/Store/MaterialRequestsTab.tsx:69-70`, `src/components/Store/EnhancedGRNReceiving.tsx:109` (refetchInterval differs)  
**Lines:** 69-70, etc.  
**Issue:** MaterialRequestsTab refetches every 10 seconds with 5-second staleTime. This causes constant network chatter and potential RLS re-evaluation overhead if permission checks are expensive.  
**Fix:** Align refetch intervals; consider using Supabase realtime instead of polling for permission-gated data.

---

## LOW SEVERITY FINDINGS

### 21. Inconsistent Error Message Formatting
**File:** `src/components/Store/MaterialRequestsTab.tsx:119, 152, 197`, `src/components/Store/EnhancedGRNReceiving.tsx:61, 104`  
**Lines:** Multiple  
**Issue:** Some errors prefixed with descriptive context ("Database error:", "Insufficient inventory"), others are bare. Inconsistent UX.  
**Fix:** Create error formatter utility: `formatSupabaseError(error, context)`.

### 22. Missing Null Coalescing in RelationshipsNested Renders
**File:** `src/components/Store/EnhancedGRNReceiving.tsx:116-119`  
**Lines:** 116-119  
**Issue:** `grn.vendors?.name || "Unknown Vendor"` is safe, but deeply nested relations like `grn.grn_items[i].raw_materials?.name` could be null if relation fetch fails silently.  
**Fix:** Use Zod schema to validate nested relations on fetch.

### 23. No Loading Spinner in PDF Generation
**File:** `src/components/Approvals/PurchaseOrderApprovalsEnhanced.tsx:186-200`  
**Lines:** 186-200  
**Issue:** `handleViewPDF` fetches data and generates PDF. If network is slow, UI doesn't indicate action is in progress (no loader shown).  
**Fix:** Set state to "generating" and show Loader2 spinner while fetching + generating.

### 24. Hardcoded SYSTEM_USER_ID in MaterialRequestsTab
**File:** `src/components/Store/MaterialRequestsTab.tsx:20`  
**Lines:** 20  
**Issue:** `SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001'` is hardcoded. If this ID changes or doesn't exist, mutations fail silently.  
**Fix:** Fetch or import from config; validate on component mount.

### 25. Missing Validation of Quantity Inputs Before Submission
**File:** `src/components/Store/MaterialRequestsTab.tsx:150-152`, `src/components/Store/ProductionVoucherDetails.tsx:166-172`  
**Lines:** Multiple  
**Issue:** Quantity fields accept any number (including 0, negative). Validation happens in DB but not shown in UI pre-submit.  
**Fix:** Add Input min/max or Zod schema for numeric fields.

---

## SUMMARY TABLE

| Severity | Count | Category |
|----------|-------|----------|
| **CRITICAL** | 6 | Permission handling, RLS errors, Promise.all failures |
| **HIGH** | 9 | Error handling, injection, component size, logging, state mgmt |
| **MEDIUM** | 5 | Type safety, validation, race conditions, hook safety |
| **LOW** | 5 | Polish, consistency, UX |

**Total Issues:** 25

---

## BLOCKERS FOR GO-LIVE

1. **Permission Error Handling** — Users will see cryptic "Failed to fetch" instead of "You don't have access." Must add PGRST116 detection and user-friendly messages across all data-fetching components.

2. **Promise.all() Failures** — Pages like FinishedGoods with parallel queries will show blank screens if one query is RLS-denied. Must handle partial failures.

3. **Missing Permission Context** — AuthContext only tracks role, not module-level permissions. Frontend can't make correct UI decisions about what to render. Must extend AuthContext to expose `canAccess(module)` from auth_user_can_access_module().

4. **Admin Role Bypass** — AdminGuard only checks role, not department_permissions. Admin from one department could see all data if RLS is buggy. Ensure RLS policies are tight; consider adding runtime permission check in AdminGuard.

---

## RECOMMENDED FIXES (Priority Order)

### Phase 1: Permission Error Handling (1–2 days)
- [ ] Create utility: `isPermissionError(error) → error.code === 'PGRST116' || error.code === 'PGRST119'`
- [ ] Wrap all useQuery/useMutation onError with permission check
- [ ] Create `<AccessDenied />` component with contact admin button
- [ ] Add to 6 high-impact pages: FinishedGoods, PPC, MaterialRequests, GRNs, Approvals, Production

### Phase 2: Extend AuthContext (1–2 days)
- [ ] Add `canAccessModule(module: string): Promise<boolean>` to AuthContext
- [ ] Call `auth_user_can_access_module` on mount and cache result
- [ ] Pass down as context provider; use in AdminGuard and module-level wrappers
- [ ] Invalidate cache on profile update

### Phase 3: Remove Logging (1 day)
- [ ] Replace all `console.log` with `if (import.meta.env.DEV) console.log(...)`
- [ ] Audit sensitive logs (user IDs, auth state) and remove or redact

### Phase 4: Large Component Refactor (3–5 days, lower priority)
- [ ] Split PurchaseOrderApprovalsEnhanced into hooks (useFetchPOs, useApprovePO, etc.)
- [ ] Reduce file size < 500 lines; improves testability and bug detection

### Phase 5: Form Validation (1–2 days)
- [ ] Add Zod schemas to SignInForm, MaterialRequestsTab, ProductionVoucherDetails
- [ ] Pre-validate quantities, dates, emails before submit

---

## Testing Recommendations

1. **RLS Rejection Simulation** — Temporarily add RLS policy that denies all SELECT to a test table; verify error messages surface correctly.
2. **Slow Network** — Use DevTools throttling (slow 3G); verify spinners appear during data fetch.
3. **Deep-Link with Expired Token** — Close browser, wait > token TTL, re-open deep link; verify graceful redirect.
4. **Permission Boundary Testing** — Create two users in different departments; verify one cannot see the other's data (even in shadow DOM via network tab).

---

**Audit Completed:** April 22, 2026  
**Auditor:** Claude (Frontend Specialist)  
**Status:** READY FOR REVIEW
