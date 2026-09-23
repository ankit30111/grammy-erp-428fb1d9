import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useVendors, useVendorFinance, useVendorContacts, type VendorContact,
} from "@/hooks/useVendors";

interface VendorFormProps {
  onSuccess?: () => void;
  editingVendor?: any;
  onCancel?: () => void;
}

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY = {
  name: "", contact_person_name: "", contact_designation: "", email: "", contact_number: "",
  address: "", gst_number: "", supplies: "", location: "",
};
const EMPTY_FINANCE = { bank_account_number: "", ifsc_code: "", bank_name: "", account_holder_name: "", pan_number: "" };
const EMPTY_CONTACT: VendorContact = { name: "", designation: "", phone: "", email: "" };

export const VendorForm = ({ onSuccess, editingVendor, onCancel }: VendorFormProps) => {
  const { isAdmin } = useAuth();
  const { addVendor, updateVendor } = useVendors();
  const editing = !!editingVendor;

  const { data: finance, isSuccess: financeLoaded } = useVendorFinance(editingVendor?.id, editing && isAdmin);
  const { data: savedContacts, isSuccess: contactsLoaded } = useVendorContacts(editingVendor?.id);

  const [form, setForm] = useState(EMPTY);
  const [fin, setFin] = useState(EMPTY_FINANCE);
  const [contacts, setContacts] = useState<VendorContact[]>([]);
  const [certs, setCerts] = useState<{ gst?: File; msme?: File }>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!editingVendor) return;
    setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, editingVendor[k] ?? ""])) as typeof EMPTY);
  }, [editingVendor]);

  useEffect(() => {
    if (finance) setFin(Object.fromEntries(Object.keys(EMPTY_FINANCE).map((k) => [k, (finance as any)[k] ?? ""])) as typeof EMPTY_FINANCE);
  }, [finance]);

  useEffect(() => {
    if (savedContacts) setContacts(savedContacts);
  }, [savedContacts]);

  // Bank fields are shown to admins only, and only sent once the saved values
  // have loaded - otherwise saving would overwrite them with blanks.
  const canEditFinance = isAdmin && (!editing || financeLoaded);
  // Same for contacts: never replace the list before it has been read.
  const canEditContacts = !editing || contactsLoaded;

  const set = (k: keyof typeof EMPTY, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(({ [k]: _, ...rest }) => rest);
  };
  const setContact = (i: number, k: keyof VendorContact, v: string) =>
    setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, [k]: v } : c)));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Vendor name is required";
    const gst = form.gst_number.trim().toUpperCase();
    if (gst && !GST_RE.test(gst)) e.gst_number = "GST number is not in the right format (e.g. 07AAICA4568Q1ZY)";
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) e.email = "Email is not valid";
    contacts.forEach((c, i) => {
      if (c.email.trim() && !EMAIL_RE.test(c.email.trim())) e[`c${i}`] = `Contact ${i + 1}: email is not valid`;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saving = addVendor.isPending || updateVendor.isPending;

  const submit = async () => {
    if (!validate()) return;
    const input = {
      ...form,
      finance: canEditFinance ? fin : undefined,
      contacts: canEditContacts ? contacts : undefined,
      gst_certificate: certs.gst,
      msme_certificate: certs.msme,
    };
    try {
      if (editing) await updateVendor.mutateAsync({ ...input, id: editingVendor.id });
      else {
        await addVendor.mutateAsync(input);
        setForm(EMPTY); setFin(EMPTY_FINANCE); setContacts([]); setCerts({});
      }
      onSuccess?.();
    } catch {
      /* the mutation has already shown the reason */
    }
  };

  const field = (k: keyof typeof EMPTY, label: string, props: Record<string, any> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={form[k]} onChange={(e) => set(k, e.target.value)}
             className={errors[k] ? "border-destructive" : ""} {...props} />
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <div className="grid gap-5 py-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field("name", "Vendor Name *")}
        {editing && (
          <div className="space-y-1.5">
            <Label>Vendor Code</Label>
            <Input value={editingVendor.vendor_code} disabled className="font-mono" />
          </div>
        )}
        {field("gst_number", "GST Number", { placeholder: "07AAICA4568Q1ZY", className: `font-mono ${errors.gst_number ? "border-destructive" : ""}` })}
        {field("supplies", "Supplies", { placeholder: "e.g. Packing Box" })}
        {field("location", "Area / City", { placeholder: "e.g. Naraina, New Delhi" })}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Main contact</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("contact_person_name", "Name")}
          {field("contact_designation", "Designation")}
          {field("contact_number", "Phone")}
          {field("email", "Email (quality claims go here)", { type: "email" })}
        </div>
      </div>

      {canEditContacts && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other contacts</h4>
          {contacts.map((c, i) => (
            <div key={c.id ?? `new-${i}`} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1.3fr_auto] gap-2 items-start">
              <Input placeholder="Name" value={c.name} onChange={(e) => setContact(i, "name", e.target.value)} />
              <Input placeholder="Designation" value={c.designation} onChange={(e) => setContact(i, "designation", e.target.value)} />
              <Input placeholder="Phone" value={c.phone} onChange={(e) => setContact(i, "phone", e.target.value)} />
              <Input placeholder="Email" value={c.email} onChange={(e) => setContact(i, "email", e.target.value)}
                     className={errors[`c${i}`] ? "border-destructive" : ""} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove contact"
                      onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </div>
          ))}
          {contacts.some((_, i) => errors[`c${i}`]) && (
            <p className="text-xs text-destructive">
              {contacts.map((_, i) => errors[`c${i}`]).filter(Boolean).join(" · ")}
            </p>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setContacts((cs) => [...cs, { ...EMPTY_CONTACT }])}>
            <Plus /> Add contact
          </Button>
        </div>
      )}

      {canEditFinance && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bank and PAN (admins only)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ["bank_name", "Bank"], ["account_holder_name", "Account holder"],
              ["bank_account_number", "Account number"], ["ifsc_code", "IFSC"], ["pan_number", "PAN"],
            ] as const).map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={k}>{label}</Label>
                <Input id={k} value={fin[k]} onChange={(e) => setFin((f) => ({ ...f, [k]: e.target.value }))}
                       className={k === "bank_account_number" || k === "ifsc_code" || k === "pan_number" ? "font-mono" : ""} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="gst_cert">GST certificate (PDF)</Label>
          <Input id="gst_cert" type="file" accept=".pdf" onChange={(e) => setCerts((c) => ({ ...c, gst: e.target.files?.[0] }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="msme_cert">MSME / Udyam certificate (PDF)</Label>
          <Input id="msme_cert" type="file" accept=".pdf" onChange={(e) => setCerts((c) => ({ ...c, msme: e.target.files?.[0] }))} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>}
        <Button type="button" onClick={submit} disabled={saving || !form.name.trim()}>
          {saving ? "Saving…" : editing ? "Save vendor" : "Add vendor"}
        </Button>
      </div>
    </div>
  );
};
