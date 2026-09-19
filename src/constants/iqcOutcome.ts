import type { Database } from "@/integrations/supabase/types";

/**
 * The IQC verdict, taken from the generated database types rather than retyped.
 *
 * The Pass radio on IQCInspectionDialog carried value="APPROVED" while the hook
 * that writes the row declared 'ACCEPTED' | 'REJECTED' | 'PARTIAL'. Nothing
 * complained, because the handler cast the radio's string:
 *
 *     onValueChange={(value) => handleStatusChange(id, value as 'ACCEPTED' | ...)}
 *
 * and `as` is an instruction to stop checking. So clicking Pass put "APPROVED"
 * into the row and Postgres refused it - `invalid input value for enum
 * iqc_outcome: "APPROVED"` - which the screen reported as "Database update
 * failed. Please try again."
 *
 * It looked like a multi-item bug because a single line is usually submitted on
 * the default verdict, which the dialog seeds as 'ACCEPTED' and which is correct.
 * With several lines you click Pass on at least one of them, and clicking Pass
 * was the bug.
 *
 * Deriving the type from Database["public"]["Enums"] means the compiler compares
 * these strings against the live enum. `satisfies` makes a value that is not a
 * member fail the build rather than the shop floor.
 */
export type IqcOutcome = Database["public"]["Enums"]["iqc_outcome"];

export const IQC_OUTCOME = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  PARTIAL: "PARTIAL",
} as const satisfies Record<string, IqcOutcome>;

/** The three verdicts an inspector can record. PENDING is the absence of one. */
export type IqcVerdict = Exclude<IqcOutcome, "PENDING">;
