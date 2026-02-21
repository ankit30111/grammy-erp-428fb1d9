import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useDashCustomers, useDashCustomerMutations } from "@/hooks/useDashCustomers";
import { Plus, Search, Edit } from "lucide-react";

const customerTypes = ["Distributor", "Dealer", "Retailer", "Institutional"];

export default function DashCustomers() {
  const { data: customers, isLoading } = useDashCustomers();
  const { addCustomer, updateCustomer } = useDashCustomerMutations();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ customer_name: "", customer_type: "Dealer" as string, gst_number: "", credit_limit: 0, contact_person: "", phone: "", email: "", address: "", city: "", state: "", territory: "", assigned_sales_manager: "" });

  const filtered = customers?.filter((c: any) => {
    const matchSearch = c.customer_name.toLowerCase().includes(search.toLowerCase()) || (c.gst_number || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || c.customer_type === filterType;
    return matchSearch && matchType;
  });

  const openAdd = () => { setEditing(null); setForm({ customer_name: "", customer_type: "Dealer", gst_number: "", credit_limit: 0, contact_person: "", phone: "", email: "", address: "", city: "", state: "", territory: "", assigned_sales_manager: "" }); setDialogOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ customer_name: c.customer_name, customer_type: c.customer_type, gst_number: c.gst_number || "", credit_limit: c.credit_limit, contact_person: c.contact_person || "", phone: c.phone || "", email: c.email || "", address: c.address || "", city: c.city || "", state: c.state || "", territory: c.territory || "", assigned_sales_manager: c.assigned_sales_manager || "" }); setDialogOpen(true); };

  const handleSubmit = () => {
    if (editing) updateCustomer.mutate({ id: editing.id, ...form }, { onSuccess: () => setDialogOpen(false) });
    else addCustomer.mutate(form, { onSuccess: () => setDialogOpen(false) });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight">Customer Network</h1><p className="text-muted-foreground">Dealers, distributors & retailers</p></div>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
        </div>

        <Card><CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
            <Select value={filterType} onValueChange={setFilterType}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{customerTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>GST</TableHead><TableHead>Territory</TableHead><TableHead>Credit Limit</TableHead><TableHead>Outstanding</TableHead><TableHead>Contact</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.customer_name}</TableCell>
                  <TableCell><Badge variant="outline">{c.customer_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{c.gst_number || "—"}</TableCell>
                  <TableCell>{c.territory || "—"}</TableCell>
                  <TableCell>₹{Number(c.credit_limit).toLocaleString()}</TableCell>
                  <TableCell className={Number(c.outstanding_balance) > 0 ? "text-destructive font-bold" : ""}>₹{Number(c.outstanding_balance).toLocaleString()}</TableCell>
                  <TableCell>{c.contact_person || "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {(!filtered || filtered.length === 0) && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{isLoading ? "Loading..." : "No customers"}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Customer Name *</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Type</Label><Select value={form.customer_type} onValueChange={(v) => setForm({ ...form, customer_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{customerTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>GST Number</Label><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></div>
              <div className="space-y-2"><Label>Credit Limit (₹)</Label><Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Territory</Label><Input value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} /></div>
              <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="space-y-2"><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
              <div className="col-span-2 space-y-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-2"><Label>Sales Manager</Label><Input value={form.assigned_sales_manager} onChange={(e) => setForm({ ...form, assigned_sales_manager: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!form.customer_name}>{editing ? "Update" : "Add"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
