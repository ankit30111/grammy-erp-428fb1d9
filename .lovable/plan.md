
## What’s actually happening (confirmed from your logs)
This is **not a “wrong password” bug** anymore. Your browser is unable to reach your Supabase project at all.

Evidence:
- The app’s network requests to:
  - `https://oacdhvmpkuadlyvvvbpq.supabase.co/auth/v1/token?...`
  - `https://oacdhvmpkuadlyvvvbpq.supabase.co/auth/v1/recover?...`
  are failing with **`TypeError: Failed to fetch`** (no HTTP status code returned).
- You confirmed that even opening this URL directly fails on your network:
  - `https://oacdhvmpkuadlyvvvbpq.supabase.co/auth/v1/health`
- Supabase Auth logs are empty, consistent with **requests not reaching Supabase**.

So the ERP frontend loads, but the backend (Supabase) is **blocked/unreachable at the network/DNS/TLS level**. That’s why:
- Login fails
- Forgot password fails (no email gets triggered)
- The app can’t load org data

No amount of “clear cache / different browser” will fix this if the domain cannot be reached.

---

## Phase 0 (Urgent, 15 minutes): Get you unblocked operationally
### A) Verify it’s network/DNS by trying ONE alternate network
1. Connect the same laptop/phone to a **mobile hotspot** (cellular).
2. Open:
   - `https://oacdhvmpkuadlyvvvbpq.supabase.co/auth/v1/health`
3. If it opens on hotspot but not on your home/office Wi‑Fi → your ISP/router DNS or network is blocking `*.supabase.co`.

### B) Quick DNS fixes (common cause)
If the health URL does not open on your home Wi‑Fi:
- Change DNS to **Cloudflare 1.1.1.1** or **Google 8.8.8.8**:
  - Router DNS settings (best), or
  - Device DNS settings (temporary)
- Enable **DNS-over-HTTPS (DoH)** in the browser:
  - Chrome/Edge: Settings → Privacy and security → Security → “Use secure DNS”
  - Firefox: Settings → Network Settings → Enable DoH

### C) If TLS/certificate error appears
If the browser shows certificate/proxy warnings, it’s almost certainly ISP filtering or a local security product. In that case, the long-term fix is a **custom domain** (below).

**Acceptance check for Phase 0:** once `/auth/v1/health` opens, login + forgot password should stop throwing “Failed to fetch”.

---

## Phase 1 (Code change): Stop infinite spinners and show a “Backend unreachable” screen
Even after network fixes, the app should never trap users in confusing loading states.

### 1) Add a deterministic “Backend Connectivity” check
Implement a small connectivity probe that runs on the login page (and optionally globally):
- Attempt `fetch(SUPABASE_URL + '/auth/v1/health', { mode: 'no-cors' })`
  - If this throws → **network/DNS blocked**
  - If it succeeds (opaque response) → network path exists; auth failures are “real” HTTP responses
- Also check `navigator.onLine`

### 2) UI behavior
When Supabase is unreachable:
- Replace spinner/login form with a clear panel:
  - “Cannot reach ERP backend (Supabase).”
  - Show:
    - Supabase host
    - Current origin (published/preview)
    - `navigator.onLine` status
  - Buttons:
    - “Open backend health check” (opens the health URL)
    - “Copy diagnostics” (clipboard text: time, UA, origin, supabase url, online status)
  - A short checklist:
    - Try hotspot
    - Change DNS / enable DoH
    - Ask IT to allow `*.supabase.co` (and websocket URL if needed later)

### 3) Where to integrate
- `src/components/Auth/AuthPage.tsx` (primary)
- Optional: `AuthGuard` (if backend is unreachable, show the same panel instead of a blank page/null)

**Acceptance check for Phase 1:** users never see “infinite loading” without explanation; they get an actionable “backend unreachable” message within ~2 seconds.

---

## Phase 2 (Code change): Make Supabase URL configurable (preparing for the real long-term fix)
Right now `src/integrations/supabase/client.ts` is hardcoding URL and anon key.

Change it to:
- Prefer `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`
- Fall back to the current hardcoded values only if env is missing

Why:
- If you adopt a custom domain (next phase), we can switch the app by updating env + redeploy, without rewriting auth code again.

---

## Phase 3 (Long-term, best fix if `supabase.co` is blocked): Use a Supabase Custom Domain
If any of your networks/ISPs block `*.supabase.co`, you should move Supabase API/Auth to your own domain, e.g.:
- `https://api.grammyelectronics.com` or `https://supabase.grammyelectronics.com`

High-level steps (done in Supabase dashboard + DNS provider):
1. Enable **Custom Domain** for your Supabase project (API/Auth).
2. Add the required DNS records (usually CNAME).
3. Wait for certificate issuance/verification.
4. Update `VITE_SUPABASE_URL` to the custom domain and redeploy.

This typically bypasses crude ISP/domain blocks and looks like “your own” infrastructure.

---

## Phase 4 (Once connectivity works): Ensure password reset links actually arrive
After the network issue is resolved:
1. Update Supabase auth client to `flowType: 'pkce'` (recommended for modern reset flows)
2. In Supabase Auth settings, ensure these are set:
   - **Site URL** = your primary published URL
   - **Additional Redirect URLs** includes:
     - `https://grammy-erp.lovable.app/*`
     - your preview URL(s) if you still use them
     - (and later) your custom domain app URL if you add one
3. Check email deliverability:
   - spam/promotions
   - SMTP configuration (if you use custom SMTP)

**Acceptance check for Phase 4:** password reset request returns success and the user receives an email; reset flow completes and can sign in.

---

## Files planned to touch (code)
- `src/integrations/supabase/client.ts`
  - read env for URL/key
  - (later) switch `flowType` to `pkce`
- `src/components/Auth/AuthPage.tsx`
  - add “backend connectivity” detection + UI
- (optional) `src/components/Auth/AuthGuard.tsx`
  - show the same “backend unreachable” panel instead of blank/null on protected routes
- Add a small helper module, e.g. `src/utils/supabaseConnectivity.ts` (probe + diagnostics formatting)

---

## Why I’m confident this is the right direction
You personally confirmed the strongest possible test: the Supabase health URL doesn’t open in the browser. If the browser can’t open the backend domain, the app cannot authenticate or load data, regardless of code.

The fastest path to restore access is:
1) make Supabase reachable (hotspot/DNS/DoH/whitelist/custom domain),
2) add UI diagnostics so this never blocks you silently again.
