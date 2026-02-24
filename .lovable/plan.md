

# Fix: Login Page Stuck on Loading Spinner

## Root Cause

The browser has a **stale refresh token** (`7762x4wctqyr`) stored in localStorage. On page load, the Supabase client automatically tries to refresh this token, but the request fails with "Failed to fetch" (network-level failure). The client retries this endlessly, and meanwhile:

1. `AuthContext` never resolves `loading` to `false` because `onAuthStateChange` never fires a conclusive event
2. `AuthPage` calls `getSession()` which also hangs waiting for the token refresh
3. The user sees an infinite loading spinner and never gets the login form

## Fix (3 files)

### 1. `src/integrations/supabase/client.ts`
- Clear localStorage auth data when token refresh fails fatally
- In the existing `onAuthStateChange` handler, when `TOKEN_REFRESHED` fires with no session, remove the stored token key (`supabase.auth.token`) from localStorage

### 2. `src/contexts/AuthContext.tsx`
- Add a **safety timeout** on the initial `getSession()` call (5 seconds). If it hasn't resolved, forcefully clear the session from localStorage and set `loading = false`
- Handle the case where `getSession()` throws/rejects due to network errors -- catch it, clear stale data, and show the login page

### 3. `src/components/Auth/AuthPage.tsx`
- Wrap the `getSession()` call in a try-catch with a timeout
- On any error (including network failures), force-clear the stored session by removing `supabase.auth.token` from localStorage and set `loading = false` so the login form renders
- This ensures the user always sees the login form even when the Supabase endpoint is temporarily unreachable

## Summary of Changes

The core fix is: **if we can't reach Supabase to validate the stored session within 5 seconds, clear the stale token and show the login form.** This prevents the infinite loading loop while still allowing normal auth flow when the network is healthy.

