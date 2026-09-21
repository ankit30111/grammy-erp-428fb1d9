
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle, Calendar, Package, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const CompletedProduction = () => {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch completed production orders
  const { data: completedProduction = [], isLoading } = useQuery({
    queryKey: ["completed-production-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          production_schedules!inner(
            *,
            projections!inner(
              customers!inner(name),
              parts!inner(name, part_code)
            )
          )
        `)
        // schedule_status has no PENDING_OQC or OQC_APPROVED. Passing them made
        // Postgres reject the whole query, so this tab showed nothing at all -
        // including the COMPLETED orders it would have matched.
        .in("status", ["COMPLETED", "OQC_PASSED", "OQC_FAILED"])
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const filteredProduction = completedProduction.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.voucher_number.toLowerCase().includes(searchLower) ||
      order.production_schedules?.projections?.parts?.name.toLowerCase().includes(searchLower) ||
      order.production_schedules?.projections?.customers?.name.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'warning';   // produced, OQC not yet ruled
      case 'OQC_PASSED': return 'default';
      case 'OQC_FAILED': return 'destructive';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="text-muted-foreground">Loading completed production...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Completed Production
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search voucher, product, customer..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredProduction.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No completed production orders found</p>
            <p className="text-sm">Production orders will appear here once completed</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher No.</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Completion Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProduction.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-medium">
                    {order.voucher_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {order.production_schedules?.projections?.parts?.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.production_schedules?.projections?.parts?.part_code}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.production_schedules?.projections?.customers?.name}
                  </TableCell>
                  <TableCell className="font-medium">
                    {order.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(order.planned_date), "MMM dd, yyyy")}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(order.updated_at), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(order.status) as any}>
                      {order.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="h-4 w-4" />
                      View Details
                    </Button>
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

export default CompletedProduction;
