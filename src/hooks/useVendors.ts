import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// The columns every signed-in user may read. Bank details, PAN and certificate
// URLs are not granted to them at all; Management and Admin fetch those through
// get_vendor_finance(uuid).
const VENDOR_SAFE_COLS =
  "id, vendor_code, name, email, contact_number, address, gst_number, is_active, created_at, updated_at, created_by, contact_person_name, contact_designation, supplies, location, approval_status, rejection_reason";

export type VendorFinance = {
  id: string;
  bank_account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  account_holder_name: string | null;
  pan_number: string | null;
  gst_certificate_url: string | null;
  msme_certificate_url: string | null;
};

export type VendorContact = {
  id?: string;
  name: string;
  designation: string;
  phone: string;
  email: string;
};

export type VendorInput = {
  id?: string;
  name: string;
  contact_person_name?: string;
  contact_designation?: string;
  email?: string;
  contact_number?: string;
  address?: string;
  gst_number?: string;
  supplies?: string;
  location?: string;
  /** Only sent when an admin has loaded and edited them. Left out, the saved
   *  bank details are untouched - an edit by anyone else must not blank them. */
  finance?: {
    bank_account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
    account_holder_name?: string;
    pan_number?: string;
  };
  gst_certificate?: File;
  msme_certificate?: File;
  /** The full list of other contacts. Left out, contacts are untouched. */
  contacts?: VendorContact[];
};

export const useVendorFinance = (vendorId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: ["vendor-finance", vendorId],
    enabled: !!vendorId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_vendor_finance" as any, { p_vendor_id: vendorId });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as VendorFinance | undefined;
    },
  });

export const useVendorContacts = (vendorId: string | undefined) =>
  useQuery({
    queryKey: ["vendor-contacts", vendorId],
    enabled: !!vendorId,
    queryFn: async (): Promise<VendorContact[]> => {
      const { data, error } = await (supabase as any)
        .from("vendor_contacts")
        .select("id, name, designation, phone, email")
        .eq("vendor_id", vendorId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        id: c.id, name: c.name ?? "", designation: c.designation ?? "", phone: c.phone ?? "", email: c.email ?? "",
      }));
    },
  });

const blank = (s?: string) => (s && s.trim() ? s.trim() : null);

const upload = async (prefix: string, file?: File) => {
  if (!file) return null;
  const path = `${prefix}_${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from("vendor-documents").upload(path, file);
  if (error) throw new Error(`Could not upload the ${prefix.toUpperCase()} certificate: ${error.message}`);
  return path;
};

const friendly = (error: any) => {
  const m: string = error?.message ?? String(error);
  if (m.includes("vendors_gst_number_key")) return "Another vendor already has this GST number";
  if (m.includes("vendors_gst_format")) return "The GST number is not in the right format (e.g. 07AAICA4568Q1ZY)";
  if (m.includes("vendors_vendor_code_key")) return "That vendor code is already in use";
  return m;
};

// Replace the vendor's other contacts with exactly the list on screen.
const syncContacts = async (vendorId: string, contacts: VendorContact[]) => {
  const rows = contacts
    .map((c) => ({ id: c.id, name: blank(c.name), designation: blank(c.designation), phone: blank(c.phone), email: blank(c.email) }))
    .filter((c) => c.name || c.phone || c.email);
  const keep = rows.filter((r) => r.id).map((r) => r.id as string);
  const db = supabase as any;

  let del = db.from("vendor_contacts").delete().eq("vendor_id", vendorId);
  if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
  const { error: delErr } = await del;
  if (delErr) throw delErr;

  for (const r of rows.filter((r) => r.id)) {
    const { id, ...fields } = r;
    const { error } = await db.from("vendor_contacts").update(fields).eq("id", id);
    if (error) throw error;
  }
  const fresh = rows.filter((r) => !r.id).map(({ id: _id, ...f }) => ({ ...f, vendor_id: vendorId }));
  if (fresh.length) {
    const { error } = await db.from("vendor_contacts").insert(fresh);
    if (error) throw error;
  }
};

const toRow = async (v: VendorInput) => {
  const row: Record<string, any> = {
    name: v.name.trim(),
    contact_person_name: blank(v.contact_person_name),
    contact_designation: blank(v.contact_designation),
    email: blank(v.email),
    contact_number: blank(v.contact_number),
    address: blank(v.address),
    gst_number: blank(v.gst_number)?.toUpperCase() ?? null,
    supplies: blank(v.supplies),
    location: blank(v.location),
  };
  if (v.finance) {
    row.bank_account_number = blank(v.finance.bank_account_number);
    row.ifsc_code = blank(v.finance.ifsc_code)?.toUpperCase() ?? null;
    row.bank_name = blank(v.finance.bank_name);
    row.account_holder_name = blank(v.finance.account_holder_name);
    row.pan_number = blank(v.finance.pan_number)?.toUpperCase() ?? null;
  }
  const gst = await upload("gst", v.gst_certificate);
  const msme = await upload("msme", v.msme_certificate);
  if (gst) row.gst_certificate_url = gst;
  if (msme) row.msme_certificate_url = msme;
  return row;
};

export const useVendors = () => {
  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select(VENDOR_SAFE_COLS)
        .eq("is_active", true)
        .order("vendor_code");
      if (error) throw error;
      return (data || []) as any[];
    },
    retry: 3,
    retryDelay: 1000,
  });

  const refresh = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ["vendors"] });
    if (id) {
      queryClient.invalidateQueries({ queryKey: ["vendor-contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["vendor-finance", id] });
    }
  };

  const addVendor = useMutation({
    mutationFn: async (v: VendorInput) => {
      // vendor_code is left blank on purpose: the database issues the next V-number.
      const row = { ...(await toRow(v)), vendor_code: "" };
      const { data, error } = await (supabase as any).from("vendors").insert(row).select("id, vendor_code, approval_status").single();
      if (error) throw new Error(friendly(error));
      if (v.contacts) await syncContacts(data.id, v.contacts);
      return data;
    },
    onSuccess: (data) => {
      refresh(data.id);
      toast.success(
        (data as any).approval_status === "PENDING"
          ? `Vendor ${data.vendor_code} sent to Management for approval`
          : `Vendor ${data.vendor_code} added`,
      );
    },
    onError: (e: any) => toast.error(e.message || "Could not add the vendor"),
  });

  const updateVendor = useMutation({
    mutationFn: async (v: VendorInput & { id: string }) => {
      const { error } = await supabase.from("vendors").update((await toRow(v)) as any).eq("id", v.id);
      if (error) throw new Error(friendly(error));
      if (v.contacts) await syncContacts(v.id, v.contacts);
      return v.id;
    },
    onSuccess: (id) => {
      refresh(id);
      toast.success("Vendor updated");
    },
    onError: (e: any) => toast.error(e.message || "Could not update the vendor"),
  });

  const deleteVendor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendors").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Vendor removed");
    },
    onError: (e: any) => toast.error(`Could not remove the vendor: ${e.message || e}`),
  });

  return { vendors, isLoading, addVendor, updateVendor, deleteVendor };
};
