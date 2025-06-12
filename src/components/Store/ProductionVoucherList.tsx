
import { useState, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Eye, Package } from "lucide-react";

interface ProductionVoucherListProps {
  onSelectVoucher: (voucherId: string) => void;
}

const ProductionVoucherList = memo(({ onSelectVoucher }: ProductionVoucherListProps) => {
  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ["production-orders-list"],
    queryFn: async () => {
      console.log("🔍 Fetching production orders list...");
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          id,
          voucher_number,
          quantity,
          scheduled_date,
          status,
          kit_status,
          created_at,
          products!product_id (
            name
          ),
          production_schedules!production_schedule_id (
            projections!projection_id (
              customers!customer_id (name)
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50); // Limit for performance

      if (error) {
        console.error("❌ Error fetching production orders:", error);
        throw error;
      }

      console.log("📋 Production orders fetched:", data?.length || 0);
      return data || [];
    },
    refetchInterval: 30000, // Reduced frequency
    staleTime: 20000, // Cache for 20 seconds
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'default';
      case 'IN_PROGRESS':
        return 'secondary';
      case 'PENDING':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getKitStatusColor = (kitStatus: string) => {
    switch (kitStatus) {
      case 'PREPARED':
        return 'default';
      case 'PARTIAL':
        return 'secondary';
      case 'NOT_PREPARED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
          <p className="text-muted-foreground">Loading production vouchers...</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Production Vouchers ({productionOrders.length})
          <Badge variant="outline">Real-time Material Dispatch</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {productionOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
            <p>No production vouchers found</p>
            <p className="text-sm mt-1">Production vouchers will appear here when created</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kit Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">
                      {order.voucher_number}
                    </TableCell>
                    <TableCell>{order.products?.name}</TableCell>
                    <TableCell>
                      {order.production_schedules?.projections?.customers?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="font-medium">{order.quantity}</TableCell>
                    <TableCell>
                      {format(new Date(order.scheduled_date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(order.status) as any}>
                        {order.status?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getKitStatusColor(order.kit_status) as any}>
                        {order.kit_status?.replace('_', ' ') || 'Not Ready'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectVoucher(order.id)}
                        className="gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

ProductionVoucherList.displayName = "ProductionVoucherList";

export default ProductionVoucherList;
