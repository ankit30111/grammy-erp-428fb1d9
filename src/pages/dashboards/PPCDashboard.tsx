
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { KPICard } from "@/components/Dashboard/KPICard";
import { ChartWidget } from "@/components/Dashboard/ChartWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";
import { Calendar, Package, AlertTriangle, FileText, TrendingUp, ShoppingCart, Clipboard } from "lucide-react";
import { usePPCDashboardData } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useState, useEffect } from "react";
import { calculateMaterialShortages, MaterialShortage } from "@/utils/materialShortageCalculator";
import { useToast } from "@/hooks/use-toast";

const PPCDashboard = () => {
  const { data, isLoading } = usePPCDashboardData();
  const navigate = useNavigate();
  const { data: projections } = useProjections();
  const { data: schedules } = useProductionSchedules();
  const { data: purchaseOrders } = usePurchaseOrders();
  const [shortages, setShortages] = useState<MaterialShortage[]>([]);
  const { toast } = useToast();

  const calculateShortages = async () => {
    if (!projections?.length) return;
    
    try {
      const calculatedShortages = await calculateMaterialShortages(projections.map(p => p.id));
      setShortages(calculatedShortages);
    } catch (error) {
      console.error('Error calculating shortages:', error);
    }
  };

  useEffect(() => {
    if (projections?.length) {
      calculateShortages();
    }
  }, [projections]);

  const unscheduledProjections = projections?.filter(projection => {
    return projection.quantity > (projection.scheduled_quantity || 0);
  }) || [];

  const chartData = [
    { name: 'Scheduled', value: schedules?.length || 0 },
    { name: 'Unscheduled', value: unscheduledProjections.length }
  ];

  const COLORS = ['#0088FE', '#FFBB28'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">PPC Dashboard</h1>
            <p className="text-muted-foreground">Production Planning & Control Overview</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <KPICard
            title="Total Projections"
            value={projections?.length || 0}
            icon={Calendar}
            isLoading={isLoading}
            subtitle="Customer projections received"
          />
          <KPICard
            title="Unscheduled Projections"
            value={unscheduledProjections.length}
            icon={TrendingUp}
            isLoading={isLoading}
            subtitle="Requiring production scheduling"
            className={unscheduledProjections.length > 0 ? "border-orange-200" : ""}
          />
          <KPICard
            title="Material Shortages"
            value={shortages.length}
            icon={AlertTriangle}
            isLoading={isLoading}
            subtitle="Requiring purchase orders"
            className={shortages.length > 0 ? "border-red-200" : ""}
          />
          <KPICard
            title="Scheduled Production"
            value={schedules?.length || 0}
            icon={Package}
            isLoading={isLoading}
            subtitle="Ready for production"
          />
        </div>

        {/* Charts and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartWidget title="Projection vs Scheduled Production" description="Overview of production planning status">
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
              <CardTitle>Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => navigate('/planning')} 
                className="w-full justify-start"
                variant="outline"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Production Planning
              </Button>
              <Button 
                onClick={() => navigate('/purchase')} 
                className="w-full justify-start"
                variant="outline"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Purchase Orders
              </Button>
              <Button 
                onClick={() => navigate('/grn')} 
                className="w-full justify-start"
                variant="outline"
              >
                <Clipboard className="h-4 w-4 mr-2" />
                Goods Receipt Notes
              </Button>
              <Button 
                onClick={() => navigate('/purchase-discrepancies')} 
                className="w-full justify-start"
                variant="outline"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Purchase Discrepancies
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Material Shortages Summary */}
        {shortages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Material Shortage Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {shortages.slice(0, 5).map(shortage => (
                  <div key={shortage.raw_material_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{shortage.material_code} - {shortage.material_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Required: {shortage.shortage_quantity + shortage.available_quantity} | 
                        Available: {shortage.available_quantity} | 
                        Short: {shortage.shortage_quantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-600">
                        -{shortage.shortage_quantity}
                      </div>
                    </div>
                  </div>
                ))}
                {shortages.length > 5 && (
                  <div className="text-center pt-2">
                    <Button 
                      onClick={() => navigate('/purchase')} 
                      variant="outline" 
                      size="sm"
                    >
                      View All {shortages.length} Shortages
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PPCDashboard;
