/**
 * The kit lifecycle, in one place.
 *
 * kit_preparation.status was free text and the app had grown fifteen spellings for
 * five states. The store wrote "SENT"; Production > Kit Verification looked for
 * "COMPLETE KIT SENT" and four assembly variants, so that screen was permanently
 * empty and looked like "no kits" rather than a broken filter.
 *
 * The database now has a CHECK constraint with exactly these five values
 * (20260918180000_kit_status_lifecycle.sql). Anything not in this file will be
 * rejected by Postgres rather than stored and silently never matched again.
 */

export const KIT_STATUS = {
  /** Kit lines exist, nothing issued yet. */
  PREPARED: "PREPARED",
  /** The store cannot issue in full. */
  SHORTAGE: "SHORTAGE",
  /** Issued to production; stock has left the main store. */
  SENT: "SENT",
  /** Production counted it and agrees with what was issued. */
  RECEIVED: "RECEIVED",
  /** Production counted it and raised kit feedback the store has not ruled on. */
  DISPUTED: "DISPUTED",
} as const;

export type KitStatus = (typeof KIT_STATUS)[keyof typeof KIT_STATUS];

export const KIT_STATUS_LABELS: Record<KitStatus, string> = {
  PREPARED: "Prepared",
  SHORTAGE: "Short",
  SENT: "Sent to production",
  RECEIVED: "Received",
  DISPUTED: "In dispute",
};

export const kitStatusVariant = (
  status: string
): "default" | "secondary" | "destructive" | "warning" | "outline" => {
  switch (status) {
    case KIT_STATUS.RECEIVED:
      return "default";
    case KIT_STATUS.SENT:
      return "warning";
    case KIT_STATUS.DISPUTED:
    case KIT_STATUS.SHORTAGE:
      return "destructive";
    default:
      return "secondary";
  }
};
