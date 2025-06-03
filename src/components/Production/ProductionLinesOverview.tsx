
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Factory, Clock, Users, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ProductionLineDetailView from "./ProductionLineDetailView";

const ProductionLinesOverview = () => {
  const [selectedLine, setSelectedLine] = useState<string | null>(null);

  const productionLines = [
    { id: "line-1", name: "Line 1", type: "Main Assembly" },
    { id: "line-2", name: "Line 2", type: "Main Assembly" },
    { id: "sub-assembly-1", name: "Sub Assembly 1", type: "Sub Assembly" },
    { id: "sub-assembly-2", name: "Sub Assembly 2", type: "Sub Assembly" }
  ];

  // Fetch production orders for each line using the correct relationship
  const { data: lineData = [] } = useQuery({
    queryKey: ["production-lines-overview"],
    queryFn: async () => {
      console.log("🔍 Fetching production line data...");
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name),
          production_schedules!production_schedule_id!inner(
            production_line,
            scheduled_date
          )
        `)
        .in("status", ["IN_PROGRESS", "SCHEDULED"])
        .order("scheduled_date", { ascending: true });
      
      if (error) {
        console.error("❌ Error fetching production line data:", error);
        throw error;
      }
      
      console.log("📊 Production line data:", data);
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getLineStatus = (lineName: string) => {
    console.log(`🔍 Getting status for line: ${lineName}`);
    
    const lineOrders = lineData.filter(order => {
      const hasLineMatch = order.production_schedules?.production_line === lineName;
      console.log(`Order ${order.voucher_number}: line=${order.production_schedules?.production_line}, matches=${hasLineMatch}`);
      return hasLineMatch;
    });

    console.log(`📋 Line ${lineName} orders:`, lineOrders);
    
    const ongoingProduction = lineOrders.find(order => order.status === "IN_PROGRESS");
    const scheduledCount = lineOrders.filter(order => order.status === "SCHEDULED").length;

    if (ongoingProduction) {
      return {
        status: "RUNNING",
        currentVoucher: ongoingProduction.voucher_number,
        currentProduct: ongoingProduction.products?.name,
        queueCount: scheduledCount
      };
    }

    return {
      status: scheduledCount > 0 ? "SCHEDULED" : "IDLE",
      currentVoucher: null,
      currentProduct: null,
      queueCount: scheduledCount
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'default';
      case 'SCHEDULED': return 'secondary';
      case 'IDLE': return 'outline';
      default: return 'secondary';
    }
  };

  if (selectedLine) {
    return (
      <ProductionLineDetailView 
        lineName={selectedLine} 
        onBack={() => setSelectedLine(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Production Lines Status</h2>
        <div className="text-sm text-muted-foreground">
          Real-time update: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {productionLines.map((line) => {
          const lineStatus = getLineStatus(line.name);
          
          return (
            <Card 
              key={line.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedLine(line.name)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Factory className="h-5 w-5" />
                    {line.name}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <div className="text-sm text-muted-foreground">{line.type}</div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={getStatusColor(lineStatus.status) as any}>
                    {lineStatus.status}
                  </Badge>
                </div>

                {lineStatus.currentVoucher && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">Current Production:</span>
                    </div>
                    <div className="pl-6 space-y-1">
                      <div className="text-sm">Voucher: {lineStatus.currentVoucher}</div>
                      <div className="text-sm text-muted-foreground">{lineStatus.currentProduct}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    <span>Queue:</span>
                  </div>
                  <Badge variant="outline">
                    {lineStatus.queueCount} vouchers
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProductionLinesOverview;
