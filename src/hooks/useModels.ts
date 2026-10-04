import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

/**
 * Model -> version -> brand.
 *
 *   JA-006          the model (category JA, number 006): the product's identity
 *     v1.0, v1.1    its master BOM per version; a hardware change is an ECN
 *       JA-006-PH   a brand code, built on one version plus its own cosmetics
 */
export interface ModelLine { child_part_id: string; quantity: number | null; bulk: boolean; is_critical: boolean }
export interface ModelVersion {
  id: string; model_id: string; major: number; minor: number; version: string;
  kind: "INITIAL" | "ECN" | "MAJOR"; ecn_no: string | null; reason: string | null; based_on: string | null;
  lines: ModelLine[]; status: "DRAFT" | "RELEASED";
  created_at: string; updated_at: string; released_at: string | null;
}
export interface ModelRow {
  id: string; part_code: string; name: string; category: string; model_version: string | null;
  plm_product_id: string | null; is_active: boolean;
  plm?: { product_code: string; stage: number } | null;
}
export interface BrandRow {
  id: string; part_code: string; name: string; brand: string; model_id: string; model_version: string | null;
  is_active: boolean; approval_status: string;
}
export interface PartLite { id: string; part_code: string; name: string; uom: string | null; category: string; branded_from: string | null }
export interface BrandBomLine { parent_part_id: string; child_part_id: string; quantity: number | null; issue_mode: string; is_critical: boolean }

export const byVersion = (a: ModelVersion, b: ModelVersion) => b.major - a.major || b.minor - a.minor;
export const latestReleased = (versions: ModelVersion[]) => versions.filter((v) => v.status === "RELEASED").sort(byVersion)[0];
/** "1.10" > "1.9" */
export const versionCmp = (a?: string | null, b?: string | null) => {
  const [am, an] = (a ?? "0.0").split(".").map(Number);
  const [bm, bn] = (b ?? "0.0").split(".").map(Number);
  return am - bm || an - bn;
};

const keys = { list: ["models"] as const, one: (code: string) => ["models", code] as const };

export const useModels = () =>
  useQuery({
    queryKey: keys.list,
    queryFn: async () => {
      const [m, v, b] = await Promise.all([
        db.from("parts").select("id, part_code, name, category, model_version, plm_product_id, is_active, plm:plm_products!parts_plm_product_id_fkey ( product_code, stage )")
          .eq("source_type", "MODEL").order("part_code"),
        db.from("model_versions").select("id, model_id, major, minor, version, kind, ecn_no, reason, based_on, status, created_at, updated_at, released_at, lines"),
        db.from("parts").select("id, part_code, name, brand, model_id, model_version, is_active, approval_status")
          .eq("source_type", "FINISHED_GOOD").not("model_id", "is", null).order("part_code"),
      ]);
      for (const r of [m, v, b]) if (r.error) throw r.error;
      return { models: m.data as ModelRow[], versions: v.data as ModelVersion[], brands: b.data as BrandRow[] };
    },
  });

/** One model with its versions, brands, the brands' BOMs and every part they name. */
export const useModel = (code?: string) =>
  useQuery({
    queryKey: keys.one(code ?? ""),
    enabled: !!code,
    queryFn: async () => {
      const { data: model, error } = await db.from("parts")
        .select("id, part_code, name, category, model_version, plm_product_id, is_active, plm:plm_products!parts_plm_product_id_fkey ( product_code, stage )")
        .eq("part_code", code).eq("source_type", "MODEL").maybeSingle();
      if (error) throw error;
      if (!model) return null;
      const [v, b] = await Promise.all([
        db.from("model_versions").select("*").eq("model_id", model.id),
        db.from("parts").select("id, part_code, name, brand, model_id, model_version, is_active, approval_status")
          .eq("model_id", model.id).order("part_code"),
      ]);
      for (const r of [v, b]) if (r.error) throw r.error;
      const versions = (v.data as ModelVersion[]).sort(byVersion);
      const brands = b.data as BrandRow[];
      const bomRes = brands.length
        ? await db.from("bom").select("parent_part_id, child_part_id, quantity, issue_mode, is_critical")
            .in("parent_part_id", brands.map((x) => x.id)).eq("is_active", true)
        : { data: [] };
      if (bomRes.error) throw bomRes.error;
      const bom = (bomRes.data ?? []) as BrandBomLine[];
      const ids = [...new Set([...bom.map((l) => l.child_part_id), ...versions.flatMap((x) => x.lines.map((l) => l.child_part_id))])];
      const parts = new Map<string, PartLite>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: ps, error: pe } = await db.from("parts").select("id, part_code, name, uom, category, branded_from").in("id", ids.slice(i, i + 200));
        if (pe) throw pe;
        for (const p of ps ?? []) parts.set(p.id, p);
      }
      return { model: model as ModelRow, versions, brands, bom, parts };
    },
  });

export const useNextModelCode = (category?: string) =>
  useQuery({
    queryKey: ["model-next-code", category],
    enabled: !!category,
    queryFn: async () => {
      const { data, error } = await db.rpc("model_next_code", { p_category: category });
      if (error) throw error;
      return data as string;
    },
  });

/** Base part of a line: a brand's printed version counts as the part it was printed from. */
export const baseOf = (parts: Map<string, PartLite>, id: string) => parts.get(id)?.branded_from ?? id;

export type CompareRow = {
  key: string; brandChild?: string; model?: ModelLine; brandQty?: number | null; brandBulk?: boolean;
  status: "SAME" | "QTY" | "MISSING" | "BRAND_ONLY";
};
/** A brand's BOM against the model version it is built on. */
export const compareBrand = (parts: Map<string, PartLite>, bom: BrandBomLine[], brandId: string, version?: ModelVersion) => {
  const mine = bom.filter((l) => l.parent_part_id === brandId);
  const model = new Map((version?.lines ?? []).map((l) => [l.child_part_id, l]));
  const rows: CompareRow[] = [];
  const seen = new Set<string>();
  for (const l of mine) {
    const key = baseOf(parts, l.child_part_id);
    seen.add(key);
    const m = model.get(key);
    const bulk = l.issue_mode === "BULK";
    rows.push({
      key, brandChild: l.child_part_id, model: m, brandQty: l.quantity, brandBulk: bulk,
      status: !m ? "BRAND_ONLY" : (m.bulk === bulk && (bulk || Number(m.quantity) === Number(l.quantity))) ? "SAME" : "QTY",
    });
  }
  for (const [key, m] of model) if (!seen.has(key)) rows.push({ key, model: m, status: "MISSING" });
  const code = (r: CompareRow) => parts.get(r.brandChild ?? r.key)?.part_code ?? "";
  rows.sort((a, b) => code(a).localeCompare(code(b)));
  const count = (s: CompareRow["status"]) => rows.filter((r) => r.status === s).length;
  return { rows, same: count("SAME"), qty: count("QTY"), missing: count("MISSING"), brandOnly: count("BRAND_ONLY") };
};

/** What changed from one version to the next, by base part. */
export const diffVersions = (from: ModelLine[] | undefined, to: ModelLine[]) => {
  const a = new Map((from ?? []).map((l) => [l.child_part_id, l]));
  const b = new Map(to.map((l) => [l.child_part_id, l]));
  const added = to.filter((l) => !a.has(l.child_part_id));
  const removed = (from ?? []).filter((l) => !b.has(l.child_part_id));
  const changed = to.filter((l) => {
    const o = a.get(l.child_part_id);
    return o && (o.bulk !== l.bulk || Number(o.quantity) !== Number(l.quantity) || o.is_critical !== l.is_critical);
  }).map((l) => ({ from: a.get(l.child_part_id)!, to: l }));
  return { added, removed, changed };
};

export const useModelMutations = () => {
  const qc = useQueryClient();
  const done = (msg?: string) => () => {
    qc.invalidateQueries({ queryKey: ["models"] });
    qc.invalidateQueries({ queryKey: ["parts"] });
    qc.invalidateQueries({ queryKey: ["bom-lines"] });
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("plm") });
    if (msg) toast.success(msg);
  };
  const fail = (e: any) => toast.error(e?.message ?? "Something went wrong");
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw error;
    return data;
  };

  return {
    createModel: useMutation({
      mutationFn: (a: { category: string; code: string; name: string; copyFrom?: string | null; plmProduct?: string | null }) =>
        rpc("model_create", { p_category: a.category, p_code: a.code, p_name: a.name, p_plm_product: a.plmProduct ?? null, p_copy_from: a.copyFrom ?? null }),
      onSuccess: done("Model created with a v1.0 draft"), onError: fail,
    }),
    rename: useMutation({
      mutationFn: async (a: { id: string; name: string }) => {
        const { error } = await db.from("parts").update({ name: a.name }).eq("id", a.id);
        if (error) throw error;
      },
      onSuccess: done("Name saved"), onError: fail,
    }),
    saveVersion: useMutation({
      mutationFn: (a: { id: string; lines: ModelLine[] }) => rpc("model_version_save", { p_version: a.id, p_lines: a.lines }),
      onSuccess: done("Draft saved"), onError: fail,
    }),
    updateReason: useMutation({
      // The reason is part of the ECN; the draft's lines are left as they are.
      mutationFn: async (a: { id: string; reason: string }) => {
        const { error } = await db.rpc("model_version_reason", { p_version: a.id, p_reason: a.reason });
        if (error) throw error;
      },
      onSuccess: done("Reason saved"), onError: fail,
    }),
    release: useMutation({
      mutationFn: (id: string) => rpc("model_version_release", { p_version: id }),
      onSuccess: done("Version released"), onError: fail,
    }),
    raiseEcn: useMutation({
      mutationFn: (a: { model: string; reason: string; major: boolean }) =>
        rpc("model_raise_ecn", { p_model: a.model, p_reason: a.reason, p_major: a.major }),
      onSuccess: done("Draft opened. Change its BOM, then release it."), onError: fail,
    }),
    discard: useMutation({
      mutationFn: (id: string) => rpc("model_version_discard", { p_version: id }),
      onSuccess: done("Draft discarded"), onError: fail,
    }),
    moveBrand: useMutation({
      mutationFn: (a: { brand: string; version: string }) => rpc("model_move_brand", { p_brand: a.brand, p_version: a.version }),
      onSuccess: done("Brand moved to the new version"), onError: fail,
    }),
    addBrand: useMutation({
      mutationFn: (a: { model: string; brand: string; name: string }) =>
        rpc("model_add_brand", { p_model: a.model, p_brand: a.brand, p_name: a.name }),
      onSuccess: (d: any) => {
        done()();
        toast.success(d?.bom?.applied === false
          ? `${d.part_code} created; its BOM from v${d.version} is waiting in Approvals`
          : `${d?.part_code} created${d?.version ? ` on v${d.version}` : ""}`);
      },
      onError: fail,
    }),
  };
};

/** What moving a brand to a version would do to its BOM, before doing it. */
export const brandMovePreview = async (brand: string, version: string) => {
  const { data, error } = await db.rpc("model_brand_lines", { p_brand: brand, p_target: version });
  if (error) throw error;
  return (data ?? []) as { child_part_id: string; quantity: number | null; bulk: boolean; is_critical: boolean }[];
};
