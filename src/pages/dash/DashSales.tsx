import { useState } from "react";
import { DashLayout } from "@/components/Layout/DashLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useDashSalesOrders, useDashSalesMutations, useDashPayments, useDashPaymentMutations } from "@/hooks/useDashSales";
import { useDashCustomers } from "@/hooks/useDashCustomers";
import { useDashProducts } from "@/hooks/useDashProducts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";

export default function DashSales() {
  const { data: orders, isLoading } = useDashSalesOrders();
  const { data: customers } = useDashCustomers();
  const { data: products } = useDashProducts();
  const { data: payments } = useDashPayments();
  const { createSalesOrder, updateSalesOrder } = useDashSalesMutations();
  const { addPayment } = useDashPaymentMutations();
  const [search, setSearch] = useState("");
  const [soDialogOpen, setSoDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [soForm, setSoForm] = useState({ customer_id: "", notes: "", scheme_details: "" });
  const [items, setItems] = useState<{ product_id: string; quantity: number; unit_price: number; discount_percent: number }[]>([]);
  const [payForm, setPayForm] = useState({ customer_id: "", sales_order_id: "", amount: 0, payment_mode: "", reference_number: "", notes: "" });

  const filtered = orders?.filter((o: any) => {
    const matchSearch = o.so_number?.toLowerCase().includes(search.toLowerCase()) || o.dash_customers?.customer_name?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const addItem = () => setItems([...items, { product_id: "", quantity: 1, unit_price: 0, discount_percent: 0 }]);

  const handleProductSelect = (idx: number, productId: string) => {
    const product = products?.find((p: any) => p.id === productId);
    const customer = customers?.find((c: any) => c.id === soForm.customer_id);
    let price = product?.mrp || 0;
    if (customer?.customer_type === "Distributor") price = product?.distributor_price || price;
    else if (customer?.customer_type === "Dealer") price = product?.dealer_price || price;
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], product_id: productId, unit_price: Number(price) };
    setItems(newItems);
  };

  const handleCreateSO = () => {
    const totalAmount = items.reduce((s, i) => s + i.quantity * i.unit_price * (1 - i.discount_percent / 100), 0);
    const discountAmount = items.reduce((s, i) => s + i.quantity * i.unit_price * (i.discount_percent / 100), 0);
    createSalesOrder.mutate({
      order: { ...soForm, total_amount: totalAmount + discountAmount, discount_amount: discountAmount, net_amount: totalAmount },
      items: items.map((i) => ({ ...i, line_total: i.quantity * i.unit_price * (1 - i.discount_percent / 100) })),
    }, { onSuccess: () => { setSoDialogOpen(false); setItems([]); } });
  };

  const handleRecordPayment = () => {
    addPayment.mutate(payForm, { onSuccess: () => setPayDialogOpen(false) });
  };

  return (
    <DashLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight">Sales Management</h1><p className="text-muted-foreground">Orders, payments & dispatch tracking</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPayDialogOpen(true)}>Record Payment</Button>
            <Button onClick={() => { setSoForm({ customer_id: "", notes: "", scheme_details: "" }); setItems([]); setSoDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />New Sales Order</Button>
          </div>
        </div>

        <Tabs defaultValue="orders">
          <TabsList><TabsTrigger value="orders">Sales Orders</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger></TabsList>

          <TabsContent value="orders">
            <Card><CardContent className="pt-6">
              <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
              <Table>
                <TableHeader><TableRow><TableHead>SO#</TableHead><TableHead>Customer</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Discount</TableHead><TableHead>Net</TableHead><TableHead>Payment</TableHead><TableHead>Dispatch</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered?.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono">{o.so_number}</TableCell>
                      <TableCell>{o.dash_customers?.customer_name}</TableCell>
                      <TableCell><Badge variant="outline">{o.dash_customers?.customer_type}</Badge></TableCell>
                      <TableCell>₹{Number(o.total_amount).toLocaleString()}</TableCell>
                      <TableCell>₹{Number(o.discount_amount).toLocaleString()}</TableCell>
                      <TableCell className="font-bold">₹{Number(o.net_amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={o.payment_status === "Paid" ? "default" : "secondary"}>{o.payment_status}</Badge></TableCell>
                      <TableCell><Badge variant={o.dispatch_status === "Delivered" ? "default" : "outline"}>{o.dispatch_status}</Badge></TableCell>
                      <TableCell>{format(new Date(o.order_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <Select onValueChange={(v) => updateSalesOrder.mutate({ id: o.id, dispatch_status: v })}>
                          <SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="Dispatch" /></SelectTrigger>
                          <SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Dispatched">Dispatched</SelectItem><SelectItem value="Delivered">Delivered</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filtered || filtered.length === 0) && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">{isLoading ? "Loading..." : "No sales orders"}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card><CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>SO#</TableHead><TableHead>Amount</TableHead><TableHead>Mode</TableHead><TableHead>Reference</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments?.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.payment_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{p.dash_customers?.customer_name}</TableCell>
                      <TableCell className="font-mono">{p.dash_sales_orders?.so_number || "—"}</TableCell>
                      <TableCell className="font-bold">₹{Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell>{p.payment_mode || "—"}</TableCell>
                      <TableCell>{p.reference_number || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(!payments || payments.length === 0) && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payments recorded</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        {/* Create SO Dialog */}
        <Dialog open={soDialogOpen} onOpenChange={setSoDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Sales Order</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Customer *</Label>
                <Select value={soForm.customer_id} onValueChange={(v) => setSoForm({ ...soForm, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{customers?.filter((c: any) => c.is_active).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.customer_name} ({c.customer_type})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Line Items</Label><Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add Item</Button></div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 items-end">
                    <Select value={item.product_id} onValueChange={(v) => handleProductSelect(idx, v)}>
                      <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                      <SelectContent>{products?.filter((p: any) => p.status === "Active").map((p: any) => <SelectItem key={p.id} value={p.id}>{p.model_number}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => { const n = [...items]; n[idx].quantity = Number(e.target.value); setItems(n); }} />
                    <Input type="number" placeholder="Price" value={item.unit_price} onChange={(e) => { const n = [...items]; n[idx].unit_price = Number(e.target.value); setItems(n); }} />
                    <Input type="number" placeholder="Disc %" value={item.discount_percent} onChange={(e) => { const n = [...items]; n[idx].discount_percent = Number(e.target.value); setItems(n); }} />
                  </div>
                ))}
              </div>
              <div className="space-y-2"><Label>Scheme / Offer</Label><Input value={soForm.scheme_details} onChange={(e) => setSoForm({ ...soForm, scheme_details: e.target.value })} /></div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={soForm.notes} onChange={(e) => setSoForm({ ...soForm, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setSoDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateSO} disabled={!soForm.customer_id || items.length === 0}>Create Order</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Customer *</Label>
                <Select value={payForm.customer_id} onValueChange={(v) => setPayForm({ ...payForm, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{customers?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Amount (₹) *</Label><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Payment Mode</Label><Input value={payForm.payment_mode} onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value })} placeholder="NEFT / UPI / Cheque" /></div>
              <div className="space-y-2"><Label>Reference Number</Label><Input value={payForm.reference_number} onChange={(e) => setPayForm({ ...payForm, reference_number: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRecordPayment} disabled={!payForm.customer_id || payForm.amount <= 0}>Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashLayout>
  );
}
