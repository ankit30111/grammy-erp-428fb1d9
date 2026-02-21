import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashSpareParts, useDashSpareConsumption, useDashSpareMutations } from "@/hooks/useDashSpares";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";

export default function DashSpares() {
  const { data: spares, isLoading } = useDashSpareParts();
  const { data: consumption } = useDashSpareConsumption();
  const { addSpare, updateSpare } = useDashSpareMutations();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ spare_code: "", spare_name: "", description: "", cost_price: 0, selling_price: 0, stock_quantity: 0, low_stock_threshold: 5 });

  const filtered = spares?.filter((s: any) => s.spare_name.toLowerCase().includes(search.toLowerCase()) || s.spare_code.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditing(null); setForm({ spare_code: "", spare_name: "", description: "", cost_price: 0, selling_price: 0, stock_quantity: 0, low_stock_threshold: 5 }); setDialogOpen(true); };
  const openEdit = (s: any) => { setEditing(s); setForm({ spare_code: s.spare_code, spare_name: s.spare_name, description: s.description || "", cost_price: s.cost_price, selling_price: s.selling_price, stock_quantity: s.stock_quantity, low_stock_threshold: s.low_stock_threshold }); setDialogOpen(true); };

  const handleSubmit = () => {
    if (editing) updateSpare.mutate({ id: editing.id, ...form }, { onSuccess: () => setDialogOpen(false) });
    else addSpare.mutate(form, { onSuccess: () => setDialogOpen(false) });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight">Spare Parts</h1><p className="text-muted-foreground">Spare SKU master & consumption tracking</p></div>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Spare</Button>
        </div>

        <Tabs defaultValue="master">
          <TabsList><TabsTrigger value="master">Spare Master</TabsTrigger><TabsTrigger value="consumption">Consumption Log</TabsTrigger></TabsList>

          <TabsContent value="master">
            <Card><CardContent className="pt-6">
              <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search spares..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Cost</TableHead><TableHead>Selling</TableHead><TableHead>Stock</TableHead><TableHead>Threshold</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered?.map((s: any) => (
                    <TableRow key={s.id} className={s.stock_quantity <= s.low_stock_threshold ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono">{s.spare_code}</TableCell>
                      <TableCell>{s.spare_name}</TableCell>
                      <TableCell>₹{Number(s.cost_price).toLocaleString()}</TableCell>
                      <TableCell>₹{Number(s.selling_price).toLocaleString()}</TableCell>
                      <TableCell className="font-bold">{s.stock_quantity}</TableCell>
                      <TableCell>{s.low_stock_threshold}</TableCell>
                      <TableCell>{s.stock_quantity <= s.low_stock_threshold ? <Badge variant="destructive">Low</Badge> : <Badge variant="default">OK</Badge>}</TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</Button></TableCell>
                    </TableRow>
                  ))}
                  {(!filtered || filtered.length === 0) && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{isLoading ? "Loading..." : "No spare parts"}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="consumption">
            <Card><CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Spare</TableHead><TableHead>Code</TableHead><TableHead>Ticket#</TableHead><TableHead>Qty Used</TableHead><TableHead>By</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {consumption?.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>{c.dash_spare_parts?.spare_name}</TableCell>
                      <TableCell className="font-mono">{c.dash_spare_parts?.spare_code}</TableCell>
                      <TableCell>{c.dash_service_tickets?.ticket_number || "—"}</TableCell>
                      <TableCell className="font-bold">{c.quantity_used}</TableCell>
                      <TableCell>{c.consumed_by || "—"}</TableCell>
                      <TableCell>{c.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(!consumption || consumption.length === 0) && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No consumption records</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Spare Part" : "Add Spare Part"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Spare Code *</Label><Input value={form.spare_code} onChange={(e) => setForm({ ...form, spare_code: e.target.value })} disabled={!!editing} /></div>
                <div className="space-y-2"><Label>Name *</Label><Input value={form.spare_name} onChange={(e) => setForm({ ...form, spare_name: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Cost Price (₹)</Label><Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Selling Price (₹)</Label><Input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Stock Qty</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Low Stock Threshold</Label><Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} /></div>
              </div>
              <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!form.spare_code || !form.spare_name}>{editing ? "Update" : "Add"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
