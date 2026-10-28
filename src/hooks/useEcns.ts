import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Engineering change notes.
 *   BOM_CHANGE   one product's BOM, edited on its R&D BOM tab
 *   REPLACEMENT  part changed: a new code replaces the old one wherever it is used
 *   CORRECTION   a wrong code was entered: swapped everywhere, nothing physical changed
 * R&D prepares and sends; Management approves, which releases it. From release all
 * production uses the new part, unless using up the old stock was confirmed (then it
 * goes live on the date given).
 */
const db = supabase as any;

export type EcnType = "BOM_CHANGE" | "REPLACEMENT" | "CORRECTION";
export type EcnStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "RELEASED" | "CANCELLED";
export interface PartRef { id: string; part_code: string; name: string; uom: string | null; lifecycle?: string }
export interface Ecn {
  id: string; ecn_no: string; title: string; reason: string | null; status: EcnStatus; change_type: EcnType;
  old_part: PartRef | null; new_part: PartRef | null; new_quantity: number | null; new_part_created: boolean;
  use_old_stock: boolean; effective_from: string | null; old_stock_action: string | null; old_stock_note: string | null;
  returned_note: string | null; returned_at: string | null;
  created_at: string; submitted_at: string | null; approved_at: string | null; released_at: string | null;
  versions: { id: string; version: string; status: string; item: { id: string; part_code: string; name: string; source_type: string; plm_product_id: string | null } }[];
  swaps: { parent: { part_code: string; name: string } }[];
}
export interface WhereUsed {
  kind: "VERSION" | "PRODUCTION"; item_id: string; part_code: string; name: string; source_type: string;
  version: string | null; usage: string; busy_in: string | null; brand_codes: string | null;
}

export const ECN_TYPE: Record<EcnType, string> = {
  BOM_CHANGE: "BOM change", REPLACEMENT: "Part replacement", CORRECTION: "Code correction",
};
export const ECN_STATUS: Record<EcnStatus, { label: string; tone: "default" | "secondary" | "outline" | "destructive" | "warning" }> = {
  DRAFT: { label: "Being prepared", tone: "outline" },
  SUBMITTED: { label: "Waiting for Management", tone: "warning" },
  APPROVED: { label: "Approved · goes live on date", tone: "secondary" },
  RELEASED: { label: "Released", tone: "default" },
  CANCELLED: { label: "Cancelled", tone: "secondary" },
};
export const OLD_STOCK_ACTIONS: [string, string][] = [
  ["NONE", "Nothing in stock / nothing to do"], ["REWORK", "Rework to the new part"], ["RETURN", "Return to the vendor"],
  ["SPARES", "Keep for service spares"], ["USE_ELSEWHERE", "Use in products not changed by this ECN"], ["SCRAP", "Scrap"],
];

const SELECT = `id, ecn_no, title, reason, status, change_type, new_quantity, new_part_created, use_old_stock, effective_from,
  old_stock_action, old_stock_note, returned_note, returned_at, created_at, submitted_at, approved_at, released_at,
  old_part:parts!ecns_old_part_id_fkey ( id, part_code, name, uom, lifecycle ),
  new_part:parts!ecns_new_part_id_fkey ( id, part_code, name, uom, lifecycle ),
  versions:item_versions ( id, version, status, item:parts!item_versions_item_id_fkey ( id, part_code, name, source_type, plm_product_id ) ),
  swaps:ecn_bom_swaps ( parent:parts ( part_code, name ) )`;

export function useEcns() {
  return useQuery({
    queryKey: ["ecns"],
    queryFn: async () => {
      const { data, error } = await db.from("ecns").select(SELECT).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ecn[];
    },
  });
}

export function useWhereUsed(partId?: string | null) {
  return useQuery({
    queryKey: ["ecn-where-used", partId], enabled: !!partId,
    queryFn: async () => {
      const { data, error } = await db.rpc("ecn_part_where_used", { p_part: partId });
      if (error) throw error;
      return (data ?? []) as WhereUsed[];
    },
  });
}

export function usePartImpact(partId?: string | null) {
  return useQuery({
    queryKey: ["ecn-impact", partId], enabled: !!partId,
    queryFn: async () => {
      const { data, error } = await db.rpc("ecn_part_impact", { p_part: partId });
      if (error) throw error;
      return data as { uom: string; stock: { location: string; code: string; quantity: number }[];
                       open_pos: { po_number: string; status: string; ordered: number; received: number }[] };
    },
  });
}

export function useEcnMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({
    predicate: (q) => /^(ecns|ecn-|plm|engineering|model|parts|bom|item)/.test(String(q.queryKey[0] ?? "")),
  });
  const fail = (e: any) => toast.error(e?.message ?? "Could not save");
  const call = (fn: string) => async (args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw error;
    return data;
  };
  const m = <A,>(fn: (a: A) => Promise<any>, ok?: string | ((d: any) => string)) =>
    useMutation({ mutationFn: fn, onSuccess: (d: any) => { refresh(); if (ok) toast.success(typeof ok === "function" ? ok(d) : ok); }, onError: fail });

  return {
    raise: m(async (a: { type: EcnType; title: string; reason: string; old: string; newPart: string | null; newName: string | null;
                          items: string[]; production: string[]; qty: number | null }) => {
      let newId = a.newPart, created = false;
      if (!newId) {
        const made = await call("ecn_part_copy")({ p_old: a.old, p_name: a.newName });
        newId = made.id; created = true;
        a = { ...a, title: a.title.replace("a new code", made.part_code) };
      }
      return call("ecn_raise_part_change")({
        p_type: a.type, p_title: a.title, p_reason: a.reason, p_old: a.old, p_new: newId,
        p_items: a.items, p_production: a.production, p_qty: a.qty, p_new_created: created,
      });
    }, "ECN raised. Check it, then send it to Management."),
    submit: m((id: string) => call("ecn_submit")({ p_ecn: id }), "Sent to Management for approval"),
    sendBack: m((a: { id: string; note: string }) => call("ecn_send_back")({ p_ecn: a.id, p_note: a.note }), "Sent back to R&D"),
    setOldStock: m((a: { id: string; useOld: boolean; from: string | null; action: string | null; note: string }) =>
      call("ecn_set_old_stock")({ p_ecn: a.id, p_use_old: a.useOld, p_from: a.from, p_action: a.action, p_note: a.note }), "Saved"),
    approve: m((id: string) => call("ecn_approve")({ p_ecn: id, p_brands: null }),
      (d) => d?.scheduled ? `Approved. Goes live on ${String(d.scheduled).split("-").reverse().join("-")}.`
        : `Approved and released. ${d?.released ?? 0} version(s), ${d?.brands_moved ?? 0} brand code(s)${d?.production_swapped ? `, ${d.production_swapped} production BOM(s)` : ""} updated.`),
    cancel: m((id: string) => call("ecn_cancel")({ p_ecn: id }), "ECN cancelled"),
  };
}
