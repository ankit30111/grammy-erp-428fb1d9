import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, Settings, AlertTriangle, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProductionCompletion } from "@/hooks/useProductionCompletion";

const ProductionDashboard = () => {
  // Use the production completion hook
  useProductionCompletion();

  // Fetch active production orders
  const { data: activeProduction = [] } = useQuery({
    queryKey: ["active-production-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          production_schedules!inner(
            production_line,
            projections!inner(
              customers!inner(name),
              products!inner(name, product_code)
            )
          )
        `)
        .in("status", ["IN_PROGRESS", "PENDING"])
        .order("scheduled_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Production Lines</CardTitle>
      </CardHeader>
      <CardContent>
        {activeProduction.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active production orders found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher No.</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Production Line</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeProduction.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-medium">
                    {order.voucher_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {order.production_schedules?.projections?.products?.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.production_schedules?.projections?.products?.product_code}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.production_schedules?.projections?.customers?.name}
                  </TableCell>
                  <TableCell>
                    {new Date(order.production_schedules?.scheduled_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {order.production_schedules?.production_line || "N/A"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {order.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Start
                      </Button>
                      <Button variant="outline" size="sm">
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductionDashboard;
