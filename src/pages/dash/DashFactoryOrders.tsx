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
import { useDashFactoryOrders, useDashFactoryOrderMutations } from "@/hooks/useDashFactoryOrders";
import { useDashProducts } from "@/hooks/useDashProducts";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";

const statuses = ["Draft", "Ordered", "In Production", "Dispatched", "Received", "QC Pending", "QC Done"];

export default function DashFactoryOrders() {
  const { data: orders, isLoading } = useDashFactoryOrders();
  const { data: products } = useDashProducts();
  const { addOrder, updateOrder } = useDashFactoryOrderMutations();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", quantity_ordered: 0, cost_per_unit: 0, expected_production_date: "", notes: "" });

  const filtered = orders?.filter((o: any) => {
    const matchSearch = o.fo_number?.toLowerCase().includes(search.toLowerCase()) || o.dash_products?.product_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleCreate = () => {
    addOrder.mutate({ ...form, total_cost: form.quantity_ordered * form.cost_per_unit }, { onSuccess: () => setDialogOpen(false) });
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    updateOrder.mutate({ id, status: newStatus });
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "Received": case "QC Done": return "default";
      case "Draft": return "secondary";
      default: return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Factory Orders</h1>
            <p className="text-muted-foreground">Manage factory purchase orders & GRN</p>
          </div>
          <Button onClick={() => { setForm({ product_id: "", quantity_ordered: 0, cost_per_unit: 0, expected_production_date: "", notes: "" }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Create Factory PO
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>FO Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Cost/Unit</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>QC</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">{o.fo_number}</TableCell>
                    <TableCell>{o.dash_products?.product_name}</TableCell>
                    <TableCell>{o.quantity_ordered}</TableCell>
                    <TableCell>₹{Number(o.cost_per_unit).toLocaleString()}</TableCell>
                    <TableCell>₹{Number(o.total_cost).toLocaleString()}</TableCell>
                    <TableCell>{o.batch_number || "—"}</TableCell>
                    <TableCell><Badge variant={statusColor(o.status) as any}>{o.status}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{o.qc_status}</Badge></TableCell>
                    <TableCell>{o.expected_production_date ? format(new Date(o.expected_production_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell>
                      <Select onValueChange={(v) => handleStatusChange(o.id, v)}>
                        <SelectTrigger className="w-[130px] h-8"><SelectValue placeholder="Update" /></SelectTrigger>
                        <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {(!filtered || filtered.length === 0) && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">{isLoading ? "Loading..." : "No factory orders"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Factory PO</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Product *</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products?.filter((p: any) => p.status === "Active").map((p: any) => <SelectItem key={p.id} value={p.id}>{p.model_number} — {p.product_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Quantity *</Label><Input type="number" value={form.quantity_ordered} onChange={(e) => setForm({ ...form, quantity_ordered: Number(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Cost/Unit (₹) *</Label><Input type="number" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: Number(e.target.value) })} /></div>
              </div>
              <div className="space-y-2"><Label>Total Cost</Label><Input readOnly value={`₹${(form.quantity_ordered * form.cost_per_unit).toLocaleString()}`} /></div>
              <div className="space-y-2"><Label>Expected Production Date</Label><Input type="date" value={form.expected_production_date} onChange={(e) => setForm({ ...form, expected_production_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.product_id || form.quantity_ordered <= 0}>Create Order</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
