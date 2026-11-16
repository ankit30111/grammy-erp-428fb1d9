import { supabase } from "@/integrations/supabase/client";

/**
 * Shortage list.
 *
 * The sum is done in the database (shortage_lines), so every user at every
 * location reads the same figures:
 *
 *   still to issue = what open vouchers still need from the store
 *                    (required - issued + returned, never below zero)
 *   shortage       = still to issue + demand not yet on a voucher
 *                    - in store - waiting for IQC
 *   to order       = shortage - purchase orders already placed
 */

export interface DemandSource {
  label: string;
  customer?: string | null;
  quantity: number;
  needed_on: string | null;
}

export interface PendingPo {
  po_number: string;
  status: string;
  vendor: string | null;
  is_import: boolean;
  pending: number;
  expected: string | null;
  on_the_way: number;
}

export interface ShortageLine {
  part_id: string;
  part_code: string;
  name: string;
  category: string | null;
  uom: string;
  /** Demand of projections that are not on a voucher yet. */
  required: number;
  /** In the main store, usable. */
  available: number;
  /** Still to issue to open vouchers. */
  hold: number;
  /** Received and waiting for IQC. */
  at_iqc: number;
  /** On purchase orders already approved, not yet received. */
  on_order: number;
  /** in store + waiting for IQC - still to issue - projections. */
  balance: number;
  /** What is missing before counting purchase orders. */
  shortage: number;
  /** What still has to be ordered. */
  to_order: number;
  needed_on: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  unit_price: number | null;
  currency: string | null;
  sources: DemandSource[];
  pending_pos: PendingPo[];
  /* names still read by the PPC dashboard */
  material_name: string;
  total_required: number;
  available_quantity: number;
  shortage_quantity: number;
  vendor_info: { vendor_name: string; vendor_code?: string } | null;
}

export const calculateShortages = async (plantId?: string | null): Promise<ShortageLine[]> => {
  const { data, error } = await (supabase as any).rpc("shortage_lines", { p_plant: plantId ?? null });
  if (error) throw error;

  return ((data ?? []) as any[]).map((r) => {
    const hold = Number(r.for_vouchers || 0);
    const required = Number(r.for_projections || 0);
    const available = Number(r.in_store || 0);
    const atIqc = Number(r.at_iqc || 0);
    const shortage = Number(r.shortage || 0);
    return {
      part_id: r.part_id,
      part_code: r.part_code,
      name: r.name,
      category: r.category,
      uom: r.uom || "PCS",
      required,
      available,
      hold,
      at_iqc: atIqc,
      on_order: Number(r.on_order || 0),
      balance: available + atIqc - hold - required,
      shortage,
      to_order: Number(r.to_order || 0),
      needed_on: r.needed_on,
      vendor_id: r.vendor_id,
      vendor_name: r.vendor_name,
      unit_price: r.unit_price,
      currency: r.currency,
      sources: ((r.sources ?? []) as any[]).map((s) => ({ ...s, quantity: Number(s.quantity || 0) })),
      pending_pos: ((r.pending_pos ?? []) as any[]).map((p) => ({ ...p, pending: Number(p.pending || 0), on_the_way: Number(p.on_the_way || 0) })),
      material_name: r.name,
      total_required: required + hold,
      available_quantity: available,
      shortage_quantity: shortage,
      vendor_info: r.vendor_name ? { vendor_name: r.vendor_name } : null,
    };
  });
};

/* ---- names kept for screens that already import them ---- */
export type MaterialShortage = ShortageLine;
export const calculateMaterialShortages = async (
  _projectionIds?: string[],
  plantId?: string | null,
) => calculateShortages(plantId ?? null);
