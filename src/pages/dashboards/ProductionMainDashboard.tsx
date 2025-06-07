
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { KPICard } from "@/components/Dashboard/KPICard";
import { ChartWidget } from "@/components/Dashboard/ChartWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Factory, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { useProductionDashboardData } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";

const ProductionMainDashboard = () => {
  const { data, isLoading } = useProductionDashboardData();
  const navigate = useNavigate();

  const lineData = [
    { line: 'Line 1', output: 450, target: 500 },
    { line: 'Line 2', output: 380, target: 400 },
    { line: 'Sub Assembly 1', output: 220, target: 250 },
    { line: 'Sub Assembly 2', output: 180, target: 200 }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Production Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/production')} variant="outline">
              <Factory className="h-4 w-4 mr-2" />
              Production Management
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <KPICard
            title="Scheduled Vouchers"
            value={data?.scheduledVouchers || 0}
            icon={Clock}
            isLoading={isLoading}
            subtitle="Pending production"
          />
          <KPICard
            title="In Progress"
            value={data?.inProgressVouchers || 0}
            icon={Factory}
            isLoading={isLoading}
            subtitle="Currently producing"
            className="border-blue-200"
          />
          <KPICard
            title="Completed Vouchers"
            value={data?.completedVouchers || 0}
            icon={TrendingUp}
            isLoading={isLoading}
            subtitle="Finished production"
          />
          <KPICard
            title="Today's Production"
            value={data?.todayProduction || 0}
            icon={Factory}
            isLoading={isLoading}
            subtitle="Units produced today"
          />
        </div>

        {/* Charts and Real-time Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartWidget title="Line-wise Output vs Target" description="Daily production output by production line">
            <BarChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="line" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="output" fill="#0088FE" name="Output" />
              <Bar dataKey="target" fill="#FFBB28" name="Target" />
            </BarChart>
          </ChartWidget>

          <Card>
            <CardHeader>
              <CardTitle>Real-time Production Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lineData.map((line, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{line.line}</p>
                      <p className="text-sm text-muted-foreground">
                        {line.output}/{line.target} units
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      line.output >= line.target ? 'bg-green-100 text-green-800' : 
                      line.output >= line.target * 0.8 ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {Math.round((line.output / line.target) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Production Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button 
                onClick={() => navigate('/production')} 
                className="justify-start"
                variant="outline"
              >
                <Factory className="h-4 w-4 mr-2" />
                Production Lines
              </Button>
              <Button 
                onClick={() => navigate('/planning')} 
                className="justify-start"
                variant="outline"
              >
                <Clock className="h-4 w-4 mr-2" />
                Production Queue
              </Button>
              <Button 
                onClick={() => navigate('/quality/pqc')} 
                className="justify-start"
                variant="outline"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Quality Feedback
              </Button>
              <Button 
                onClick={() => navigate('/store')} 
                className="justify-start"
                variant="outline"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Material Requests
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ProductionMainDashboard;
