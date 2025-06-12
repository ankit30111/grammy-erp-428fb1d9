
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Package, Settings, Eye } from "lucide-react";
import { format } from "date-fns";
import EnhancedBOMTable from "./EnhancedBOMTable";

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
          products!product_id (
            id,
            name,
            product_code
          ),
          production_schedules!production_schedule_id (
            production_line,
            scheduled_date,
            projections!projection_id (
              customers!customer_id (
                name
              )
            )
          )
        `)
        .not("status", "eq", "COMPLETED")
        .order("scheduled_date", { ascending: true });

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
      case 'SCHEDULED':
      case 'PENDING':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="default">In Progress</Badge>;
      case 'MATERIALS_SENT':
        return <Badge variant="outline">Materials Sent</Badge>;
      case 'PENDING_OQC':
        return <Badge variant="outline">Pending OQC</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getKitStatusBadge = (kitStatus: string) => {
    switch (kitStatus) {
      case 'NOT_PREPARED':
        return <Badge variant="destructive">Not Prepared</Badge>;
      case 'MATERIALS_SENT':
        return <Badge variant="default">Materials Sent</Badge>;
      case 'VERIFIED':
        return <Badge variant="default">Verified</Badge>;
      default:
        return <Badge variant="secondary">{kitStatus}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
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
          <div className="text-center py-8 text-red-600">
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
            Scheduled Productions ({productionOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productionOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
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
                  <TableHead>Production Line</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kit Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionOrders.map((production) => (
                  <TableRow key={production.id}>
                    <TableCell className="font-medium">
                      {production.voucher_number}
                    </TableCell>
                    <TableCell>{production.products?.name || 'N/A'}</TableCell>
                    <TableCell className="font-mono">
                      {production.products?.product_code || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {production.production_schedules?.projections?.customers?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {production.scheduled_date ? format(new Date(production.scheduled_date), "MMM dd, yyyy") : 'N/A'}
                    </TableCell>
                    <TableCell className="font-medium">{production.quantity}</TableCell>
                    <TableCell>
                      {production.production_schedules?.production_line || "Not Assigned"}
                    </TableCell>
                    <TableCell>{getStatusBadge(production.status)}</TableCell>
                    <TableCell>{getKitStatusBadge(production.kit_status)}</TableCell>
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

      {/* Enhanced Production Detail Dialog */}
      {selectedProduction && (
        <Dialog open={!!selectedProduction} onOpenChange={() => setSelectedProduction(null)}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Production Details - {selectedProduction.voucher_number}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Production Info */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Product:</span>
                      <p className="font-medium">{selectedProduction.products?.name}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Production Quantity:</span>
                      <p className="font-medium">{selectedProduction.quantity}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Scheduled Date:</span>
                      <p className="font-medium">
                        {selectedProduction.scheduled_date ? format(new Date(selectedProduction.scheduled_date), "MMM dd, yyyy") : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Status:</span>
                      {getStatusBadge(selectedProduction.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced BOM Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Bill of Materials - Cumulative Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EnhancedBOMTable
                    productionOrderId={selectedProduction.id}
                    productId={selectedProduction.product_id}
                    productionQuantity={selectedProduction.quantity}
                  />
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default ScheduledProductions;
