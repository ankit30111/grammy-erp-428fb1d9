import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Software testing and release of a model, run from R&D:
 *   1 software file · 2 version · 3 testing report · 4 issue list · 5 approved for production
 * Approved releases show on the model's finished goods; the newest approved one
 * is the software in production. The database enforces the order and the rights.
 */

const db = supabase as any;
export const SOFTWARE_BUCKET = "raw-material-documents";

export interface SoftwareRelease {
  id: string; model_id: string; model_code: string; version: string;
  file_path: string; file_name: string;
  test_report_path: string | null; test_report_name: string | null;
  issue_list_path: string | null; issue_list_name: string | null;
  details: string | null; status: "TESTING" | "APPROVED" | "REJECTED"; decision_note: string | null;
  decided_at: string | null; decided_by_name: string | null;
  created_at: string; created_by_name: string | null; updated_at: string; updated_by_name: string | null;
  in_production: boolean | null;
}

export const fmtDay = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");
const byNewest = (a: SoftwareRelease, b: SoftwareRelease) =>
  b.created_at.localeCompare(a.created_at) || b.version.localeCompare(a.version, "en", { numeric: true });

export function useSoftwareReleases(modelId?: string | null) {
  return useQuery({
    queryKey: ["software-releases", modelId],
    enabled: !!modelId,
    queryFn: async (): Promise<SoftwareRelease[]> => {
      const { data, error } = await db.from("software_release_history").select("*").eq("model_id", modelId);
      if (error) throw error;
      return ((data ?? []) as SoftwareRelease[]).sort(byNewest);
    },
  });
}

const clean = (s: string) => s.replace(/[^\w.-]+/g, "_");
async function upload(modelCode: string, version: string, kind: string, file: File) {
  const path = `software/${clean(modelCode)}/${clean(version)}/${kind}_${Date.now()}_${clean(file.name)}`;
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

export function useSoftwareMutations(modelId: string, modelCode: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["software-releases", modelId] });
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("plm") });
  };
  const fail = (e: any) => toast.error(e?.code === "23505" ? "That version is already there" : e?.message ?? "Could not save");

  const create = useMutation({
    mutationFn: async (f: { version: string; file: File; testReport?: File | null; issueList?: File | null; details: string }) => {
      const version = f.version.trim().replace(/^v(?=\d)/i, "");
      const file_path = await upload(modelCode, version, "software", f.file);
      const test_report_path = f.testReport ? await upload(modelCode, version, "test-report", f.testReport) : null;
      const issue_list_path = f.issueList ? await upload(modelCode, version, "issue-list", f.issueList) : null;
      const { error } = await db.from("software_releases").insert({
        model_id: modelId, version, file_path, file_name: f.file.name,
        test_report_path, test_report_name: f.testReport?.name ?? null,
        issue_list_path, issue_list_name: f.issueList?.name ?? null,
        details: f.details.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Software uploaded for testing"); },
    onError: fail,
  });

  const attach = useMutation({
    mutationFn: async ({ r, kind, file }: { r: SoftwareRelease; kind: DocKind; file: File }) => {
      const path = await upload(modelCode, r.version, kind.replace("_", "-"), file);
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
      if (v.status === "APPROVED") toast.success("Approved for production");
      else if (v.status === "REJECTED") toast.success("Rejected");
    },
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

  return { create, attach, update, remove };
}
