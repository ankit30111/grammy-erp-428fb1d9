import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

/**
 * The engineering BOM: R&D's, versioned, as a tree.
 *
 *   item          a model (JA-006) or a sub-assembly (SA-012)
 *   version       1.0, 1.1 ... of an item, DRAFT until Management releases it
 *   line          one part of a version; a sub-assembly line points at the
 *                 version of that sub-assembly it uses (child_version_id)
 *   brands        null = every brand, else only these (a Philips box)
 *   ECN           one change: its drafts are released together
 */
export type StepStatus = "OPEN" | "WIP" | "CLOSED";
export const BOM_STEPS = [
  ["design_status", "Design"], ["sample_status", "Sample"], ["approval_status", "Approval"], ["release_status", "Release"],
] as const;

export interface LinePart {
  id: string; part_code: string; name: string; uom: string | null; unit_price: number | null; currency: string | null;
  category: string; approval_status: string; source_type: string;
}
export interface VLine {
  id: string; version_id: string; sort: number; part_id: string | null; description: string | null;
  quantity: number | null; bulk: boolean; is_critical: boolean; brands: string[] | null; child_version_id: string | null;
  change_type: "NEW" | "CARRY_OVER" | "CHANGED"; replaces_part_id: string | null;
  design_status: StepStatus; sample_status: StepStatus; approval_status: StepStatus; release_status: StepStatus;
  design_done: boolean; sample_done: boolean; approval_done: boolean; release_done: boolean;
  vendor_note: string | null; quoted_price: number | null; remarks: string | null;
  part: LinePart | null; replaces: { part_code: string; name: string } | null;
}
export interface IVersion {
  id: string; item_id: string; version: string; major: number; minor: number; kind: "INITIAL" | "ECN" | "MAJOR";
  status: "DRAFT" | "RELEASED"; ecn_id: string | null; note: string | null; based_on: string | null;
  created_at: string; released_at: string | null;
  item: { id: string; part_code: string; name: string; source_type: string } | null;
  ecn: { id: string; ecn_no: string; title: string; reason: string | null; status: string } | null;
}

export const linePct = (l: Pick<VLine, "design_done" | "sample_done" | "approval_done" | "release_done">) =>
  (Number(l.design_done) + Number(l.sample_done) + Number(l.approval_done) + Number(l.release_done)) * 25;

const LINE_SELECT = "*, part:parts!version_lines_part_id_fkey ( id, part_code, name, uom, unit_price, currency, category, approval_status, source_type ), replaces:parts!version_lines_replaces_part_id_fkey ( part_code, name )";
const VERSION_SELECT = "id, item_id, version, major, minor, kind, status, ecn_id, note, based_on, created_at, released_at, item:parts!item_versions_item_id_fkey ( id, part_code, name, source_type ), ecn:ecns ( id, ecn_no, title, reason, status )";

/** A version and everything under it: versions by id, lines by version. */
export const useVersionTree = (rootId?: string | null) =>
  useQuery({
    queryKey: ["eng-tree", rootId],
    enabled: !!rootId,
    queryFn: async () => {
      const versions = new Map<string, IVersion>();
      const lines = new Map<string, VLine[]>();
      let todo = [rootId as string];
      for (let depth = 0; todo.length && depth < 8; depth++) {
        const [v, l] = await Promise.all([
          db.from("item_versions").select(VERSION_SELECT).in("id", todo),
          db.from("version_lines").select(LINE_SELECT).in("version_id", todo).order("sort").order("created_at"),
        ]);
        if (v.error) throw v.error;
        if (l.error) throw l.error;
        for (const x of v.data ?? []) versions.set(x.id, x);
        for (const id of todo) lines.set(id, []);
        for (const x of (l.data ?? []) as VLine[]) lines.get(x.version_id)!.push(x);
        todo = [...new Set((l.data ?? []).map((x: VLine) => x.child_version_id).filter((id: string | null) => id && !versions.has(id)))] as string[];
      }
      return { root: versions.get(rootId as string)!, versions, lines };
    },
  });

/** Every version of an item, newest first, with its ECN. */
export const useItemVersions = (itemId?: string | null) =>
  useQuery({
    queryKey: ["eng-versions", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await db.from("item_versions").select(VERSION_SELECT).eq("item_id", itemId)
        .order("major", { ascending: false }).order("minor", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IVersion[];
    },
  });

/** The drafts an ECN holds (the product and the sub-assemblies changed with it). */
export const useEcnVersions = (ecnId?: string | null) =>
  useQuery({
    queryKey: ["eng-ecn", ecnId],
    enabled: !!ecnId,
    queryFn: async () => {
      const { data, error } = await db.from("item_versions").select(VERSION_SELECT).eq("ecn_id", ecnId);
      if (error) throw error;
      return (data ?? []) as IVersion[];
    },
  });

export const useWhereUsed = (itemId?: string | null) =>
  useQuery({
    queryKey: ["eng-where-used", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await db.rpc("ecn_where_used", { p_item: itemId });
      if (error) throw error;
      return (data ?? []) as { item_id: string; part_code: string; name: string; source_type: string; version: string; depth: number }[];
    },
  });

export const useEngineeringMutations = () => {
  const qc = useQueryClient();
  const refresh = () => {
    for (const k of ["eng-", "plm", "models", "parts", "bom-lines"]) {
      qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(k) });
    }
  };
  const fail = (e: any) => toast.error(e?.message ?? "Something went wrong");
  const run = <T,>(fn: (a: T) => Promise<any>, ok?: string | ((d: any) => string)) =>
    useMutation({
      mutationFn: async (a: T) => {
        const r = await fn(a);
        if (r?.error) throw r.error;
        return r?.data;
      },
      onSuccess: (d: any) => { refresh(); if (ok) toast.success(typeof ok === "function" ? ok(d) : ok); },
      onError: fail,
    });

  return {
    addLine: run((l: Partial<VLine> & { version_id: string }) => db.from("version_lines").insert(l)),
    updateLine: run(({ id, ...patch }: Partial<VLine> & { id: string }) => db.from("version_lines").update(patch).eq("id", id)),
    deleteLine: run((id: string) => db.from("version_lines").delete().eq("id", id)),
    changeSubassembly: run((a: { line: string; scope: "THIS" | "ALL" }) =>
      db.rpc("ecn_change_subassembly", { p_line: a.line, p_scope: a.scope }),
      (d) => d?.scope === "THIS" ? `New sub-assembly ${d.part_code}: change it below` : `Opened in this ECN for: ${(d?.affected ?? []).join(", ")}`),
    raiseEcn: run((a: { item: string; title: string; reason?: string; major?: boolean }) =>
      db.rpc("ecn_raise", { p_item: a.item, p_title: a.title, p_reason: a.reason ?? null, p_major: !!a.major }), "ECN raised: the draft is open"),
    updateEcn: run((a: { ecn: string; title: string; reason: string }) =>
      db.rpc("ecn_update", { p_ecn: a.ecn, p_title: a.title, p_reason: a.reason }), "ECN saved"),
    cancelEcn: run((ecn: string) => db.rpc("ecn_cancel", { p_ecn: ecn }), "ECN cancelled"),
    releaseEcn: run((a: { ecn: string; brands: string[] }) => db.rpc("ecn_release", { p_ecn: a.ecn, p_brands: a.brands }),
      (d) => `Released. ${d?.brands_moved ?? 0} brand code(s) moved to the new version.`),
    releaseVersion: run((a: { version: string; brands: string[] }) => db.rpc("version_release", { p_version: a.version, p_brands: a.brands }),
      (d) => `Released. ${d?.brands_moved ?? 0} brand code(s) built on it.`),
    moveBrand: run((a: { brand: string; version: string }) => db.rpc("model_move_brand", { p_brand: a.brand, p_version: a.version }),
      "Brand code moved to the version"),
  };
};
