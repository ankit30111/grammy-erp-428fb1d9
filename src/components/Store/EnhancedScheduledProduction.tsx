
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Package, CheckCircle, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ProductionOrder {
  id: string;
  voucher_number: string;
  quantity: number;
  scheduled_date: string;
  status: string;
  kit_status: string;
  production_schedule_id: string;
  product_id: string;
  production_schedules: {
    projections: {
      customers: {
        name: string;
      } | null;
      products: {
        name: string;
        product_code: string;
      } | null;
    } | null;
  } | null;
}

const EnhancedScheduledProduction = () => {
  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ["production-orders-store"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          id,
          voucher_number,
          quantity,
          scheduled_date,
          status,
          kit_status,
          production_schedule_id,
          product_id,
          production_schedules!inner(
            projections!inner(
              customers!inner(name),
              products!inner(name, product_code)
            )
          )
        `)
        .order('scheduled_date', { ascending: true });

      if (error) {
        console.error('Error fetching production orders:', error);
        throw error;
      }

      return data as ProductionOrder[];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getKitStatusBadge = (kitStatus: string) => {
    switch (kitStatus) {
      case 'NOT_PREPARED':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Not Prepared</Badge>;
      case 'PREPARING':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Preparing</Badge>;
      case 'PREPARED':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Prepared</Badge>;
      case 'SENT':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Sent</Badge>;
      default:
        return <Badge variant="outline">{kitStatus}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Production Voucher Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Loading production orders...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Kit Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productionOrders.length > 0 ? (
                productionOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">
                      {order.voucher_number}
                    </TableCell>
                    <TableCell>
                      {order.production_schedules?.projections?.customers?.name || 'Unknown Customer'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {order.production_schedules?.projections?.products?.name || 'Unknown Product'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.production_schedules?.projections?.products?.product_code}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {order.quantity}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.scheduled_date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell>
                      {getKitStatusBadge(order.kit_status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {order.kit_status === 'NOT_PREPARED' && (
                          <Button size="sm" variant="outline">
                            Prepare Kit
                          </Button>
                        )}
                        {order.kit_status === 'PREPARED' && (
                          <Button size="sm" variant="outline">
                            Send to Production
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          View Details
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No production orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedScheduledProduction;
