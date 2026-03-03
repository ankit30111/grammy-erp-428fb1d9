import { useState } from "react";
import { DashLayout } from "@/components/Layout/DashLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashCustomers, useDashCustomerMutations } from "@/hooks/useDashCustomers";
import { CustomerListView } from "@/components/Dash/CustomerListView";
import { CustomerBasicInfoTab } from "@/components/Dash/CustomerBasicInfoTab";
import { CustomerAddressTab } from "@/components/Dash/CustomerAddressTab";
import { CustomerDocumentsTab } from "@/components/Dash/CustomerDocumentsTab";
import { CustomerNotesTab } from "@/components/Dash/CustomerNotesTab";
import { ArrowLeft } from "lucide-react";

const emptyForm = (): Record<string, any> => ({
  customer_name: "",
  customer_type: "Dealer",
  gst_number: "",
  credit_limit: 0,
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  territory: "",
  assigned_sales_manager: "",
  owner_name: "",
  owner_phone: "",
  primary_address: "",
  godown_address: "",
  pincode: "",
  pan_number: "",
  msme_number: "",
  bank_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  salesman_name: "",
  notes: "",
  is_active: true,
});

export default function DashCustomers() {
  const { data: customers, isLoading } = useDashCustomers();
  const { addCustomer, updateCustomer } = useDashCustomerMutations();
  const [view, setView] = useState<"list" | "detail">("list");
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>(emptyForm());

  const handleChange = (updates: Record<string, any>) => setForm((prev) => ({ ...prev, ...updates }));

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setView("detail");
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      customer_name: c.customer_name || "",
      customer_type: c.customer_type || "Dealer",
      gst_number: c.gst_number || "",
      credit_limit: c.credit_limit || 0,
      contact_person: c.contact_person || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      city: c.city || "",
      state: c.state || "",
      territory: c.territory || "",
      assigned_sales_manager: c.assigned_sales_manager || "",
      owner_name: c.owner_name || "",
      owner_phone: c.owner_phone || "",
      primary_address: c.primary_address || "",
      godown_address: c.godown_address || "",
      pincode: c.pincode || "",
      pan_number: c.pan_number || "",
      msme_number: c.msme_number || "",
      bank_name: c.bank_name || "",
      bank_account_number: c.bank_account_number || "",
      bank_ifsc: c.bank_ifsc || "",
      salesman_name: c.salesman_name || "",
      notes: c.notes || "",
      is_active: c.is_active !== false,
      gst_certificate_url: c.gst_certificate_url || "",
      msme_certificate_url: c.msme_certificate_url || "",
      cancelled_cheque_url: c.cancelled_cheque_url || "",
    });
    setView("detail");
  };

  const handleSave = () => {
    const payload = { ...form };
    // Remove url fields that shouldn't be sent if empty
    if (!payload.gst_certificate_url) delete payload.gst_certificate_url;
    if (!payload.msme_certificate_url) delete payload.msme_certificate_url;
    if (!payload.cancelled_cheque_url) delete payload.cancelled_cheque_url;

    if (editing) {
      updateCustomer.mutate({ id: editing.id, ...payload }, { onSuccess: () => setView("list") });
    } else {
      addCustomer.mutate(payload, {
        onSuccess: (data: any) => {
          setEditing(data);
          setView("list");
        },
      });
    }
  };

  return (
    <DashLayout>
      {view === "list" ? (
        <CustomerListView
          customers={customers}
          isLoading={isLoading}
          onAdd={openAdd}
          onEdit={openEdit}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setView("list")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{editing ? "Edit Customer" : "Add Customer"}</h1>
                <p className="text-muted-foreground text-sm">
                  {editing ? editing.customer_name : "Fill in the details below"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setView("list")}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.customer_name || addCustomer.isPending || updateCustomer.isPending}>
                {editing ? "Update" : "Save"}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList>
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="documents">Documents & KYC</TabsTrigger>
              <TabsTrigger value="notes">Notes & History</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="mt-4">
              <CustomerBasicInfoTab form={form} onChange={handleChange} />
            </TabsContent>
            <TabsContent value="address" className="mt-4">
              <CustomerAddressTab form={form} onChange={handleChange} />
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <CustomerDocumentsTab form={form} onChange={handleChange} customerId={editing?.id} />
            </TabsContent>
            <TabsContent value="notes" className="mt-4">
              <CustomerNotesTab form={form} onChange={handleChange} customer={editing} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </DashLayout>
  );
}
