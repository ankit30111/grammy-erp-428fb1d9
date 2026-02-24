
Goal: resolve “unable to login” in a way that works even when network is flaky and removes confusing infinite spinners.

What I found from your current project state
- Your Supabase project is reachable and active.
- Your user `ankitm@grammyelectronics.com` exists in `auth.users` and is confirmed.
- I can reproduce a real `400 invalid_credentials` response when calling `/auth/v1/token` from the app flow.
- Your preview logs also show intermittent browser-side `TypeError: Failed to fetch` for the same endpoint.
- So there are two overlapping problems:
  1) credentials are being rejected at least sometimes, and
  2) network failures create confusing UX (spinner/retry confusion).

Critical clarification already captured
- You selected: “Infinite loading” as the visible issue.
- You also said: “Password is correct.”

Why this still feels “broken” even after previous fixes
- Auth logic is currently split across `AuthContext`, `AuthPage`, and `AuthGuard`, each doing independent `getSession()` checks.
- `AuthGuard` still has no timeout protection on `getSession()`, so it can remain loading forever in bad network conditions.
- Login error handling does not provide a recovery path (no “forgot password” flow), so `invalid_credentials` leaves users blocked.

Implementation plan

Phase 1 — Unify auth resolution (remove infinite loading at source)
1) Make `AuthContext` the single source of truth for auth status.
   - Keep one controlled initialization path with timeout.
   - Expose a deterministic auth state (`loading`, `authenticated`, `unauthenticated`).
2) Refactor `AuthGuard` to consume `useAuth()` instead of calling its own `supabase.auth.getSession()`.
   - Remove duplicate listener/session check logic from `AuthGuard`.
   - This prevents independent hanging states.
3) Simplify `AuthPage` to rely on context state instead of running a second full auth bootstrapping sequence.
   - If `loading`: show loader.
   - If authenticated: navigate `/dashboard`.
   - Else: show sign-in form.

Phase 2 — Harden sign-in behavior for both failure classes
4) In `SignInForm`, normalize credentials before submit:
   - `email.trim().toLowerCase()`
   - `password` untouched
5) Add guarded submit flow:
   - prevent double-submit
   - add request timeout/retry once for transient fetch failures (short backoff)
6) Improve error mapping:
   - `invalid_credentials` → clear, user-friendly message (“email/password mismatch”)
   - network fetch failure → network guidance message
   - keep fallback generic error for unknown cases

Phase 3 — Add immediate recovery path (so team can regain access)
7) Add “Forgot password?” in sign-in UI.
8) Implement reset request:
   - `supabase.auth.resetPasswordForEmail(...)`
   - confirmation toast
9) Add reset-password route/page (if not existing):
   - accept recovery session from Supabase
   - allow setting new password
   - redirect to sign-in after success

Phase 4 — Prevent silent lockouts with better observability
10) Add lightweight debug telemetry (console, non-sensitive):
   - auth phase transitions
   - timeout reached
   - categorized error codes
11) Ensure loading always terminates:
   - every async auth path must end in `setLoading(false)` or equivalent state update
   - no branch that can hang indefinitely

Files to update
- `src/contexts/AuthContext.tsx` (single source auth state + timeout reliability)
- `src/components/Auth/AuthGuard.tsx` (consume context, remove duplicate checks)
- `src/components/Auth/AuthPage.tsx` (presentation-only + redirect by context)
- `src/components/Auth/SignInForm.tsx` (normalized input, retry, clearer errors, forgot password CTA)
- `src/pages/Auth.tsx` (if minor wiring needed)
- New files likely:
  - `src/components/Auth/ForgotPasswordForm.tsx` (optional split component)
  - `src/pages/ResetPassword.tsx` (or equivalent route component)
- `src/App.tsx` (add reset-password route)

Technical details (for your engineering team)
```text
Current (problematic):
AuthPage.getSession() + AuthGuard.getSession() + AuthContext.getSession()
   -> multiple listeners/checks
   -> race conditions, duplicate loading states
   -> possible infinite spinner branch

Target:
AuthContext bootstraps once (timeout protected)
   -> AuthPage + AuthGuard consume context state only
   -> SignInForm performs login only
   -> deterministic transitions:
      loading -> authenticated OR unauthenticated
```

Acceptance criteria
1) No infinite spinner on `/` or protected routes, even with failing network.
2) Invalid credentials show explicit error within one attempt.
3) Network fetch failures show explicit network error (no generic confusion).
4) User can recover account via “Forgot password” without admin intervention.
5) Successful login routes to `/dashboard` consistently.
6) End-to-end tested:
   - valid login
   - wrong password
   - offline/blocked network
   - stale token in localStorage
   - password reset flow completion

Risk notes
- If corporate/firewall blocks `*.supabase.co`, password reset mail request may also fail from that network; UX will still show exact failure reason.
- If SMTP/provider settings are misconfigured in Supabase, reset email send will fail clearly and can be corrected in dashboard.

Execution order I will follow after approval
1) Refactor AuthGuard/AuthPage to context-driven state.
2) Harden SignInForm behavior and messaging.
3) Add reset-password flow and route.
4) Run E2E verification matrix above.
