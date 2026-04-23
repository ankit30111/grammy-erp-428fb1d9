/**
 * Permission / RLS error helpers.
 *
 * Why this file exists:
 *   The Supabase RLS layer was rebuilt in migration 002 to actually enforce
 *   per-module / per-department access. This means queries and mutations that
 *   used to silently succeed will now fail with specific error codes when the
 *   caller doesn't have access. Surface those failures with clear language
 *   instead of a generic "Failed to fetch".
 *
 * What counts as a "permission error":
 *
 *   1. Postgres "42501" (insufficient_privilege)
 *      - Returned by Supabase on INSERT/UPDATE/DELETE when the row violates
 *        an RLS WITH CHECK / USING clause.
 *      - Message looks like: "new row violates row-level security policy for table ..."
 *
 *   2. PostgREST "PGRST116" (no rows returned where one was expected)
 *      - Returned when `.single()` is used and RLS filters out the only row
 *        the user would otherwise have seen.
 *
 *   3. PostgREST "PGRST301" (JWT expired) — treat as a session/permission
 *      issue so the UI can prompt a re-login.
 *
 *   4. Free-text fallback: any error message containing the phrase
 *      "row-level security" or "row level security".
 */

// Loose shape — Supabase errors can come from postgrest-js, GoTrue, or
// network layers, and we want to handle all of them without dragging the full
// Supabase types in here.
export type SupabaseLikeError =
  | {
      code?: string | null;
      message?: string | null;
      details?: string | null;
      hint?: string | null;
    }
  | Error
  | null
  | undefined;

const RLS_PHRASES = ["row-level security", "row level security"];

/** True if the error came from RLS denying access (read or write). */
export function isPermissionError(err: SupabaseLikeError): boolean {
  if (!err) return false;

  const code = (err as { code?: string | null }).code ?? "";
  if (
    code === "42501" || // postgres insufficient_privilege
    code === "PGRST116" || // .single() with no rows — almost always RLS in our app
    code === "PGRST301" // expired JWT
  ) {
    return true;
  }

  const message =
    typeof (err as Error).message === "string"
      ? (err as Error).message.toLowerCase()
      : "";
  return RLS_PHRASES.some((phrase) => message.includes(phrase));
}

/** True specifically for an expired/invalid auth token. UI should prompt re-login. */
export function isAuthExpiredError(err: SupabaseLikeError): boolean {
  if (!err) return false;
  const code = (err as { code?: string | null }).code ?? "";
  if (code === "PGRST301") return true;

  const message =
    typeof (err as Error).message === "string"
      ? (err as Error).message.toLowerCase()
      : "";
  return (
    message.includes("jwt expired") ||
    message.includes("invalid jwt") ||
    message.includes("invalid refresh token")
  );
}

/**
 * Human-readable message for a permission error. Pass the module/area name
 * so the message tells the user *what* they don't have access to.
 *
 * Example: formatPermissionMessage("Material Requests")
 *   → "You don't have permission to view Material Requests. Ask your administrator to grant your department access."
 */
export function formatPermissionMessage(
  area: string,
  action: "view" | "modify" = "view",
): string {
  const verb = action === "modify" ? "modify" : "view";
  return `You don't have permission to ${verb} ${area}. Ask your administrator to grant your department access.`;
}

/** Best-effort generic message extractor — falls back to "Unknown error". */
export function describeError(err: SupabaseLikeError): string {
  if (!err) return "Unknown error";
  const message = (err as Error).message;
  if (typeof message === "string" && message.length > 0) return message;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}
