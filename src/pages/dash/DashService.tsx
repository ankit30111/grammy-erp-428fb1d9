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
import { useDashServiceTickets, useDashServiceMutations } from "@/hooks/useDashService";
import { useDashProducts } from "@/hooks/useDashProducts";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";

const repairStatuses = ["Open", "Assigned", "In Progress", "Awaiting Parts", "Repaired", "Replaced", "Closed"];

export default function DashService() {
  const { data: tickets, isLoading } = useDashServiceTickets();
  const { data: products } = useDashProducts();
  const { createTicket, updateTicket } = useDashServiceMutations();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", serial_number: "", customer_name: "", customer_phone: "", warranty_valid: false, issue_description: "", assigned_engineer: "" });

  const filtered = tickets?.filter((t: any) => {
    const matchSearch = t.ticket_number?.toLowerCase().includes(search.toLowerCase()) || t.customer_name?.toLowerCase().includes(search.toLowerCase()) || (t.serial_number || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || t.repair_status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleCreate = () => {
    createTicket.mutate(form, { onSuccess: () => setDialogOpen(false) });
  };

  const statusColor = (s: string) => {
    if (s === "Closed" || s === "Repaired") return "default";
    if (s === "Open") return "destructive";
    return "secondary";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight">Service & After-Sales</h1><p className="text-muted-foreground">Warranty, repairs & service tracking</p></div>
          <Button onClick={() => { setForm({ product_id: "", serial_number: "", customer_name: "", customer_phone: "", warranty_valid: false, issue_description: "", assigned_engineer: "" }); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />New Ticket</Button>
        </div>

        <Card><CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by ticket, customer, serial..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
            <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{repairStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Ticket#</TableHead><TableHead>Product</TableHead><TableHead>Serial</TableHead><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Warranty</TableHead><TableHead>Status</TableHead><TableHead>Engineer</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered?.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono">{t.ticket_number}</TableCell>
                  <TableCell>{t.dash_products?.product_name}</TableCell>
                  <TableCell>{t.serial_number || "—"}</TableCell>
                  <TableCell>{t.customer_name}</TableCell>
                  <TableCell>{t.customer_phone || "—"}</TableCell>
                  <TableCell>{t.warranty_valid ? <Badge variant="default">Valid</Badge> : <Badge variant="secondary">Expired</Badge>}</TableCell>
                  <TableCell><Badge variant={statusColor(t.repair_status) as any}>{t.repair_status}</Badge></TableCell>
                  <TableCell>{t.assigned_engineer || "—"}</TableCell>
                  <TableCell>{format(new Date(t.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Select onValueChange={(v) => updateTicket.mutate({ id: t.id, repair_status: v, ...(v === "Closed" ? { closed_at: new Date().toISOString() } : {}) })}>
                      <SelectTrigger className="w-[130px] h-8"><SelectValue placeholder="Update" /></SelectTrigger>
                      <SelectContent>{repairStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {(!filtered || filtered.length === 0) && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">{isLoading ? "Loading..." : "No service tickets"}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Service Ticket</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Product *</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.model_number} — {p.product_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Serial Number</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
                <div className="space-y-2"><Label>Warranty Valid</Label>
                  <Select value={form.warranty_valid ? "yes" : "no"} onValueChange={(v) => setForm({ ...form, warranty_valid: v === "yes" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Customer Name *</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Issue Description *</Label><Textarea value={form.issue_description} onChange={(e) => setForm({ ...form, issue_description: e.target.value })} /></div>
              <div className="space-y-2"><Label>Assigned Engineer</Label><Input value={form.assigned_engineer} onChange={(e) => setForm({ ...form, assigned_engineer: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.product_id || !form.customer_name || !form.issue_description}>Create Ticket</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
