import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Raised inspection. A part (and vendor) found faulty is flagged: IQC keeps receiving it but
 * inspects it at a higher level, chosen by Quality, until the QA head releases the flag —
 * normally once the vendor's CAPA is accepted. Sampling is ISO 2859-1 (IS 2500), worked out
 * in the database (iqc_sample_plan): AQL 1.0 major, 2.5 minor, normal level G1.
 */
const db = supabase as any;

export const LEVELS: { value: string; label: string; hint: string }[] = [
  { value: "G1", label: "G1 · General I", hint: "Normal" },
  { value: "G2", label: "G2 · General II", hint: "Larger sample" },
  { value: "G3", label: "G3 · General III", hint: "Largest general sample" },
  { value: "S1", label: "S1 · Special", hint: "Small sample, for long or costly tests" },
  { value: "S2", label: "S2 · Special", hint: "Small sample" },
  { value: "S3", label: "S3 · Special", hint: "Small sample" },
  { value: "S4", label: "S4 · Special", hint: "Small sample" },
  { value: "FULL", label: "100% · every piece", hint: "Check each piece" },
];
export const levelLabel = (v?: string | null) => (v === "FULL" ? "100%" : v ?? "—");

export const CAPA_STATUS: Record<string, { label: string; tone: "destructive" | "default" | "secondary" | "outline" }> = {
  AWAITED: { label: "CAPA awaited", tone: "destructive" },
  RECEIVED: { label: "CAPA received", tone: "default" },
  ACCEPTED: { label: "CAPA accepted", tone: "secondary" },
  REJECTED: { label: "CAPA rejected", tone: "destructive" },
};

export interface SidePlan { aql: number; letter: string; n: number; ac: number; re: number }
export interface SamplePlan { level: string; lot: number; letter: string | null; sample: number; every_piece: boolean; major: SidePlan; minor: SidePlan }
export interface ItemPlan {
  flag: null | { id: string; level: string | null; capa_status: string; since: string; reason: string | null; vendor_specific: boolean };
  plan: SamplePlan;
}

/** Per GRN line: the flag that applies to it, if any, and the sample to take. */
export function useGrnPlans(grnId?: string | null) {
  return useQuery({
    queryKey: ["grn-plans", grnId], enabled: !!grnId,
    queryFn: async () => {
      const { data, error } = await db.rpc("grn_inspection_plans", { p_grn: grnId });
      if (error) throw error;
      return (data ?? {}) as Record<string, ItemPlan>;
    },
  });
}

/** GRNs waiting for IQC that hold a flagged part. */
export function usePendingFlags() {
  return useQuery({
    queryKey: ["pending-iqc-flags"], refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("pending_iqc_flags");
      if (error) throw error;
      return (data ?? []) as { grn_id: string; part_code: string; level: string; capa_status: string }[];
    },
  });
}

export function useInspectionFlags() {
  return useQuery({
    queryKey: ["iqc-flags"],
    queryFn: async () => {
      const { data, error } = await db.from("iqc_flags")
        .select("*, part:parts ( id, part_code, name ), vendor:vendors ( id, name, vendor_code ), events:iqc_flag_events ( id, kind, source, detail, at )")
        .order("status", { ascending: true }).order("raised_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((f: any) => ({ ...f, events: [...(f.events ?? [])].sort((a: any, b: any) => b.at.localeCompare(a.at)) }));
    },
  });
}

export function useCanRelease() {
  return useQuery({
    queryKey: ["is-qa-head"],
    queryFn: async () => {
      const { data, error } = await db.rpc("is_qa_head");
      if (error) return false;
      return !!data;
    },
  });
}

export function useFlagMutations() {
  const qc = useQueryClient();
  const refresh = () => ["iqc-flags", "pending-iqc-flags", "grn-plans", "my-tasks"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const fail = (e: any) => toast.error(e?.message ?? "Could not save");
  const call = (fn: string, done: string) => useMutation({
    mutationFn: async (args: Record<string, unknown>) => { const { error } = await db.rpc(fn, args); if (error) throw error; },
    onSuccess: () => { refresh(); toast.success(done); },
    onError: fail,
  });
  return {
    setLevel: call("iqc_flag_set_level", "Inspection level set"),
    capa: call("iqc_flag_capa", "CAPA updated"),
    release: call("iqc_flag_release", "Back to normal inspection"),
    manual: call("iqc_flag_manual", "Part flagged"),
  };
}
