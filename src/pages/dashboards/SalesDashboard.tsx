
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { KPICard } from "@/components/Dashboard/KPICard";
import { ChartWidget } from "@/components/Dashboard/ChartWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import { DollarSign, Package, AlertCircle, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const SalesDashboard = () => {
  const navigate = useNavigate();

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales-dashboard'],
    queryFn: async () => {
      const [dispatchData, complaintsData, ordersData] = await Promise.all([
        supabase.from('dispatch_orders').select('*'),
        supabase.from('customer_complaints').select('*'),
        supabase.from('spare_orders').select('*')
      ]);

      const thisMonth = new Date().getMonth();
      const monthlyOrders = ordersData.data?.filter(o => 
        new Date(o.created_at).getMonth() === thisMonth
      ).length || 0;

      const pendingDispatches = dispatchData.data?.filter(d => d.status === 'PENDING').length || 0;
      const openComplaints = complaintsData.data?.filter(c => c.status === 'Open').length || 0;

      return {
        monthlyOrders,
        pendingDispatches,
        openComplaints,
        totalDispatches: dispatchData.data?.length || 0
      };
    }
  });

  const monthlyData = [
    { month: 'Jan', orders: 45, dispatches: 42 },
    { month: 'Feb', orders: 52, dispatches: 48 },
    { month: 'Mar', orders: 48, dispatches: 50 },
    { month: 'Apr', orders: 61, dispatches: 58 },
    { month: 'May', orders: 55, dispatches: 52 },
    { month: 'Jun', orders: 67, dispatches: 65 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Sales Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/sales')} variant="outline">
              <DollarSign className="h-4 w-4 mr-2" />
              Sales Management
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <KPICard
            title="Monthly Orders"
            value={salesData?.monthlyOrders || 0}
            icon={Package}
            isLoading={isLoading}
            subtitle="Orders this month"
          />
          <KPICard
            title="Pending Dispatches"
            value={salesData?.pendingDispatches || 0}
            icon={Package}
            isLoading={isLoading}
            subtitle="Awaiting dispatch"
            className="border-yellow-200"
          />
          <KPICard
            title="Customer Complaints"
            value={salesData?.openComplaints || 0}
            icon={AlertCircle}
            isLoading={isLoading}
            subtitle="Open complaints"
            className="border-red-200"
          />
          <KPICard
            title="Fulfillment Rate"
            value={`${Math.round(((salesData?.totalDispatches || 0) / (salesData?.monthlyOrders || 1)) * 100)}%`}
            icon={TrendingUp}
            isLoading={isLoading}
            subtitle="Orders vs Dispatches"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartWidget title="Monthly Sales vs Dispatches" description="Orders received vs dispatches completed">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orders" fill="#0088FE" name="Orders" />
              <Bar dataKey="dispatches" fill="#00C49F" name="Dispatches" />
            </BarChart>
          </ChartWidget>

          <Card>
            <CardHeader>
              <CardTitle>Sales Operations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => navigate('/sales')} 
                className="w-full justify-start"
                variant="outline"
              >
                <Package className="h-4 w-4 mr-2" />
                Dispatch Management
              </Button>
              <Button 
                onClick={() => navigate('/spare-orders')} 
                className="w-full justify-start"
                variant="outline"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Spare Orders
              </Button>
              <Button 
                onClick={() => navigate('/customer-complaints')} 
                className="w-full justify-start"
                variant="outline"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Customer Complaints
              </Button>
              <Button 
                onClick={() => navigate('/finished-goods')} 
                className="w-full justify-start"
                variant="outline"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Finished Goods
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SalesDashboard;
