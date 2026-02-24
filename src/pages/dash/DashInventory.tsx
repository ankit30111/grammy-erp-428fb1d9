import { useState } from "react";
import { DashLayout } from "@/components/Layout/DashLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashInventory, useDashInventoryMovements } from "@/hooks/useDashInventory";
import { Search, AlertTriangle, Package } from "lucide-react";
import { format } from "date-fns";

export default function DashInventory() {
  const { data: inventory, isLoading } = useDashInventory();
  const { data: movements } = useDashInventoryMovements();
  const [search, setSearch] = useState("");

  const filtered = inventory?.filter((i: any) => {
    const name = i.dash_products?.product_name?.toLowerCase() || "";
    const model = i.dash_products?.model_number?.toLowerCase() || "";
    return name.includes(search.toLowerCase()) || model.includes(search.toLowerCase()) || (i.batch_number || "").toLowerCase().includes(search.toLowerCase());
  });

  const totalValue = inventory?.reduce((s: number, i: any) => s + (i.total_stock * Number(i.unit_cost)), 0) || 0;
  const lowStockItems = inventory?.filter((i: any) => (i.total_stock - i.reserved_stock - i.damaged_stock) <= i.low_stock_threshold) || [];

  return (
    <DashLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DASH Inventory</h1>
          <p className="text-muted-foreground">Warehouse stock management — isolated from other verticals</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 flex items-center gap-3"><Package className="h-8 w-8 text-primary" /><div><p className="text-sm text-muted-foreground">Total SKUs in Stock</p><p className="text-2xl font-bold">{inventory?.length || 0}</p></div></CardContent></Card>
          <Card><CardContent className="pt-6 flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-destructive" /><div><p className="text-sm text-muted-foreground">Low Stock Alerts</p><p className="text-2xl font-bold">{lowStockItems.length}</p></div></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Inventory Valuation</p><p className="text-2xl font-bold">₹{totalValue.toLocaleString()}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="stock">
          <TabsList><TabsTrigger value="stock">Stock View</TabsTrigger><TabsTrigger value="movements">Movements</TabsTrigger><TabsTrigger value="alerts">Low Stock Alerts</TabsTrigger></TabsList>

          <TabsContent value="stock">
            <Card>
              <CardContent className="pt-6">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by product, model, or batch..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead><TableHead>Model</TableHead><TableHead>Batch</TableHead>
                      <TableHead>Total</TableHead><TableHead>Reserved</TableHead><TableHead>Damaged</TableHead>
                      <TableHead>In Transit</TableHead><TableHead>Available</TableHead><TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered?.map((i: any) => {
                      const available = i.total_stock - i.reserved_stock - i.damaged_stock;
                      const isLow = available <= i.low_stock_threshold;
                      return (
                        <TableRow key={i.id} className={isLow ? "bg-destructive/5" : ""}>
                          <TableCell>{i.dash_products?.product_name}</TableCell>
                          <TableCell className="font-mono">{i.dash_products?.model_number}</TableCell>
                          <TableCell>{i.batch_number || "—"}</TableCell>
                          <TableCell>{i.total_stock}</TableCell>
                          <TableCell>{i.reserved_stock}</TableCell>
                          <TableCell>{i.damaged_stock}</TableCell>
                          <TableCell>{i.in_transit_stock}</TableCell>
                          <TableCell className="font-bold">{available}{isLow && <AlertTriangle className="inline h-3 w-3 ml-1 text-destructive" />}</TableCell>
                          <TableCell>₹{(i.total_stock * Number(i.unit_cost)).toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                    {(!filtered || filtered.length === 0) && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{isLoading ? "Loading..." : "No inventory records"}</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Type</TableHead><TableHead>Qty</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {movements?.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>{format(new Date(m.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                        <TableCell>{m.dash_products?.product_name}</TableCell>
                        <TableCell>{m.batch_number || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{m.movement_type}</Badge></TableCell>
                        <TableCell className="font-bold">{m.quantity}</TableCell>
                        <TableCell className="text-muted-foreground">{m.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {(!movements || movements.length === 0) && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No movements recorded</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardContent className="pt-6">
                {lowStockItems.length === 0 ? <p className="text-center text-muted-foreground py-8">No low stock alerts 🎉</p> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Model</TableHead><TableHead>Available</TableHead><TableHead>Threshold</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {lowStockItems.map((i: any) => (
                        <TableRow key={i.id} className="bg-destructive/5">
                          <TableCell>{i.dash_products?.product_name}</TableCell>
                          <TableCell className="font-mono">{i.dash_products?.model_number}</TableCell>
                          <TableCell className="font-bold text-destructive">{i.total_stock - i.reserved_stock - i.damaged_stock}</TableCell>
                          <TableCell>{i.low_stock_threshold}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashLayout>
  );
}
