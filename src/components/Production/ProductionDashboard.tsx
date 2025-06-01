
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Factory, Clock, CheckCircle, AlertCircle, Zap, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ProductionDashboard = () => {
  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-lines-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name),
          production_schedules!inner(
            projections!inner(
              customers!inner(name)
            )
          )
        `)
        .eq("status", "IN_PROGRESS");
      
      return data || [];
    },
  });

  // Mock production lines data with performance metrics
  const productionLines = [
    {
      id: 1,
      name: "Line 1 - Main Assembly",
      status: "RUNNING",
      currentOrder: productionOrders[0] || null,
      efficiency: 87,
      target: 150,
      produced: 95,
      operator: "John Smith",
      shift: "Day Shift",
      lastUpdate: "2 mins ago"
    },
    {
      id: 2,
      name: "Line 2 - Sub Assembly", 
      status: "RUNNING",
      currentOrder: productionOrders[1] || null,
      efficiency: 92,
      target: 120,
      produced: 110,
      operator: "Sarah Johnson",
      shift: "Day Shift",
      lastUpdate: "1 min ago"
    },
    {
      id: 3,
      name: "Line 3 - Testing",
      status: "SETUP",
      currentOrder: null,
      efficiency: 0,
      target: 80,
      produced: 0,
      operator: "Mike Wilson",
      shift: "Day Shift",
      lastUpdate: "15 mins ago"
    },
    {
      id: 4,
      name: "Line 4 - Packaging",
      status: "MAINTENANCE",
      currentOrder: null,
      efficiency: 0,
      target: 200,
      produced: 0,
      operator: "Lisa Brown",
      shift: "Day Shift",
      lastUpdate: "30 mins ago"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'default';
      case 'IDLE': return 'secondary';
      case 'MAINTENANCE': return 'destructive';
      case 'SETUP': return 'warning';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING': return <CheckCircle className="h-4 w-4" />;
      case 'IDLE': return <Clock className="h-4 w-4" />;
      case 'MAINTENANCE': return <AlertCircle className="h-4 w-4" />;
      case 'SETUP': return <Factory className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return "text-green-600";
    if (efficiency >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Production Lines Overview</h2>
        <div className="text-sm text-muted-foreground">
          Live Status • Updated every 30 seconds
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {productionLines.map((line) => (
          <Card key={line.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{line.name}</CardTitle>
                <Badge variant={getStatusColor(line.status) as any} className="gap-1">
                  {getStatusIcon(line.status)}
                  {line.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Production */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Factory className="h-4 w-4" />
                  Current Production
                </h4>
                {line.currentOrder ? (
                  <div className="bg-muted p-3 rounded-lg space-y-1">
                    <div className="font-medium">{line.currentOrder.products?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Voucher: {line.currentOrder.voucher_number}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Customer: {line.currentOrder.production_schedules?.projections?.customers?.name}
                    </div>
                    <div className="text-sm">
                      Quantity: {line.currentOrder.quantity} units
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">No active production</div>
                )}
              </div>

              {/* Performance Metrics */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Performance
                </h4>
                
                {/* Production Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Daily Progress</span>
                    <span>{line.produced}/{line.target} units</span>
                  </div>
                  <Progress 
                    value={(line.produced / line.target) * 100} 
                    className="h-2"
                  />
                </div>

                {/* Efficiency */}
                <div className="flex justify-between items-center">
                  <span className="text-sm">Efficiency</span>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span className={`font-medium ${getEfficiencyColor(line.efficiency)}`}>
                      {line.efficiency}%
                    </span>
                  </div>
                </div>

                {/* Operator Info */}
                <div className="flex justify-between text-sm">
                  <span>Operator</span>
                  <span className="font-medium">{line.operator}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Shift</span>
                  <span>{line.shift}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Last Update</span>
                  <span className="text-muted-foreground">{line.lastUpdate}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {productionLines.filter(line => line.status === 'RUNNING').length}
            </div>
            <div className="text-sm text-muted-foreground">Lines Running</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {productionLines.reduce((sum, line) => sum + line.produced, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Units Produced Today</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {Math.round(productionLines.reduce((sum, line) => sum + line.efficiency, 0) / productionLines.length)}%
            </div>
            <div className="text-sm text-muted-foreground">Average Efficiency</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {productionLines.reduce((sum, line) => sum + line.target, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Daily Target</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductionDashboard;
