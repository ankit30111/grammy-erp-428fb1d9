
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { KPICard } from "@/components/Dashboard/KPICard";
import { ChartWidget } from "@/components/Dashboard/ChartWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from "recharts";
import { Package, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FinishedGoods = () => {
  const { data: finishedGoodsData, isLoading } = useQuery({
    queryKey: ['finished-goods-dashboard'],
    queryFn: async () => {
      const [inventoryData, productionData, dispatchData] = await Promise.all([
        supabase.from('finished_goods_inventory').select(`
          *,
          products!inner(name, product_code)
        `),
        supabase.from('production_orders').select('*').eq('status', 'COMPLETED').gte('updated_at', new Date().toISOString().split('T')[0]),
        supabase.from('dispatch_orders').select('*').gte('created_at', new Date().toISOString().split('T')[0])
      ]);

      const totalStock = inventoryData.data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const todayProduction = productionData.data?.reduce((sum, order) => sum + order.quantity, 0) || 0;
      const todayDispatches = dispatchData.data?.length || 0;

      // Calculate inventory age
      const oldStock = inventoryData.data?.filter(item => {
        const daysDiff = Math.floor((new Date().getTime() - new Date(item.production_date || item.created_at).getTime()) / (1000 * 3600 * 24));
        return daysDiff > 30;
      }).length || 0;

      return {
        totalStock,
        todayProduction,
        todayDispatches,
        oldStock,
        inventory: inventoryData.data || []
      };
    }
  });

  const stockByProduct = finishedGoodsData?.inventory?.reduce((acc: any[], item) => {
    const existing = acc.find(p => p.product === item.products?.name);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      acc.push({
        product: item.products?.name || 'Unknown',
        quantity: item.quantity
      });
    }
    return acc;
  }, []) || [];

  const mockFlowData = [
    { day: 'Mon', inflow: 120, outflow: 80 },
    { day: 'Tue', inflow: 150, outflow: 100 },
    { day: 'Wed', inflow: 180, outflow: 120 },
    { day: 'Thu', inflow: 200, outflow: 140 },
    { day: 'Fri', inflow: 160, outflow: 110 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Finished Goods Dashboard</h1>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <KPICard
            title="Total Finished Goods Stock"
            value={finishedGoodsData?.totalStock?.toLocaleString() || 0}
            icon={Package}
            isLoading={isLoading}
            subtitle="Units in FG store"
          />
          <KPICard
            title="Daily Production Inflow"
            value={finishedGoodsData?.todayProduction || 0}
            icon={TrendingUp}
            isLoading={isLoading}
            subtitle="Units received today"
          />
          <KPICard
            title="Daily Outflow"
            value={finishedGoodsData?.todayDispatches || 0}
            icon={Package}
            isLoading={isLoading}
            subtitle="Dispatches today"
          />
          <KPICard
            title="Aging Stock"
            value={finishedGoodsData?.oldStock || 0}
            icon={AlertTriangle}
            isLoading={isLoading}
            subtitle="Items >30 days old"
            className="border-orange-200"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartWidget title="Product-wise Stock Levels" description="Current inventory by product">
            <BarChart data={stockByProduct.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="product" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="quantity" fill="#0088FE" />
            </BarChart>
          </ChartWidget>

          <ChartWidget title="Daily Inflow vs Outflow" description="Production inflow vs sales outflow">
            <LineChart data={mockFlowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="inflow" stroke="#0088FE" name="Inflow" />
              <Line type="monotone" dataKey="outflow" stroke="#FFBB28" name="Outflow" />
            </LineChart>
          </ChartWidget>
        </div>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle>Current Finished Goods Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {finishedGoodsData?.inventory?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Lot Number</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Production Date</TableHead>
                    <TableHead>Quality Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Age (Days)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finishedGoodsData.inventory.slice(0, 10).map((item) => {
                    const age = Math.floor((new Date().getTime() - new Date(item.production_date || item.created_at).getTime()) / (1000 * 3600 * 24));
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.products?.name}</TableCell>
                        <TableCell>{item.lot_number || 'N/A'}</TableCell>
                        <TableCell>{item.quantity.toLocaleString()}</TableCell>
                        <TableCell>{item.production_date ? new Date(item.production_date).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={
                            item.quality_status === 'APPROVED' ? 'default' :
                            item.quality_status === 'REJECTED' ? 'destructive' : 'secondary'
                          }>
                            {item.quality_status || 'PENDING'}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.location || 'FG Store'}</TableCell>
                        <TableCell>
                          <span className={age > 30 ? 'text-red-600 font-medium' : ''}>
                            {age} days
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No finished goods inventory found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FinishedGoods;
