import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Software of a brand code (JA-006-PH), released from R&D:
 *   1 file · 2 version · 3 testing report · 4 issue list
 *   5 R&D check (another R&D person, never the uploader) · 6 Management approval
 * The approved version activated last is the one in production. Management can
 * put an older approved version back; the newer ones are then withdrawn.
 * Files are in a private bucket only R&D, Management and Admin can open;
 * everyone else sees the version, date and checksum.
 */

const db = supabase as any;
export const SOFTWARE_BUCKET = "software-releases";

export type ReleaseStatus = "TESTING" | "RD_CHECKED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
export interface SoftwareRelease {
  id: string; part_id: string; part_code: string; brand: string | null; model_id: string | null; version: string;
  file_path: string; file_name: string; file_size: number | null; sha256: string | null;
  test_report_path: string | null; test_report_name: string | null;
  issue_list_path: string | null; issue_list_name: string | null;
  details: string | null; status: ReleaseStatus; decision_note: string | null;
  rd_checked_at: string | null; rd_checked_by_name: string | null;
  approved_at: string | null; approved_by_name: string | null; activated_at: string | null;
  created_by: string | null; created_by_name: string | null; created_at: string; updated_at: string;
  in_production: boolean | null;
}
export interface BrandCode { id: string; part_code: string; name: string; brand: string | null }

export const fmtDay = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");
export const shortSum = (s?: string | null) => (s ? `${s.slice(0, 8)}…${s.slice(-4)}` : "");
export const fmtSize = (n?: number | null) =>
  n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
const byNewest = (a: SoftwareRelease, b: SoftwareRelease) =>
  b.created_at.localeCompare(a.created_at) || b.version.localeCompare(a.version, "en", { numeric: true });

/** R&D: the model's brand codes and every release of each. */
export function useModelSoftware(modelId?: string | null) {
  return useQuery({
    queryKey: ["software-releases", modelId],
    enabled: !!modelId,
    queryFn: async () => {
      const [codes, rel] = await Promise.all([
        db.from("parts").select("id, part_code, name, brand").eq("model_id", modelId).eq("is_active", true).order("part_code"),
        db.from("software_release_history").select("*").eq("model_id", modelId),
      ]);
      if (codes.error) throw codes.error;
      if (rel.error) throw rel.error;
      return { codes: (codes.data ?? []) as BrandCode[], releases: ((rel.data ?? []) as SoftwareRelease[]).sort(byNewest) };
    },
  });
}

/** Everyone: the version in production of these brand codes (no files). */
export function useSoftwareInProduction(partIds: string[]) {
  return useQuery({
    queryKey: ["software-in-production", [...partIds].sort().join(",")],
    enabled: partIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("software_in_production").select("*").in("part_id", partIds);
      if (error) throw error;
      return new Map<string, { version: string; activated_at: string; sha256: string | null; file_size: number | null }>(
        (data ?? []).map((r: any) => [r.part_id, r]));
    },
  });
}

async function sha256Hex(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const clean = (s: string) => s.replace(/[^\w.-]+/g, "_");
async function upload(partCode: string, version: string, kind: string, file: File) {
  const path = `${clean(partCode)}/${clean(version)}/${kind}_${Date.now()}_${clean(file.name)}`;
  const { error } = await supabase.storage.from(SOFTWARE_BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

export async function downloadSoftwareFile(path: string, name: string) {
  const { data, error } = await supabase.storage.from(SOFTWARE_BUCKET).download(path);
  if (error || !data) return toast.error("Could not download the file");
  const url = URL.createObjectURL(data);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export type DocKind = "test_report" | "issue_list";

export function useSoftwareMutations(modelId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["software-releases", modelId] });
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("software-in-production") || String(q.queryKey[0] ?? "").startsWith("plm") });
  };
  const fail = (e: any) => toast.error(e?.code === "23505" ? "That version is already there for this brand code" : e?.message ?? "Could not save");

  const create = useMutation({
    mutationFn: async (f: { code: BrandCode; version: string; file: File; testReport?: File | null; issueList?: File | null; details: string }) => {
      const version = f.version.trim().replace(/^v(?=\d)/i, "");
      const sha256 = await sha256Hex(f.file);
      const file_path = await upload(f.code.part_code, version, "software", f.file);
      const test_report_path = f.testReport ? await upload(f.code.part_code, version, "test-report", f.testReport) : null;
      const issue_list_path = f.issueList ? await upload(f.code.part_code, version, "issue-list", f.issueList) : null;
      const { error } = await db.from("software_releases").insert({
        part_id: f.code.id, version, file_path, file_name: f.file.name, file_size: f.file.size, sha256,
        test_report_path, test_report_name: f.testReport?.name ?? null,
        issue_list_path, issue_list_name: f.issueList?.name ?? null,
        details: f.details.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Uploaded for testing"); },
    onError: fail,
  });

  const attach = useMutation({
    mutationFn: async ({ r, kind, file }: { r: SoftwareRelease; kind: DocKind; file: File }) => {
      const path = await upload(r.part_code, r.version, kind.replace("_", "-"), file);
      const { error } = await db.from("software_releases").update({ [`${kind}_path`]: path, [`${kind}_name`]: file.name }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: fail,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Record<string, any>) => {
      const { error } = await db.from("software_releases").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      refresh();
      const msg: Record<string, string> = { RD_CHECKED: "R&D check done", APPROVED: "Approved for production", REJECTED: "Rejected", TESTING: "Back to testing" };
      if (v.status && msg[v.status]) toast.success(msg[v.status]);
    },
    onError: fail,
  });

  const reactivate = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await db.rpc("software_release_reactivate", { p_release: id, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Back in production"); },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: async (r: SoftwareRelease) => {
      const { error } = await db.from("software_releases").delete().eq("id", r.id);
      if (error) throw error;
      await supabase.storage.from(SOFTWARE_BUCKET).remove([r.file_path, r.test_report_path, r.issue_list_path].filter(Boolean) as string[]);
    },
    onSuccess: refresh,
    onError: fail,
  });

  return { create, attach, update, reactivate, remove };
}
