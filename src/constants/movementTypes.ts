/**
 * Single source of truth for stock ledger movement types.
 *
 * Every posting site and every filter must import from here. Free-typed string
 * literals are how we ended up with `ISSUE_TO_PRODUCTION` and
 * `ISSUED_TO_PRODUCTION` both in use, and a "Stock Adjustments" filter that
 * searched for `STOCK_ADJUSTMENT` while the code posted `ADJUSTMENT` — so that
 * filter returned nothing, always, and no error was ever raised.
 */
export const MOVEMENT_TYPES = {
  GRN_RECEIPT: "GRN_RECEIPT",
  IQC_ACCEPT_IN: "IQC_ACCEPT_IN",
  IQC_ACCEPT_OUT: "IQC_ACCEPT_OUT",
  IQC_REJECT_IN: "IQC_REJECT_IN",
  IQC_REJECT_OUT: "IQC_REJECT_OUT",
  ISSUED_TO_PRODUCTION: "ISSUED_TO_PRODUCTION",
  PRODUCTION_RETURN: "PRODUCTION_RETURN",
  PRODUCTION_FEEDBACK_RETURN: "PRODUCTION_FEEDBACK_RETURN",
  PRODUCTION_DISCREPANCY_REJECTED: "PRODUCTION_DISCREPANCY_REJECTED",
  MATERIAL_REQUEST_CREATED: "MATERIAL_REQUEST_CREATED",
  ADJUSTMENT: "ADJUSTMENT",
  STOCK_RECONCILIATION: "STOCK_RECONCILIATION",
  KIT_RETURN: "KIT_RETURN",
  SUBASSEMBLY_RECEIPT: "SUBASSEMBLY_RECEIPT",
} as const;

export type MovementType = (typeof MOVEMENT_TYPES)[keyof typeof MOVEMENT_TYPES];

/** Labels shown in the LogBook filter and badges. Keys must exist above. */
export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  GRN_RECEIPT: "GRN Receipt",
  IQC_ACCEPT_IN: "IQC Accepted (in)",
  IQC_ACCEPT_OUT: "IQC Accepted (out of quarantine)",
  IQC_REJECT_IN: "IQC Rejected (in)",
  IQC_REJECT_OUT: "IQC Rejected (out of quarantine)",
  ISSUED_TO_PRODUCTION: "Issued to Production",
  PRODUCTION_RETURN: "Production Return",
  PRODUCTION_FEEDBACK_RETURN: "Feedback Return",
  PRODUCTION_DISCREPANCY_REJECTED: "Discrepancy Rejected",
  MATERIAL_REQUEST_CREATED: "Material Request",
  ADJUSTMENT: "Stock Adjustment",
  STOCK_RECONCILIATION: "Stock Reconciliation",
  KIT_RETURN: "Kit Return",
  SUBASSEMBLY_RECEIPT: "Sub-assembly received (after OQC)",
};

/** The subset offered in the LogBook filter dropdown, in display order. */
export const LOGBOOK_FILTER_TYPES: MovementType[] = [
  MOVEMENT_TYPES.GRN_RECEIPT,
  MOVEMENT_TYPES.ISSUED_TO_PRODUCTION,
  MOVEMENT_TYPES.PRODUCTION_RETURN,
  MOVEMENT_TYPES.PRODUCTION_FEEDBACK_RETURN,
  MOVEMENT_TYPES.KIT_RETURN,
  MOVEMENT_TYPES.SUBASSEMBLY_RECEIPT,
  MOVEMENT_TYPES.MATERIAL_REQUEST_CREATED,
  MOVEMENT_TYPES.ADJUSTMENT,
  MOVEMENT_TYPES.STOCK_RECONCILIATION,
];
