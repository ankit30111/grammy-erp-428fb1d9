import { useState } from "react";
import { DashLayout } from "@/components/Layout/DashLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashProducts } from "@/hooks/useDashProducts";
import { useDashSalesOrders } from "@/hooks/useDashSales";
import { useDashInventory } from "@/hooks/useDashInventory";
import { useDashServiceTickets } from "@/hooks/useDashService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Package, ShoppingCart, Warehouse, Wrench, TrendingUp, AlertTriangle } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function DashDashboard() {
  const { data: products } = useDashProducts();
  const { data: salesOrders } = useDashSalesOrders();
  const { data: inventory } = useDashInventory();
  const { data: tickets } = useDashServiceTickets();

  const activeProducts = products?.filter((p: any) => p.status === "Active").length || 0;
  const totalSales = salesOrders?.reduce((s: number, o: any) => s + Number(o.net_amount || 0), 0) || 0;
  const totalStock = inventory?.reduce((s: number, i: any) => s + (i.total_stock - i.reserved_stock - i.damaged_stock), 0) || 0;
  const openTickets = tickets?.filter((t: any) => t.repair_status !== "Closed").length || 0;
  const lowStockItems = inventory?.filter((i: any) => (i.total_stock - i.reserved_stock - i.damaged_stock) <= i.low_stock_threshold).length || 0;

  const categoryData = products?.reduce((acc: any[], p: any) => {
    const existing = acc.find((a) => a.name === p.category);
    if (existing) existing.value++;
    else acc.push({ name: p.category, value: 1 });
    return acc;
  }, []) || [];

  const statusData = [
    { name: "Pending", value: salesOrders?.filter((o: any) => o.payment_status === "Pending").length || 0 },
    { name: "Partial", value: salesOrders?.filter((o: any) => o.payment_status === "Partial").length || 0 },
    { name: "Paid", value: salesOrders?.filter((o: any) => o.payment_status === "Paid").length || 0 },
  ];

  return (
    <DashLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DASH Brand Dashboard</h1>
          <p className="text-muted-foreground">Home Audio Products — Brand Management Overview</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Active SKUs</p>
                  <p className="text-2xl font-bold">{activeProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold">₹{totalSales.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Warehouse className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Available Stock</p>
                  <p className="text-2xl font-bold">{totalStock}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Wrench className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Open Tickets</p>
                  <p className="text-2xl font-bold">{openTickets}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold">{lowStockItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Product Categories</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {categoryData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Payment Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent Sales Orders</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">SO Number</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Payment</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Dispatch</th>
                  </tr>
                </thead>
                <tbody>
                  {salesOrders?.slice(0, 5).map((o: any) => (
                    <tr key={o.id} className="border-b">
                      <td className="p-2 font-mono">{o.so_number}</td>
                      <td className="p-2">{o.dash_customers?.customer_name}</td>
                      <td className="p-2">₹{Number(o.net_amount).toLocaleString()}</td>
                      <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs ${o.payment_status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{o.payment_status}</span></td>
                      <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs ${o.dispatch_status === 'Delivered' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{o.dispatch_status}</span></td>
                    </tr>
                  ))}
                  {(!salesOrders || salesOrders.length === 0) && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No sales orders yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashLayout>
  );
}
