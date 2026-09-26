
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Package, Eye } from "lucide-react";
import { format } from "date-fns";
import ProductionVoucherDetailView from "./ProductionVoucherDetailView";

const ScheduledProductions = () => {
  const [selectedProduction, setSelectedProduction] = useState<any>(null);

  // Fetch all production orders that are not completed
  const { data: productionOrders = [], isLoading, error } = useQuery({
    queryKey: ["scheduled-production-orders"],
    queryFn: async () => {
      console.log("🔍 Fetching all production orders...");
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          parts!part_id (
            id,
            name,
            part_code
          ),
          production_order_lines (
            production_lines (
              name
            )
          ),
          production_schedules!production_schedule_id (
            production_lines (
              name
            ),
            scheduled_date,
            projections!projection_id (
              customers!customer_id (
                name
              )
            )
          )
        `)
        .not("status", "eq", "COMPLETED")
        .order("planned_date", { ascending: true });

      if (error) {
        console.error("❌ Error fetching production orders:", error);
        throw error;
      }

      console.log("📋 All production orders found:", data);
      console.log("📊 Production orders count:", data?.length || 0);
      
      return data || [];
    },
    refetchInterval: 5000, // Real-time updates
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLANNED':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'IN_PRODUCTION':
        return <Badge variant="default">In Progress</Badge>;
      case 'KIT_PREPARED':
        return <Badge variant="outline">Kit Prepared</Badge>;
      case 'KIT_SENT':
        return <Badge variant="outline">Materials Sent</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline">Pending OQC</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // A voucher can run on several lines — show all of them.
  const getProductionLineDisplay = (production: any) => {
    const orderLines = production?.production_order_lines;
    if (!Array.isArray(orderLines)) return "Not Assigned";

    const lines = Array.from(
      new Set(orderLines.map((row: any) => row?.production_lines?.name).filter(Boolean))
    );

    return lines.length > 0 ? lines.join(', ') : "Not Assigned";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Loading scheduled productions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Productions - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            <p>Error loading production orders: {error.message}</p>
            <p className="text-sm mt-1">Please check the console for more details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Productions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productionOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No scheduled productions found</p>
              <p className="text-sm mt-1">Production orders will appear here when scheduled</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Product Code</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Production Line Assignments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionOrders.map((production) => (
                  <TableRow key={production.id}>
                    <TableCell className="font-medium">
                      {production.voucher_number}
                    </TableCell>
                    <TableCell>{production.parts?.name || 'N/A'}</TableCell>
                    <TableCell className="font-mono">
                      {production.parts?.part_code || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {production.production_schedules?.projections?.customers?.name || 'Stock build'}
                    </TableCell>
                    <TableCell>
                      {production.planned_date ? format(new Date(production.planned_date), "MMM dd, yyyy") : 'N/A'}
                    </TableCell>
                    <TableCell className="font-medium">{production.quantity}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="text-sm">
                        {getProductionLineDisplay(production)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(production.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedProduction(production)}
                          className="gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View Details
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

      {/* Enhanced Production Voucher Detail View */}
      {selectedProduction && (
        <ProductionVoucherDetailView
          production={selectedProduction}
          isOpen={!!selectedProduction}
          onClose={() => setSelectedProduction(null)}
        />
      )}
    </>
  );
};

export default ScheduledProductions;
