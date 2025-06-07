
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { KPICard } from "@/components/Dashboard/KPICard";
import { ChartWidget } from "@/components/Dashboard/ChartWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";
import { Calendar, Package, AlertTriangle, FileText, TrendingUp } from "lucide-react";
import { usePPCDashboardData } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";

const PPCDashboard = () => {
  const { data, isLoading } = usePPCDashboardData();
  const navigate = useNavigate();

  const chartData = [
    { name: 'Scheduled', value: data?.scheduledProduction || 0 },
    { name: 'Pending', value: data?.pendingProjections || 0 }
  ];

  const COLORS = ['#0088FE', '#FFBB28'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">PPC Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/planning')} variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Daily Planning Report
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <KPICard
            title="Total Projections (This Month)"
            value={data?.totalProjections || 0}
            icon={Calendar}
            isLoading={isLoading}
            subtitle="Customer projections received"
          />
          <KPICard
            title="Pending vs Scheduled"
            value={`${data?.pendingProjections}/${data?.scheduledProduction}`}
            icon={TrendingUp}
            isLoading={isLoading}
            subtitle="Pending / Scheduled production"
          />
          <KPICard
            title="Material Shortages"
            value={data?.materialShortages || 0}
            icon={AlertTriangle}
            isLoading={isLoading}
            subtitle="Open shortages requiring PO"
            className="border-orange-200"
          />
          <KPICard
            title="Scheduled Production"
            value={data?.scheduledProduction || 0}
            icon={Package}
            isLoading={isLoading}
            subtitle="Ready for production"
          />
        </div>

        {/* Charts and Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartWidget title="Production Status Overview" description="Scheduled vs Pending Production">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ChartWidget>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => navigate('/projection')} 
                className="w-full justify-start"
                variant="outline"
              >
                <Calendar className="h-4 w-4 mr-2" />
                View Projection Status
              </Button>
              <Button 
                onClick={() => navigate('/purchase')} 
                className="w-full justify-start"
                variant="outline"
              >
                <Package className="h-4 w-4 mr-2" />
                Raise Purchase Orders
              </Button>
              <Button 
                onClick={() => navigate('/quality/iqc')} 
                className="w-full justify-start"
                variant="outline"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                View IQC Rejections
              </Button>
              <Button 
                onClick={() => navigate('/planning')} 
                className="w-full justify-start"
                variant="outline"
              >
                <FileText className="h-4 w-4 mr-2" />
                Material Shortages Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PPCDashboard;
