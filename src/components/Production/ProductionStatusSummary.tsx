
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Package, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProductionStatusSummaryProps {
  productionId: string;
  voucherNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

const ProductionStatusSummary = ({ 
  productionId, 
  voucherNumber, 
  isOpen, 
  onClose 
}: ProductionStatusSummaryProps) => {

  // Fetch production order details
  const { data: productionOrder } = useQuery({
    queryKey: ["production-status", productionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name)
        `)
        .eq("id", productionId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // Fetch hourly production data grouped by line assignments
  const { data: hourlyData = [] } = useQuery({
    queryKey: ["hourly-production-summary", productionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hourly_production")
        .select("*")
        .eq("production_order_id", productionId)
        .order("hour", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  if (!productionOrder) return null;

  const totalProduced = hourlyData.reduce((sum, entry) => sum + entry.production_units, 0);
  const targetQuantity = productionOrder.quantity;
  const completionPercentage = Math.round((totalProduced / targetQuantity) * 100);

  // Get line assignments from production_lines jsonb field
  const lineAssignments = productionOrder.production_lines || {};
  
  const assemblySections = [
    { key: 'sub_assembly', name: 'Sub Assembly', line: lineAssignments.sub_assembly },
    { key: 'main_assembly', name: 'Main Assembly', line: lineAssignments.main_assembly },
    { key: 'accessory', name: 'Accessories', line: lineAssignments.accessory }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Production Status Summary - {voucherNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Overall Production Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Target Quantity:</span>
                  <p className="text-2xl font-bold">{targetQuantity}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Produced:</span>
                  <p className="text-2xl font-bold text-green-600">{totalProduced}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Remaining:</span>
                  <p className="text-2xl font-bold text-orange-600">{targetQuantity - totalProduced}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{completionPercentage}%</span>
                </div>
                <Progress value={completionPercentage} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {/* Assembly Section Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assemblySections.map((section) => (
              <Card key={section.key}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{section.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Assigned Line:</span>
                    <Badge variant={section.line ? "default" : "secondary"}>
                      {section.line || "Not Assigned"}
                    </Badge>
                  </div>
                  
                  <div>
                    <span className="text-sm text-muted-foreground">Required Quantity:</span>
                    <p className="font-medium">{targetQuantity}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-muted-foreground">Progress:</span>
                    <p className="font-medium">{totalProduced} / {targetQuantity}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <Progress value={completionPercentage} className="h-2" />
                    <p className="text-xs text-muted-foreground">{completionPercentage}% Complete</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Hourly Production Timeline */}
          {hourlyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Hourly Production Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {hourlyData.map((entry, index) => {
                    const cumulativeProduction = hourlyData
                      .slice(0, index + 1)
                      .reduce((sum, e) => sum + e.production_units, 0);
                    
                    return (
                      <div key={entry.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">{entry.hour}</Badge>
                          <span className="text-sm">
                            <span className="font-medium">{entry.production_units}</span> units produced
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Cumulative: <span className="font-medium">{cumulativeProduction}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionStatusSummary;
