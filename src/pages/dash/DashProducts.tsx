import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useDashProducts, useDashProductMutations } from "@/hooks/useDashProducts";
import { Plus, Search, Edit } from "lucide-react";

const categories = ["Party Speaker", "Tower Speaker", "Soundbar", "Multimedia Speaker", "Portable Speaker", "Home Theatre", "Subwoofer", "Other"];

export default function DashProducts() {
  const { data: products, isLoading } = useDashProducts();
  const { addProduct, updateProduct } = useDashProductMutations();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [form, setForm] = useState({
    product_name: "", model_number: "", category: "Other" as string,
    description: "", mrp: 0, dealer_price: 0, distributor_price: 0,
    barcode_ean: "", warranty_period_months: 12, status: "Active" as string,
  });

  const filtered = products?.filter((p: any) => {
    const matchSearch = p.product_name.toLowerCase().includes(search.toLowerCase()) || p.model_number.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || p.category === filterCategory;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const openAdd = () => {
    setEditingProduct(null);
    setForm({ product_name: "", model_number: "", category: "Other", description: "", mrp: 0, dealer_price: 0, distributor_price: 0, barcode_ean: "", warranty_period_months: 12, status: "Active" });
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingProduct(p);
    setForm({ product_name: p.product_name, model_number: p.model_number, category: p.category, description: p.description || "", mrp: p.mrp, dealer_price: p.dealer_price, distributor_price: p.distributor_price, barcode_ean: p.barcode_ean || "", warranty_period_months: p.warranty_period_months, status: p.status });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, ...form }, { onSuccess: () => setDialogOpen(false) });
    } else {
      addProduct.mutate(form, { onSuccess: () => setDialogOpen(false) });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Product Master</h1>
            <p className="text-muted-foreground">DASH SKU catalog management</p>
          </div>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or model..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Dealer</TableHead>
                  <TableHead>Distributor</TableHead>
                  <TableHead>Warranty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-medium">{p.model_number}</TableCell>
                    <TableCell>{p.product_name}</TableCell>
                    <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                    <TableCell>₹{Number(p.mrp).toLocaleString()}</TableCell>
                    <TableCell>₹{Number(p.dealer_price).toLocaleString()}</TableCell>
                    <TableCell>₹{Number(p.distributor_price).toLocaleString()}</TableCell>
                    <TableCell>{p.warranty_period_months}m</TableCell>
                    <TableCell><Badge variant={p.status === "Active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {(!filtered || filtered.length === 0) && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{isLoading ? "Loading..." : "No products found"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Product Name *</Label><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Model Number *</Label><Input value={form.model_number} onChange={(e) => setForm({ ...form, model_number: e.target.value })} disabled={!!editingProduct} /></div>
              <div className="space-y-2"><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>MRP (₹)</Label><Input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Dealer Price (₹)</Label><Input type="number" value={form.dealer_price} onChange={(e) => setForm({ ...form, dealer_price: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Distributor Price (₹)</Label><Input type="number" value={form.distributor_price} onChange={(e) => setForm({ ...form, distributor_price: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Barcode / EAN</Label><Input value={form.barcode_ean} onChange={(e) => setForm({ ...form, barcode_ean: e.target.value })} /></div>
              <div className="space-y-2"><Label>Warranty (months)</Label><Input type="number" value={form.warranty_period_months} onChange={(e) => setForm({ ...form, warranty_period_months: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Discontinued">Discontinued</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!form.product_name || !form.model_number}>{editingProduct ? "Update" : "Add"} Product</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
