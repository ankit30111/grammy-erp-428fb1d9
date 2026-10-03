import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * R&D / PLM. One product (Product ID) from idea to mass production.
 * Everything here reads and writes the plm_* tables; the stage is worked out
 * by the database (plm_refresh) from the gates and is never set from the screen.
 */
const db = supabase as any;

export const STAGES = [
  { n: 1, name: "Idea Creation", gate: "Sample & cost approved by the customer (Harish if Grammy-owned)" },
  { n: 2, name: "Design Confirmation", gate: "BOM complete above 70%" },
  { n: 3, name: "Engineering Validation", gate: "EVT sign-off: every EVT test passed" },
  { n: 4, name: "System Verification", gate: "BOM above 95%, all closed, SVT passed, no open issues" },
  { n: 5, name: "Pilot Production", gate: "BIS letter, all PP items closed, Management releases" },
  { n: 6, name: "Mass Production", gate: "" },
] as const;

export const BIS_STEPS = [
  ["NOT_STARTED", "Not started"], ["APPLIED", "Applied"], ["SAMPLE_SENT", "Sample sent"],
  ["TESTING", "Testing"], ["LETTER_RECEIVED", "Letter received"], ["NOT_REQUIRED", "Not required"],
] as const;

export const DELIVERABLE_STATES = [["OPEN", "Open"], ["WIP", "WIP"], ["CLOSED", "Closed"], ["NA", "N/A"]] as const;

export interface PlmProduct {
  id: string; product_code: string; name: string; category: string | null;
  kind: "NEW_MODEL" | "VARIATION"; based_on_id: string | null;
  ownership: "GRAMMY" | "CLIENT"; client: string | null; customer_id: string | null;
  business_model: "ODM" | "OEM" | null; priority: "HIGH" | "MEDIUM" | "LOW";
  start_date: string | null; target_launch: string | null; target_cost: number | null;
  stage: number; status: "ACTIVE" | "ON_HOLD" | "DROPPED";
  bis_status: string; bis_letter_url: string | null; firmware_version: string | null; notes: string | null;
  created_at: string;
}

export interface PlmMetrics {
  fg_count: number; bom_lines: number; bom_done: number; bom_pct: number; spec_pct: number;
  cost: { part_id: string; part_code: string; cost: number; unpriced: number; foreign: number }[];
  evt_total: number; evt_pass: number; svt_total: number; svt_pass: number; svt_not_passed: number;
  open_issues: number;
  deliverables: Record<string, { total: number; done: number; open: string[] }>;
  pilot_vouchers: { id: string; voucher_number: string; part_code: string; quantity: number; produced: number | null; status: string; planned_date: string }[];
}

const keys = {
  list: ["plm-products"],
  one: (code: string) => ["plm-product", code],
};

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("plm") });
};

const fail = (e: any) => toast.error(e?.message ?? String(e));

/** Every product with its gates, open issue count and deliverable progress, for the pipeline. */
export const usePlmProducts = () =>
  useQuery({
    queryKey: keys.list,
    queryFn: async () => {
      await db.rpc("plm_refresh_all");
      const [p, d, i, f, c] = await Promise.all([
        db.from("plm_products").select("*").order("product_code"),
        db.from("plm_deliverables").select("product_id, status, plm_deliverable_template(stage)"),
        db.from("plm_issues").select("id, issue_no, product_id, stage, description, severity, owner, target_date, status, raised_on"),
        db.from("parts").select("id, part_code, plm_product_id").not("plm_product_id", "is", null),
        db.from("plm_catch_up").select("*"),
      ]);
      for (const r of [p, d, i, f, c]) if (r.error) throw r.error;
      const progress = new Map<string, Record<number, { total: number; done: number }>>();
      for (const row of d.data ?? []) {
        const s = row.plm_deliverable_template?.stage;
        const m = progress.get(row.product_id) ?? {};
        m[s] = m[s] ?? { total: 0, done: 0 };
        m[s].total++;
        if (row.status === "CLOSED" || row.status === "NA") m[s].done++;
        progress.set(row.product_id, m);
      }
      return {
        products: (p.data ?? []) as PlmProduct[],
        progress,
        issues: (i.data ?? []) as any[],
        fgs: (f.data ?? []) as { id: string; part_code: string; plm_product_id: string }[],
        /** Built in production before their R&D release: R&D to complete. */
        catchUp: (c.data ?? []) as { product_id: string; product_code: string; stage: number; vouchers: string; part_codes: string }[],
      };
    },
  });

/** One product with everything hanging off it. */
export const usePlmProduct = (code?: string) =>
  useQuery({
    queryKey: keys.one(code ?? ""),
    enabled: !!code,
    queryFn: async () => {
      const { data: product, error } = await db.from("plm_products").select("*").eq("product_code", code).maybeSingle();
      if (error) throw error;
      if (!product) return null;
      await db.rpc("plm_refresh", { p_product: product.id });
      const [fresh, del, gates, tests, issues, fgs, metrics, base, variations, catchUp] = await Promise.all([
        db.from("plm_products").select("*").eq("id", product.id).single(),
        db.from("plm_deliverables").select("*, plm_deliverable_template(stage, label, sort)").eq("product_id", product.id),
        db.from("plm_gates").select("*").eq("product_id", product.id).order("gate"),
        db.from("plm_tests").select("*").eq("product_id", product.id).order("phase").order("sort").order("created_at"),
        db.from("plm_issues").select("*").eq("product_id", product.id).order("issue_no"),
        db.from("parts").select("id, part_code, name, brand").eq("plm_product_id", product.id).order("part_code"),
        db.rpc("plm_metrics", { p_product: product.id }),
        product.based_on_id
          ? db.from("plm_products").select("id, product_code, name").eq("id", product.based_on_id).maybeSingle()
          : Promise.resolve({ data: null }),
        db.from("plm_products").select("id, product_code, name, client, stage").eq("based_on_id", product.id).order("product_code"),
        db.from("plm_catch_up").select("*").eq("product_id", product.id).maybeSingle(),
      ]);
      for (const r of [fresh, del, gates, tests, issues, fgs, metrics]) if (r.error) throw r.error;
      const blockers: Record<number, string[]> = {};
      const stage = fresh.data.stage as number;
      if (stage < 6) {
        const { data: b } = await db.rpc("plm_gate_blockers", { p_product: product.id, p_gate: stage });
        blockers[stage] = b ?? [];
      }
      return {
        product: fresh.data as PlmProduct,
        deliverables: (del.data ?? []).sort((a: any, b: any) =>
          a.plm_deliverable_template.stage - b.plm_deliverable_template.stage || a.plm_deliverable_template.sort - b.plm_deliverable_template.sort),
        gates: gates.data ?? [],
        tests: tests.data ?? [],
        issues: issues.data ?? [],
        fgs: fgs.data ?? [],
        metrics: metrics.data as PlmMetrics,
        base: base.data as { id: string; product_code: string; name: string } | null,
        variations: variations.data ?? [],
        catchUp: catchUp.data as { vouchers: string; part_codes: string } | null,
        blockers,
      };
    },
  });

/** Upload a document into the R&D bucket and return its stored path. */
export async function uploadPlmFile(productCode: string, key: string, file: File): Promise<string> {
  const path = `plm/${productCode}/${key}_${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error } = await supabase.storage.from("npd-specifications").upload(path, file);
  if (error) throw error;
  return path;
}

export async function openPlmFile(path: string) {
  const { data, error } = await supabase.storage.from("npd-specifications").createSignedUrl(path, 600);
  if (error) return fail(error);
  window.open(data.signedUrl, "_blank", "noopener");
}

/** All writes, each followed by a refresh so the stage and gates move. */
export const usePlmMutations = () => {
  const qc = useQueryClient();
  const wrap = <T,>(fn: (a: T) => Promise<any>, ok?: string) =>
    useMutation({
      mutationFn: async (a: T) => {
        const r = await fn(a);
        if (r?.error) throw r.error;
        return r?.data;
      },
      onSuccess: () => { invalidateAll(qc); if (ok) toast.success(ok); },
      onError: fail,
    });

  return {
    createProduct: wrap((p: Partial<PlmProduct>) => db.from("plm_products").insert(p).select().single(), "Product created"),
    updateProduct: wrap(({ id, ...patch }: Partial<PlmProduct> & { id: string }) => db.from("plm_products").update(patch).eq("id", id), "Saved"),
    updateDeliverable: wrap(({ id, ...patch }: { id: string; status?: string; file_url?: string | null; owner?: string | null; due_date?: string | null; note?: string | null }) =>
      db.from("plm_deliverables").update(patch).eq("id", id)),
    passGate: wrap((a: { product: string; gate: number; approvedBy?: string; fileUrl?: string; note?: string }) =>
      db.rpc("plm_pass_gate", { p_product: a.product, p_gate: a.gate, p_approved_by: a.approvedBy ?? null, p_file_url: a.fileUrl ?? null, p_note: a.note ?? null }), "Gate passed"),
    releaseOverride: wrap((a: { product: string; reason: string }) =>
      db.rpc("plm_release_override", { p_product: a.product, p_reason: a.reason }), "Released to mass production"),
    linkPart: wrap((a: { product: string; part: string; link: boolean }) =>
      db.rpc("plm_link_part", { p_product: a.product, p_part: a.part, p_link: a.link })),
    copyBom: wrap((a: { from: string; to: string }) => db.rpc("plm_copy_bom", { p_from_part: a.from, p_to_part: a.to }), "BOM copied"),
    addTest: wrap((t: { product_id: string; phase: string; name: string; sort?: number }) => db.from("plm_tests").insert(t)),
    copyTests: wrap(async (a: { from: string; to: string }) => {
      const { data, error } = await db.from("plm_tests").select("phase, name, sort").eq("product_id", a.from);
      if (error) throw error;
      if (!data?.length) throw new Error("That product has no tests to copy");
      return db.from("plm_tests").insert(data.map((t: any) => ({ ...t, product_id: a.to })));
    }, "Tests copied"),
    updateTest: wrap(({ id, ...patch }: { id: string; result?: string; note?: string | null; report_url?: string | null }) =>
      db.from("plm_tests").update(patch).eq("id", id)),
    deleteTest: wrap((id: string) => db.from("plm_tests").delete().eq("id", id)),
    addIssue: wrap((i: any) => db.from("plm_issues").insert(i), "Issue raised"),
    updateIssue: wrap(({ id, ...patch }: any) => db.from("plm_issues").update(patch).eq("id", id)),
    schedulePilot: wrap((a: { plant: string; part: string; qty: number; date: string }) =>
      db.rpc("plm_schedule_pilot", { p_plant_id: a.plant, p_part_id: a.part, p_quantity: a.qty, p_date: a.date }), "Pilot voucher created"),
  };
};
