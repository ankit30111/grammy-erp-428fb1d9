
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Factory, Clock, CheckCircle, AlertCircle, Zap, Target, Edit } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import HourlyProductionDialog from "./HourlyProductionDialog";

const ProductionDashboard = () => {
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [showHourlyDialog, setShowHourlyDialog] = useState(false);

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-lines-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name),
          production_schedules!inner(
            production_line,
            projections!inner(
              customers!inner(name)
            )
          )
        `)
        .eq("status", "IN_PROGRESS");
      
      return data || [];
    },
  });

  // Define all 4 production lines
  const allProductionLines = [
    "Line 1",
    "Line 2", 
    "Sub Assembly 1",
    "Sub Assembly 2"
  ];

  // Create production lines data with current orders
  const productionLines = allProductionLines.map((lineName) => {
    const currentOrder = productionOrders.find(
      order => order.production_schedules?.production_line === lineName
    );

    return {
      id: lineName.replace(/\s+/g, '_').toLowerCase(),
      name: lineName,
      status: currentOrder ? "RUNNING" : "IDLE" as "IDLE" | "RUNNING" | "MAINTENANCE" | "SETUP",
      currentOrder: currentOrder || null,
      efficiency: currentOrder ? 85 : 0, // Default efficiency when running
      target: currentOrder ? currentOrder.quantity : 0,
      produced: 0, // This would come from hourly production data
      operator: currentOrder ? "Assigned" : "",
      lastUpdate: currentOrder ? new Date().toLocaleTimeString() : ""
    };
  });

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

  const handleLineClick = (lineName: string) => {
    setSelectedLine(lineName);
    setShowHourlyDialog(true);
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
          <Card key={line.id} className="relative cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{line.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusColor(line.status) as any} className="gap-1">
                    {getStatusIcon(line.status)}
                    {line.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLineClick(line.name)}
                    className="gap-1"
                  >
                    <Edit className="h-3 w-3" />
                    Hourly Data
                  </Button>
                </div>
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
                    value={line.target > 0 ? (line.produced / line.target) * 100 : 0} 
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
                  <span className="font-medium">{line.operator || "Not assigned"}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Last Update</span>
                  <span className="text-muted-foreground">{line.lastUpdate || "No updates"}</span>
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
              {productionLines.length > 0 ? Math.round(productionLines.reduce((sum, line) => sum + line.efficiency, 0) / productionLines.length) : 0}%
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

      {/* Hourly Production Dialog */}
      <HourlyProductionDialog
        open={showHourlyDialog}
        onOpenChange={setShowHourlyDialog}
        productionLine={selectedLine}
      />
    </div>
  );
};

export default ProductionDashboard;
