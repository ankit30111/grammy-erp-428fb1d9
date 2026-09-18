import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * `production_order_lines` is the only owner of which line(s) a production voucher runs on.
 * A voucher may have one row (it runs entirely on one line) or several
 * (e.g. a sub-assembly on Line 1 and the main assembly on Line 2).
 *
 * `part_id IS NULL` means the finished good itself; a set `part_id` means that
 * specific sub-assembly from the BOM.
 */
export interface ProductionOrderLineRow {
  id: string;
  production_order_id: string;
  production_line_id: string;
  part_id: string | null;
  quantity: number | null;
  production_lines: { name: string } | null;
  parts: { id: string; name: string; part_code: string } | null;
}

const PRODUCTION_ORDER_LINE_SELECT = `
  id,
  production_order_id,
  production_line_id,
  part_id,
  quantity,
  production_lines ( name ),
  parts ( id, name, part_code )
`;

export async function fetchProductionOrderLines(
  orderIds: string[]
): Promise<ProductionOrderLineRow[]> {
  if (orderIds.length === 0) return [];

  const { data, error } = await supabase
    .from("production_order_lines")
    .select(PRODUCTION_ORDER_LINE_SELECT)
    .in("production_order_id", orderIds);

  if (error) throw error;
  return (data ?? []) as unknown as ProductionOrderLineRow[];
}

/** Line assignments for a set of vouchers, keyed by production_order_id. */
export function groupLinesByOrder(
  rows: ProductionOrderLineRow[] | undefined
): Record<string, ProductionOrderLineRow[]> {
  const grouped: Record<string, ProductionOrderLineRow[]> = {};
  (rows ?? []).forEach((row) => {
    if (!grouped[row.production_order_id]) grouped[row.production_order_id] = [];
    grouped[row.production_order_id].push(row);
  });
  return grouped;
}

/** Line assignments for the given vouchers. */
export function useProductionOrderLines(orderIds: string[]) {
  const key = [...orderIds].sort().join(",");
  return useQuery({
    queryKey: ["production-order-lines", key],
    enabled: orderIds.length > 0,
    queryFn: () => fetchProductionOrderLines(orderIds),
  });
}

/** Line assignments for a single voucher. */
export function useProductionOrderLinesForOrder(orderId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["production-order-lines", "order", orderId],
    enabled: !!orderId && enabled,
    queryFn: () => fetchProductionOrderLines([orderId!]),
  });
}

/** Distinct line ids a voucher runs on. */
export function assignedLineIds(rows: ProductionOrderLineRow[] | undefined): string[] {
  return Array.from(new Set((rows ?? []).map((r) => r.production_line_id)));
}

/** All line names a voucher runs on, de-duplicated. */
export function assignedLineNames(rows: ProductionOrderLineRow[] | undefined): string[] {
  return Array.from(
    new Set((rows ?? []).map((r) => r.production_lines?.name).filter((n): n is string => !!n))
  );
}

/** Every line a voucher runs on, as a single label. */
export function formatAssignedLines(rows: ProductionOrderLineRow[] | undefined): string {
  const names = assignedLineNames(rows);
  return names.length > 0 ? names.join(", ") : "Not Assigned";
}

/** The assignment for the finished good itself (the row where part_id IS NULL). */
export function finishedGoodLine(
  rows: ProductionOrderLineRow[] | undefined
): ProductionOrderLineRow | undefined {
  return (rows ?? []).find((r) => r.part_id === null);
}

/** Ids of the vouchers that have at least one assignment on the given line. */
export async function fetchOrderIdsOnLine(lineId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("production_order_lines")
    .select("production_order_id")
    .eq("production_line_id", lineId);

  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.production_order_id)));
}

export interface LineAssignmentInput {
  production_line_id: string;
  /** null = the finished good itself */
  part_id: string | null;
  quantity?: number | null;
}

/** Replace a voucher's line assignments with exactly the ones given. */
export async function replaceProductionOrderLines(
  productionOrderId: string,
  assignments: LineAssignmentInput[]
): Promise<void> {
  const seen = new Set<string>();
  const rows = assignments
    .filter((a) => {
      if (!a.production_line_id) return false;
      const key = `${a.production_line_id}::${a.part_id ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((a) => ({
      production_order_id: productionOrderId,
      production_line_id: a.production_line_id,
      part_id: a.part_id ?? null,
      quantity: a.quantity ?? null,
    }));

  const { error: deleteError } = await supabase
    .from("production_order_lines")
    .delete()
    .eq("production_order_id", productionOrderId);
  if (deleteError) throw deleteError;

  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from("production_order_lines").insert(rows);
  if (insertError) throw insertError;
}
