import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

/**
 * Model -> version -> brand.
 *
 *   JA-006          the model (category JA, number 006): the product's identity
 *     v1.0, v1.1    R&D's BOM per version (item_versions / version_lines)
 *       JA-006-PH   a brand code, built on one version: its BOM is the
 *                   version's lines for that brand
 */
export interface ModelVersionRow {
  id: string; item_id: string; major: number; minor: number; version: string;
  kind: "INITIAL" | "ECN" | "MAJOR"; status: "DRAFT" | "RELEASED"; note: string | null;
  created_at: string; released_at: string | null; ecn: { ecn_no: string; title: string } | null;
  lines: number;
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

export const byVersion = (a: { major: number; minor: number }, b: { major: number; minor: number }) => b.major - a.major || b.minor - a.minor;
export const latestReleased = <T extends { status: string; major: number; minor: number }>(versions: T[]) =>
  versions.filter((v) => v.status === "RELEASED").sort(byVersion)[0];
/** "1.10" > "1.9" */
export const versionCmp = (a?: string | null, b?: string | null) => {
  const [am, an] = (a ?? "0.0").split(".").map(Number);
  const [bm, bn] = (b ?? "0.0").split(".").map(Number);
  return am - bm || an - bn;
};

const MODEL_SELECT = "id, part_code, name, category, model_version, plm_product_id, is_active, plm:plm_products!parts_plm_product_id_fkey ( product_code, stage )";
const VERSION_SELECT = "id, item_id, major, minor, version, kind, status, note, created_at, released_at, ecn:ecns ( ecn_no, title ), version_lines!version_lines_version_id_fkey(count)";

const toVersion = (v: any): ModelVersionRow => ({ ...v, lines: v.version_lines?.[0]?.count ?? 0 });

export const useModels = () =>
  useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const [m, b] = await Promise.all([
        db.from("parts").select(MODEL_SELECT).eq("source_type", "MODEL").order("part_code"),
        db.from("parts").select("id, part_code, name, brand, model_id, model_version, is_active, approval_status")
          .eq("source_type", "FINISHED_GOOD").not("model_id", "is", null).order("part_code"),
      ]);
      for (const r of [m, b]) if (r.error) throw r.error;
      const ids = (m.data ?? []).map((x: any) => x.id);
      const v = ids.length ? await db.from("item_versions").select(VERSION_SELECT).in("item_id", ids) : { data: [] };
      if (v.error) throw v.error;
      return { models: m.data as ModelRow[], versions: (v.data ?? []).map(toVersion) as ModelVersionRow[], brands: b.data as BrandRow[] };
    },
  });

/** One model, its versions and its brand codes. */
export const useModel = (code?: string) =>
  useQuery({
    queryKey: ["models", code],
    enabled: !!code,
    queryFn: async () => {
      const { data: model, error } = await db.from("parts").select(MODEL_SELECT).eq("part_code", code).eq("source_type", "MODEL").maybeSingle();
      if (error) throw error;
      if (!model) return null;
      const [v, b] = await Promise.all([
        db.from("item_versions").select(VERSION_SELECT).eq("item_id", model.id),
        db.from("parts").select("id, part_code, name, brand, model_id, model_version, is_active, approval_status").eq("model_id", model.id).order("part_code"),
      ]);
      for (const r of [v, b]) if (r.error) throw r.error;
      return { model: model as ModelRow, versions: (v.data ?? []).map(toVersion).sort(byVersion) as ModelVersionRow[], brands: b.data as BrandRow[] };
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

export const useModelMutations = () => {
  const qc = useQueryClient();
  const done = (msg?: string) => () => {
    for (const k of ["models", "parts", "bom-lines", "eng-", "plm"]) qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(k) });
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
      onSuccess: done("Model created with its R&D product and a v1.0 draft"), onError: fail,
    }),
    rename: useMutation({
      mutationFn: async (a: { id: string; name: string }) => {
        const { error } = await db.from("parts").update({ name: a.name }).eq("id", a.id);
        if (error) throw error;
      },
      onSuccess: done("Name saved"), onError: fail,
    }),
    moveBrand: useMutation({
      mutationFn: (a: { brand: string; version: string }) => rpc("model_move_brand", { p_brand: a.brand, p_version: a.version }),
      onSuccess: done("Brand code moved to the version"), onError: fail,
    }),
    addBrand: useMutation({
      mutationFn: (a: { model: string; brand: string; name: string }) =>
        rpc("model_add_brand", { p_model: a.model, p_brand: a.brand, p_name: a.name }),
      onSuccess: (d: any) => {
        done()();
        toast.success(d?.bom?.applied === false
          ? `${d.part_code} created; its BOM is waiting in Approvals`
          : `${d?.part_code} created${d?.version ? ` on v${d.version}` : ""}`);
      },
      onError: fail,
    }),
  };
};
