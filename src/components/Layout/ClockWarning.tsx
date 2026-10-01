import { AlertTriangle } from "lucide-react";
import { clockSkewSeconds } from "@/integrations/supabase/clockSafeStorage";

/** More than this and dates the app takes from this computer ("today") can be wrong. */
const WARN_SECONDS = 5 * 60;

const describe = (s: number) => {
  const a = Math.abs(s);
  const d = Math.floor(a / 86400), h = Math.floor((a % 86400) / 3600), m = Math.round((a % 3600) / 60);
  return [d && `${d} day${d > 1 ? "s" : ""}`, h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ");
};

/**
 * Shown when this computer's clock is clearly wrong. Login keeps working
 * (clockSafeStorage), but anything that uses this computer's date would not.
 */
export function ClockWarning() {
  const skew = clockSkewSeconds();
  if (Math.abs(skew) < WARN_SECONDS) return null;
  return (
    <div role="alert" className="flex items-start gap-2 border-b border-warning/40 bg-warning/10 px-6 py-2 text-sm">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
      <span>
        This computer's clock is <b>{describe(skew)} {skew > 0 ? "ahead" : "behind"}</b>. Dates entered on it may be wrong.
        Fix it in Windows: Settings → Time &amp; language → Date &amp; time → turn on <b>Set time automatically</b> and
        <b> Set time zone automatically</b> (or pick UTC+05:30 Chennai, Kolkata, Mumbai, New Delhi), then <b>Sync now</b>.
        Sign out and in again after fixing it.
      </span>
    </div>
  );
}
