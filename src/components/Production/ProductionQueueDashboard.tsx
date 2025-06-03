
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Factory, Calendar, AlertCircle } from "lucide-react";

const PRODUCTION_LINES = [
  "Line 1",
  "Line 2", 
  "Sub Assembly 1",
  "Sub Assembly 2"
];

const ProductionQueueDashboard = () => {
  // Fetch all production orders with line assignments
  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!product_id (name)
        `)
        .in("status", ["IN_PROGRESS", "SCHEDULED"])
        .order("scheduled_date");

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Group orders by production line
  const getLineOrders = (lineName: string) => {
    return productionOrders.filter(order => {
      const lines = order.production_lines || {};
      return Object.values(lines).includes(lineName);
    });
  };

  // Calculate estimated end time (simplified - 1 hour per unit)
  const calculateEstimatedEnd = (startDate: string, quantity: number) => {
    const start = new Date(startDate);
    const estimatedHours = quantity * 0.5; // 30 minutes per unit
    const end = new Date(start.getTime() + estimatedHours * 60 * 60 * 1000);
    return end;
  };

  const renderLineCard = (lineName: string) => {
    const lineOrders = getLineOrders(lineName);
    const ongoing = lineOrders.find(order => order.status === "IN_PROGRESS");
    const scheduled = lineOrders.filter(order => order.status === "SCHEDULED");
    const isIdle = lineOrders.length === 0;

    return (
      <Card key={lineName} className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              {lineName}
            </div>
            <Badge variant={isIdle ? "secondary" : ongoing ? "default" : "outline"}>
              {isIdle ? "IDLE" : ongoing ? "BUSY" : "SCHEDULED"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ongoing && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-900">Ongoing Production</span>
              </div>
              <div className="space-y-1">
                <p className="font-medium">{ongoing.voucher_number}</p>
                <p className="text-sm text-muted-foreground">{ongoing.products?.name}</p>
                <p className="text-sm">Quantity: {ongoing.quantity}</p>
                <p className="text-sm">
                  Started: {new Date(ongoing.scheduled_date).toLocaleDateString()}
                </p>
                <p className="text-sm">
                  Est. End: {calculateEstimatedEnd(ongoing.scheduled_date, ongoing.quantity).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {scheduled.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Production Queue ({scheduled.length})</span>
              </div>
              {scheduled.map((order, index) => (
                <div key={order.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{order.voucher_number}</p>
                      <p className="text-sm text-muted-foreground">{order.products?.name}</p>
                      <p className="text-sm">Quantity: {order.quantity}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{index + 1} in queue
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Scheduled: {new Date(order.scheduled_date).toLocaleDateString()}
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
            <Factory className="h-5 w-5" />
            Production Line Status & Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRODUCTION_LINES.map(renderLineCard)}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {productionOrders.filter(o => o.status === "IN_PROGRESS").length}
              </p>
              <p className="text-sm text-muted-foreground">Ongoing Productions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {productionOrders.filter(o => o.status === "SCHEDULED").length}
              </p>
              <p className="text-sm text-muted-foreground">Scheduled Productions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">
                {PRODUCTION_LINES.filter(line => getLineOrders(line).length === 0).length}
              </p>
              <p className="text-sm text-muted-foreground">Idle Lines</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
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
