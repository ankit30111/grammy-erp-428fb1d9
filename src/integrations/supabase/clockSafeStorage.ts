/**
 * Session storage that works on a computer whose clock is wrong.
 *
 * The login server stamps every session with `expires_at` in SERVER time
 * (now + 1 hour). supabase-js decides "has this expired?" by comparing that
 * stamp with the COMPUTER's clock. On a PC whose clock is an hour or more
 * ahead, every brand-new session already looks expired, so every request
 * refreshes the token again - about 30 refreshes in 3 seconds - until the
 * chain breaks and the user is thrown back to the login page. On a PC whose
 * clock is behind, the token is not refreshed in time and requests fail with
 * "JWT expired" until it is. (store.gacoustics@outlook.com on one store PC,
 * Sep 2026.)
 *
 * Fix: when a NEW access token is saved, measure how far this computer's clock
 * is from the server (now - the token's `iat`, which the server set a moment
 * ago) and move `expires_at` into this computer's time. supabase-js then
 * refreshes at the right moment whatever the clock says. The difference is
 * kept so the app can tell the user to correct the clock.
 */

const SESSION_KEY = "supabase.auth.token";
const SKEW_KEY = "erp.clockSkewSeconds";
/** Below this the difference is network delay, not a wrong clock. */
const IGNORE_SECONDS = 60;

function local(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function issuedAt(token: string): number | null {
  try {
    const part = token.split(".")[1];
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.iat === "number" ? json.iat : null;
  } catch {
    return null;
  }
}

/** Seconds this computer's clock is ahead of the server (negative = behind). */
export function clockSkewSeconds(): number {
  const n = Number(local()?.getItem(SKEW_KEY) ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export const clockSafeStorage = {
  getItem(key: string): string | null {
    return local()?.getItem(key) ?? null;
  },
  setItem(key: string, value: string): void {
    const ls = local();
    if (!ls) return;
    let out = value;
    if (key === SESSION_KEY) {
      try {
        const next = JSON.parse(value);
        if (next?.access_token && typeof next.expires_at === "number") {
          let prev: any = null;
          try { prev = JSON.parse(ls.getItem(key) ?? "null"); } catch { /* ignore */ }
          if (prev?.access_token === next.access_token && typeof prev.expires_at === "number") {
            // Same token saved again (e.g. user details updated): keep its adjusted expiry.
            next.expires_at = prev.expires_at;
          } else {
            const iat = issuedAt(next.access_token);
            if (iat !== null) {
              const skew = Math.round(Date.now() / 1000 - iat);
              const useful = Math.abs(skew) > IGNORE_SECONDS ? skew : 0;
              next.expires_at += useful;
              ls.setItem(SKEW_KEY, String(useful));
            }
          }
          out = JSON.stringify(next);
        }
      } catch {
        /* not a session - store as given */
      }
    }
    ls.setItem(key, out);
  },
  removeItem(key: string): void {
    local()?.removeItem(key);
  },
};
