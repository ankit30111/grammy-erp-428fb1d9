
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Factory, Clock, Users, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ProductionLineDetailView from "./ProductionLineDetailView";
import { useProductionLinesList } from "@/hooks/useProductionLinesList";
import { fetchProductionOrderLines, groupLinesByOrder } from "@/hooks/useProductionOrderLines";

const ProductionLinesOverview = () => {
  const [selectedLine, setSelectedLine] = useState<{ id: string; name: string } | null>(null);
  const { withType: productionLines } = useProductionLinesList();

  // Fetch production orders that have line assignments
  const { data: lineData = [] } = useQuery({
    queryKey: ["production-lines-overview"],
    queryFn: async () => {
      console.log("🔍 Fetching production line data...");
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          parts!inner(name)
        `)
        .in("status", ["IN_PROGRESS", "SCHEDULED"])
        .order("planned_date", { ascending: true });

      if (error) {
        console.error("❌ Error fetching production line data:", error);
        throw error;
      }

      const orders = data || [];
      // Line assignments now live in production_order_lines — a voucher may run on several.
      const assignmentRows = await fetchProductionOrderLines(orders.map((o) => o.id));
      const assignmentsByOrder = groupLinesByOrder(assignmentRows);

      console.log("📊 Production line data:", orders);
      return orders
        .map((order) => ({
          ...order,
          lineIds: (assignmentsByOrder[order.id] ?? []).map((r) => r.production_line_id),
        }))
        .filter((order) => order.lineIds.length > 0);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getLineStatus = (lineId: string, lineName: string) => {
    console.log(`🔍 Getting status for line: ${lineName}`);

    const lineOrders = lineData.filter(order => order.lineIds.includes(lineId));

    console.log(`📋 Line ${lineName} orders:`, lineOrders);
    
    const ongoingProduction = lineOrders.find(order => order.status === "IN_PROGRESS");
    const scheduledCount = lineOrders.filter(order => order.status === "SCHEDULED").length;

    if (ongoingProduction) {
      return {
        status: "RUNNING",
        currentVoucher: ongoingProduction.voucher_number,
        currentProduct: ongoingProduction.parts?.name,
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
        lineId={selectedLine.id}
        lineName={selectedLine.name}
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
          const lineStatus = getLineStatus(line.id, line.name);

          return (
            <Card
              key={line.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedLine({ id: line.id, name: line.name })}
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
