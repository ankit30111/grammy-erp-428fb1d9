import { DashLayout } from "@/components/Layout/DashLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashFactoryOrders } from "@/hooks/useDashFactoryOrders";
import { useDashSalesOrders } from "@/hooks/useDashSales";
import { useDashServiceTickets } from "@/hooks/useDashService";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Factory, Truck, Warehouse, ShoppingCart, Package, Users, Wrench } from "lucide-react";

export default function DashOrderTracking() {
  const { data: factoryOrders } = useDashFactoryOrders();
  const { data: salesOrders } = useDashSalesOrders();
  const { data: tickets } = useDashServiceTickets();

  const stages = [
    { icon: Factory, label: "Factory Order", count: factoryOrders?.filter((o: any) => ["Draft", "Ordered", "In Production"].includes(o.status)).length || 0, color: "text-blue-600" },
    { icon: Truck, label: "In Transit", count: factoryOrders?.filter((o: any) => o.status === "Dispatched").length || 0, color: "text-orange-600" },
    { icon: Warehouse, label: "Warehouse", count: factoryOrders?.filter((o: any) => ["Received", "QC Pending", "QC Done"].includes(o.status)).length || 0, color: "text-green-600" },
    { icon: ShoppingCart, label: "Sales Orders", count: salesOrders?.filter((o: any) => o.dispatch_status === "Pending").length || 0, color: "text-purple-600" },
    { icon: Package, label: "Dispatched", count: salesOrders?.filter((o: any) => o.dispatch_status === "Dispatched").length || 0, color: "text-cyan-600" },
    { icon: Users, label: "Delivered", count: salesOrders?.filter((o: any) => o.dispatch_status === "Delivered").length || 0, color: "text-emerald-600" },
    { icon: Wrench, label: "Service", count: tickets?.filter((t: any) => t.repair_status !== "Closed").length || 0, color: "text-red-600" },
  ];

  return (
    <DashLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Lifecycle Tracking</h1>
          <p className="text-muted-foreground">Factory → Warehouse → Sales → Dealer → Service</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Pipeline Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between flex-wrap gap-4">
              {stages.map((stage, idx) => (
                <div key={stage.label} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1 min-w-[80px]">
                    <div className={`p-3 rounded-full bg-muted ${stage.color}`}><stage.icon className="h-6 w-6" /></div>
                    <span className="text-xs text-muted-foreground text-center">{stage.label}</span>
                    <span className="text-xl font-bold">{stage.count}</span>
                  </div>
                  {idx < stages.length - 1 && <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Recent Factory Orders</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {factoryOrders?.slice(0, 5).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-mono font-medium">{o.fo_number}</p>
                      <p className="text-sm text-muted-foreground">{o.dash_products?.product_name} × {o.quantity_ordered}</p>
                    </div>
                    <Badge variant="outline">{o.status}</Badge>
                  </div>
                ))}
                {(!factoryOrders || factoryOrders.length === 0) && <p className="text-center text-muted-foreground py-4">No factory orders</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Sales Orders</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {salesOrders?.slice(0, 5).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-mono font-medium">{o.so_number}</p>
                      <p className="text-sm text-muted-foreground">{o.dash_customers?.customer_name} — ₹{Number(o.net_amount).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline">{o.payment_status}</Badge>
                      <Badge variant="secondary">{o.dispatch_status}</Badge>
                    </div>
                  </div>
                ))}
                {(!salesOrders || salesOrders.length === 0) && <p className="text-center text-muted-foreground py-4">No sales orders</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashLayout>
  );
}
