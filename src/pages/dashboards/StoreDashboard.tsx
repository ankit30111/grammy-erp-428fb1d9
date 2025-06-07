
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { KPICard } from "@/components/Dashboard/KPICard";
import { ChartWidget } from "@/components/Dashboard/ChartWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Package, FileCheck, TruckIcon, BookOpen, Settings } from "lucide-react";
import { useStoreDashboardData } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";

const StoreDashboard = () => {
  const { data, isLoading } = useStoreDashboardData();
  const navigate = useNavigate();

  const mockTrendData = [
    { day: 'Mon', incoming: 120, outgoing: 80 },
    { day: 'Tue', incoming: 150, outgoing: 100 },
    { day: 'Wed', incoming: 180, outgoing: 120 },
    { day: 'Thu', incoming: 200, outgoing: 140 },
    { day: 'Fri', incoming: 160, outgoing: 110 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Store Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/store')} variant="outline">
              <BookOpen className="h-4 w-4 mr-2" />
              Store Management
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KPICard
            title="Total Raw Materials Stock"
            value={data?.totalRawMaterials?.toLocaleString() || 0}
            icon={Package}
            isLoading={isLoading}
            subtitle="Units in main store"
          />
          <KPICard
            title="Pending GRN from IQC"
            value={data?.pendingGRN || 0}
            icon={FileCheck}
            isLoading={isLoading}
            subtitle="Awaiting IQC approval"
            className="border-yellow-200"
          />
          <KPICard
            title="Daily Dispatches to Production"
            value={data?.dailyDispatches || 0}
            icon={TruckIcon}
            isLoading={isLoading}
            subtitle="Materials sent today"
          />
        </div>

        {/* Charts and Features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartWidget title="Material Flow Tracking" description="Incoming vs Outgoing materials this week">
            <LineChart data={mockTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="incoming" stroke="#0088FE" name="Incoming" />
              <Line type="monotone" dataKey="outgoing" stroke="#FFBB28" name="Outgoing" />
            </LineChart>
          </ChartWidget>

          <Card>
            <CardHeader>
              <CardTitle>Store Operations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => navigate('/store')} 
                className="w-full justify-start"
                variant="outline"
              >
                <Package className="h-4 w-4 mr-2" />
                Inventory Management
              </Button>
              <Button 
                onClick={() => navigate('/grn')} 
                className="w-full justify-start"
                variant="outline"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                GRN Receiving
              </Button>
              <Button 
                onClick={() => navigate('/store')} 
                className="w-full justify-start"
                variant="outline"
              >
                <Settings className="h-4 w-4 mr-2" />
                Stock Adjustment
              </Button>
              <Button 
                onClick={() => navigate('/store')} 
                className="w-full justify-start"
                variant="outline"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Inventory Log Book
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StoreDashboard;
