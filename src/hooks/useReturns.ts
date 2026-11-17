import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Material coming back from the line.
 * Production says what it sends back and in what condition; the store in-charge
 * counts it, and that count is final. Only the counted quantity returns to stock.
 */
const db = supabase as any;

export type Verdict = "USABLE" | "FAULTY" | "DAMAGED";
export const VERDICT: Record<Verdict, string> = { USABLE: "Usable", FAULTY: "Faulty", DAMAGED: "Damaged" };

export interface ReturnLine {
  kit_item_id: string; part_id: string; part_code: string; part_name: string; uom: string | null;
  issued: number; returned: number; waiting: number; per_set: number | null; produced: number;
  rejected: number; expected_back: number | null;
}

export interface PendingReturn {
  id: string; quantity: number; counted_quantity: number | null; verdict: Verdict; notes: string | null;
  created_at: string; verified_at: string | null;
  kit_item: {
    issued_quantity: number; returned_quantity: number;
    part: { part_code: string; name: string; uom: string | null } | null;
    kit: { kit_number: string; order: { voucher_number: string; part: { part_code: string } | null } | null } | null;
  } | null;
}

const RETURN_SELECT = `id, quantity, counted_quantity, verdict, notes, created_at, verified_at,
  kit_item:kit_items ( issued_quantity, returned_quantity, part:parts ( part_code, name, uom ),
    kit:kit_preparation ( kit_number, order:production_orders ( voucher_number, part:parts ( part_code ) ) ) )`;

/** What should come back for a voucher: issued - returned - (BOM x sets made). */
export function useReturnLines(orderId?: string | null) {
  return useQuery({
    queryKey: ["returns-lines", orderId], enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await db.rpc("kit_return_lines", { p_order: orderId });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r, issued: Number(r.issued), returned: Number(r.returned), waiting: Number(r.waiting), produced: Number(r.produced),
        rejected: Number(r.rejected), per_set: r.per_set == null ? null : Number(r.per_set),
        expected_back: r.expected_back == null ? null : Number(r.expected_back),
      })) as ReturnLine[];
    },
  });
}

/** Returns the store still has to count, and the last ones it counted. */
export function useReturns() {
  return useQuery({
    queryKey: ["returns"], refetchInterval: 30_000,
    queryFn: async () => {
      const [waiting, done] = await Promise.all([
        db.from("kit_returns").select(RETURN_SELECT).is("verified_at", null).order("created_at"),
        db.from("kit_returns").select(RETURN_SELECT).not("verified_at", "is", null).order("verified_at", { ascending: false }).limit(30),
      ]);
      if (waiting.error) throw waiting.error;
      if (done.error) throw done.error;
      return { waiting: (waiting.data ?? []) as PendingReturn[], done: (done.data ?? []) as PendingReturn[] };
    },
  });
}

export function useReturnMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ predicate: (q) => /^(returns|my-tasks|shortages|stock|kit|inventory)/.test(String(q.queryKey[0] ?? "")) });
  const fail = (e: any) => toast.error(e?.message ?? "Could not save");
  return {
    raise: useMutation({
      mutationFn: async (a: { orderId: string; lines: { kit_item_id: string; quantity: number; verdict: Verdict; notes: string }[] }) => {
        const { data, error } = await db.rpc("kit_return_raise", { p_order: a.orderId, p_lines: a.lines });
        if (error) throw error;
        return data as number;
      },
      onSuccess: (n) => { refresh(); toast.success(`${n} line(s) sent back. The store will count them.`); },
      onError: fail,
    }),
    confirm: useMutation({
      mutationFn: async (a: { id: string; counted: number }) => {
        const { error } = await db.rpc("kit_return_confirm", { p_return: a.id, p_counted: a.counted });
        if (error) throw error;
      },
      onSuccess: () => { refresh(); toast.success("Counted and returned to stock"); },
      onError: fail,
    }),
  };
}
