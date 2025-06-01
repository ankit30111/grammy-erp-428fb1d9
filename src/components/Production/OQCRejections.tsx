
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const OQCRejections = () => {
  // Fetch completed productions that are pending OQC
  const { data: oqcQueue = [] } = useQuery({
    queryKey: ["oqc-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name),
          production_schedules!inner(
            production_line,
            projections!inner(
              customers!inner(name)
            )
          )
        `)
        .eq("status", "COMPLETED")
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'default';
      case 'PENDING_OQC': return 'warning';
      case 'OQC_PASSED': return 'default';
      case 'OQC_FAILED': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Pending OQC ({oqcQueue.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {oqcQueue.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Production Line</TableHead>
                  <TableHead>Completed Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oqcQueue.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.voucher_number}</TableCell>
                    <TableCell>{order.products?.name}</TableCell>
                    <TableCell>{order.production_schedules?.projections?.customers?.name}</TableCell>
                    <TableCell>{order.quantity} units</TableCell>
                    <TableCell>{order.production_schedules?.production_line}</TableCell>
                    <TableCell>{new Date(order.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(order.status) as any}>
                        Pending OQC
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-2">
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                        <Button size="sm" className="gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Start OQC
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No productions pending OQC
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            OQC Rejections (0)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No OQC rejections found
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OQCRejections;
