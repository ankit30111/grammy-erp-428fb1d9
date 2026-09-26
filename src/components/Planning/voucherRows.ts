/** One row per production voucher, whatever it builds. */
export type VoucherRow = {
  schedule: any;
  order: any;
  kind: "FG" | "SA";
  product: { id?: string; part_code?: string; name?: string } | undefined;
  forLabel: string;
  status: string;
};

export const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Planned",
  KIT_PREPARED: "Kit prepared",
  KIT_SENT: "Kit issued",
  IN_PRODUCTION: "In production · PQC",
  COMPLETED: "Awaiting OQC",
  OQC_PASSED: "OQC passed",
  OQC_FAILED: "OQC failed",
  CANCELLED: "Cancelled",
};

export const toVoucherRow = (s: any): VoucherRow => {
  const order = s.production_orders?.[0];
  const isFg = !!s.projection_id;
  return {
    schedule: s,
    order,
    kind: isFg ? "FG" : "SA",
    product: s.projections?.parts ?? s.parts,
    forLabel: isFg
      ? s.projections?.customers?.name ?? "—"
      : order?.parent?.voucher_number
        ? `For ${order.parent.voucher_number} · ${order.parent.part_code ?? ""}`
        : "Stock build",
    status: order?.status ?? s.status,
  };
};

/** Colour per kind, used by the calendar and its legend. */
export const KIND_STYLE = {
  FG: { dot: "bg-primary", chip: "bg-primary text-primary-foreground", label: "Finished good" },
  SA: { dot: "bg-warning", chip: "bg-warning text-white", label: "Sub-assembly" },
} as const;
