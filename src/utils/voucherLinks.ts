import { supabase } from "@/integrations/supabase/client";

/**
 * A sub-assembly voucher can be issued for a finished-good voucher
 * (production_orders.parent_order_id). PostgREST reads that self-reference as
 * the one-to-many side, so the parent is looked up here instead of embedded.
 * Sets row.parent = { id, voucher_number, part_code } on every row that has one.
 */
export async function attachParentVouchers<T>(rows: T[]): Promise<(T & { parent?: ParentVoucher })[]> {
  const parentOf = (r: T) => (r as any).parent_order_id as string | null | undefined;
  const ids = [...new Set(rows.map(parentOf).filter(Boolean))] as string[];
  if (ids.length === 0) return rows as (T & { parent?: ParentVoucher })[];
  const { data, error } = await (supabase as any)
    .from("production_orders")
    .select("id, voucher_number, parts!part_id ( part_code )")
    .in("id", ids);
  if (error) throw error;
  const byId = new Map<string, ParentVoucher>(
    (data ?? []).map((o: any) => [o.id, { id: o.id, voucher_number: o.voucher_number, part_code: o.parts?.part_code ?? null }]),
  );
  return rows.map((r) => ({ ...r, parent: parentOf(r) ? byId.get(parentOf(r) as string) : undefined }));
}

export interface ParentVoucher {
  id: string;
  voucher_number: string;
  part_code: string | null;
}
