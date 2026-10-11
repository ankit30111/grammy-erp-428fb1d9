import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Customer complaints.
 *
 *   Receipt (one complaint or a batch) → one complaint per unit (CC-…)
 *     → OQC analysis (serial, cause, findings) → faulty parts to IQC
 *     → IQC analysis per part (verdict, vendor, root cause, RCA / CAPA)
 *     → closed with the resolution given to the customer.
 *
 * The database keeps the complaint's status in step with its parts.
 */

const db = supabase as any;

export const RECEIPT_TYPES = [
  { value: "COMPLETE_PRODUCTS", label: "Complete products", hint: "Units sent back by the customer" },
  { value: "FAULTY_PARTS_ONLY", label: "Faulty parts only", hint: "Only the failed part came back" },
  { value: "DATA_ONLY", label: "Data only", hint: "Photos, videos or a report, no material" },
] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number]["value"];

export const CAUSES = [
  { value: "MANUFACTURING_FAULT", label: "Manufacturing fault" },
  { value: "COMPONENT_FAULT", label: "Component (vendor) fault" },
  { value: "DESIGN_ISSUE", label: "Design issue" },
  { value: "USER_MISHANDLING", label: "User mishandling" },
  { value: "TRANSIT_DAMAGE", label: "Transit damage" },
  { value: "NO_FAULT_FOUND", label: "No fault found" },
] as const;

export const COMPLAINT_STATUS: Record<string, { label: string; tone: "destructive" | "default" | "secondary" | "outline" }> = {
  OPEN: { label: "Received", tone: "destructive" },
  UNDER_REVIEW: { label: "Under analysis", tone: "default" },
  PARTS_SENT: { label: "Parts at IQC", tone: "secondary" },
  RESOLVED: { label: "Analysis done", tone: "secondary" },
  CLOSED: { label: "Closed", tone: "outline" },
};

export const PART_STATUS: Record<string, string> = { UNDER_ANALYSIS: "At IQC", ANALYSED: "Analysed", CLOSED: "Closed" };
export const VERDICTS = [
  { value: "FAULTY", label: "Faulty" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "USABLE", label: "OK / usable" },
] as const;

export const causeLabel = (c?: string | null) => CAUSES.find((x) => x.value === c)?.label ?? "";
export const receiptTypeLabel = (t?: string | null) => RECEIPT_TYPES.find((x) => x.value === t)?.label ?? "";
export const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "");
export const ageDays = (iso?: string | null) =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso.slice(0, 10)).getTime()) / 86400000)) : 0;

/** Quality (and Admin) receive and analyse complaints; everyone else reads. */
export const useCanHandleComplaints = () => {
  const { canAccessModule } = useAuth();
  return canAccessModule("quality");
};

const COMPLAINT_SELECT = `
  id, complaint_number, status, serial_number, received_date, purchase_date, complaint_details, cause, analysis,
  analysed_at, resolution, resolved_at, created_at, receipt_id, part_id, faulty_part_id,
  customer:customers ( id, name, customer_code ),
  product:parts!customer_complaints_part_id_fkey ( id, part_code, name ),
  faulty:parts!customer_complaints_faulty_part_id_fkey ( id, part_code, name ),
  receipt:complaint_receipts ( id, receipt_number, receipt_type, customer_reference, receipt_date ),
  parts:customer_complaint_parts ( id, status )`;

export function useComplaints() {
  return useQuery({
    queryKey: ["complaints"],
    queryFn: async () => {
      const out: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from("customer_complaints").select(COMPLAINT_SELECT)
          .order("created_at", { ascending: false }).order("complaint_number", { ascending: false }).range(from, from + 999);
        if (error) throw error;
        out.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
}

export function useComplaint(id?: string | null) {
  return useQuery({
    queryKey: ["complaint", id],
    enabled: !!id,
    queryFn: async () => {
      const [c, parts] = await Promise.all([
        db.from("customer_complaints").select(COMPLAINT_SELECT).eq("id", id).single(),
        db.from("customer_complaint_parts")
          .select("*, part:parts ( id, part_code, name ), vendor:vendors ( id, name )")
          .eq("complaint_id", id).order("created_at"),
      ]);
      if (c.error) throw c.error;
      if (parts.error) throw parts.error;
      return { ...c.data, partRows: parts.data ?? [] };
    },
  });
}

export function useComplaintReceipts() {
  return useQuery({
    queryKey: ["complaint-receipts"],
    queryFn: async () => {
      const { data, error } = await db.from("complaint_receipts")
        .select("id, receipt_number, receipt_type, customer_reference, receipt_date, notes, created_at, customer:customers ( name, customer_code ), items:complaint_receipt_items ( quantity, symptom, part:parts!complaint_receipt_items_part_id_fkey ( part_code ) ), complaints:customer_complaints ( status )")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Parts sent to IQC from complaints, for the IQC Part Analysis tab. */
export function useComplaintPartsForIqc() {
  return useQuery({
    queryKey: ["complaint-parts-iqc"],
    queryFn: async () => {
      const { data, error } = await db.from("customer_complaint_parts")
        .select("*, part:parts ( id, part_code, name, part_vendors ( is_primary, vendor_id ) ), vendor:vendors ( id, name ), complaint:customer_complaints ( id, complaint_number, serial_number, complaint_details, cause, analysis, received_date, customer:customers ( name ), product:parts!customer_complaints_part_id_fkey ( part_code, name ) )")
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useComplaintMutations() {
  const qc = useQueryClient();
  const refresh = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["complaints"] });
    qc.invalidateQueries({ queryKey: ["complaint-receipts"] });
    qc.invalidateQueries({ queryKey: ["complaint-parts-iqc"] });
    if (id) qc.invalidateQueries({ queryKey: ["complaint", id] });
  };
  const fail = (e: any) => toast.error(e?.message ?? "Could not save");

  const createReceipt = useMutation({
    mutationFn: async ({ receipt, items }: { receipt: Record<string, any>; items: Record<string, any>[] }) => {
      const { data, error } = await db.rpc("complaint_receipt_create", { p_receipt: receipt, p_items: items });
      if (error) throw error;
      return data as { receipt_number: string; complaints: number; first: string; last: string };
    },
    onSuccess: (r) => {
      refresh();
      toast.success(`${r.receipt_number} saved: ${r.complaints === 1 ? r.first : `${r.complaints} complaints, ${r.first} to ${r.last}`}`);
    },
    onError: fail,
  });

  const updateComplaint = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Record<string, any>) => {
      const { error } = await db.from("customer_complaints").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => refresh(v.id),
    onError: fail,
  });

  const sendParts = useMutation({
    mutationFn: async ({ complaintId, rows }: { complaintId: string; rows: { part_id: string; quantity: number; problem: string; vendor_id?: string | null }[] }) => {
      const { error } = await db.from("customer_complaint_parts").insert(rows.map((r) => ({ complaint_id: complaintId, ...r })));
      if (error) throw error;
    },
    onSuccess: (_d, v) => { refresh(v.complaintId); toast.success("Sent to IQC"); },
    onError: fail,
  });

  const updatePart = useMutation({
    mutationFn: async ({ id, complaintId: _c, ...patch }: { id: string; complaintId?: string } & Record<string, any>) => {
      const { error } = await db.from("customer_complaint_parts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => refresh(v.complaintId),
    onError: fail,
  });

  const removePart = useMutation({
    mutationFn: async ({ id }: { id: string; complaintId: string }) => {
      const { error } = await db.from("customer_complaint_parts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => refresh(v.complaintId),
    onError: fail,
  });

  return { createReceipt, updateComplaint, sendParts, updatePart, removePart };
}

/** RCA / CAPA documents of a complaint part, kept with the IQC reports. */
export const COMPLAINT_DOC_BUCKET = "iqc-reports";
export async function uploadComplaintDoc(complaintNo: string, kind: "rca" | "capa", file: File) {
  const path = `complaints/${complaintNo}/${kind}_${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error } = await supabase.storage.from(COMPLAINT_DOC_BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}
export async function openComplaintDoc(path: string) {
  const { data, error } = await supabase.storage.from(COMPLAINT_DOC_BUCKET).createSignedUrl(path, 600);
  if (error || !data) return toast.error("Could not open the document");
  window.open(data.signedUrl, "_blank", "noopener");
}
