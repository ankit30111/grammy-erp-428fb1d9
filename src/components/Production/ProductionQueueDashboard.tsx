
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Factory, Calendar, AlertCircle } from "lucide-react";
import { usePlantId } from "@/hooks/usePlantId";
import { useProductionLinesList } from "@/hooks/useProductionLinesList";
import { fetchProductionOrderLines, groupLinesByOrder } from "@/hooks/useProductionOrderLines";

const ProductionQueueDashboard = () => {
  const plantId = usePlantId();
  const { rows: PRODUCTION_LINES } = useProductionLinesList();

  // Fetch active-plant production orders with line assignments
  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-queue", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          parts!part_id (name)
        `)
        .eq("plant_id", plantId!)
        .in("status", ["IN_PRODUCTION", "PLANNED"])
        .order("planned_date");

      if (error) throw error;

      const orders = data || [];
      // Line assignments now live in production_order_lines.
      const assignmentRows = await fetchProductionOrderLines(orders.map((o) => o.id));
      const assignmentsByOrder = groupLinesByOrder(assignmentRows);

      return orders.map((order) => ({
        ...order,
        lineIds: (assignmentsByOrder[order.id] ?? []).map((r) => r.production_line_id),
      }));
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Group orders by production line
  const getLineOrders = (lineId: string) => {
    return productionOrders.filter(order => order.lineIds.includes(lineId));
  };

  // Calculate estimated end time (simplified - 1 hour per unit)
  const calculateEstimatedEnd = (startDate: string, quantity: number) => {
    const start = new Date(startDate);
    const estimatedHours = quantity * 0.5; // 30 minutes per unit
    const end = new Date(start.getTime() + estimatedHours * 60 * 60 * 1000);
    return end;
  };

  const renderLineCard = (line: { id: string; name: string }) => {
    const lineOrders = getLineOrders(line.id);
    const ongoing = lineOrders.find(order => order.status === "IN_PRODUCTION");
    const scheduled = lineOrders.filter(order => order.status === "PLANNED");
    const isIdle = lineOrders.length === 0;

    return (
      <Card key={line.id} className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {line.name}
            </div>
            <Badge variant={isIdle ? "secondary" : ongoing ? "default" : "outline"}>
              {isIdle ? "IDLE" : ongoing ? "BUSY" : "SCHEDULED"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ongoing && (
            <div className="p-3 bg-success-wash border border-success/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-success" />
                <span className="font-medium text-success">Ongoing Production</span>
              </div>
              <div className="space-y-1">
                <p className="font-medium">{ongoing.voucher_number}</p>
                <p className="text-sm text-muted-foreground">{ongoing.parts?.name}</p>
                <p className="text-sm">Quantity: {ongoing.quantity}</p>
                <p className="text-sm">
                  Started: {new Date(ongoing.planned_date).toLocaleDateString()}
                </p>
                <p className="text-sm">
                  Est. End: {calculateEstimatedEnd(ongoing.planned_date, ongoing.quantity).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {scheduled.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium text-primary">Production Queue ({scheduled.length})</span>
              </div>
              {scheduled.map((order, index) => (
                <div key={order.id} className="p-3 bg-accent border border-primary/30 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{order.voucher_number}</p>
                      <p className="text-sm text-muted-foreground">{order.parts?.name}</p>
                      <p className="text-sm">Quantity: {order.quantity}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{index + 1} in queue
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Scheduled: {new Date(order.planned_date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {isIdle && (
            <div className="p-4 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Line is idle</p>
              <p className="text-sm">No production scheduled</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Production Line Status & Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRODUCTION_LINES.map((line) => renderLineCard(line))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">
                {productionOrders.filter(o => o.status === "IN_PRODUCTION").length}
              </p>
              <p className="text-sm text-muted-foreground">Ongoing Productions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {productionOrders.filter(o => o.status === "PLANNED").length}
              </p>
              <p className="text-sm text-muted-foreground">Scheduled Productions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-muted-foreground">
                {PRODUCTION_LINES.filter(line => getLineOrders(line.id).length === 0).length}
              </p>
              <p className="text-sm text-muted-foreground">Idle Lines</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">
                {productionOrders.reduce((sum, order) => sum + order.quantity, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Units in Queue</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductionQueueDashboard;
