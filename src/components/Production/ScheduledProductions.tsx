
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Factory, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const ScheduledProductions = () => {
  const [selectedProduction, setSelectedProduction] = useState<string | null>(null);

  // Fetch scheduled productions from database
  const { data: scheduledProductions = [] } = useQuery({
    queryKey: ["scheduled-productions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name),
          production_schedules!inner(
            *,
            projections!inner(
              customers!inner(name)
            )
          )
        `)
        .order("scheduled_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const getKitStatusColor = (status: string) => {
    switch (status) {
      case 'READY': return 'default';
      case 'SENT': return 'default';
      case 'VERIFIED': return 'default';
      case 'PREPARED': return 'warning';
      case 'SHORTAGE': return 'destructive';
      case 'NOT_PREPARED': return 'secondary';
      default: return 'secondary';
    }
  };

  const getProductionStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS': return 'default';
      case 'COMPLETED': return 'default';
      case 'ON_HOLD': return 'destructive';
      case 'PENDING': return 'secondary';
      default: return 'secondary';
    }
  };

  if (scheduledProductions.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Productions (0)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No scheduled productions found
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Productions ({scheduledProductions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Kit Status</TableHead>
                <TableHead>Production Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduledProductions.map((production) => (
                <TableRow key={production.id}>
                  <TableCell className="font-medium">{production.voucher_number}</TableCell>
                  <TableCell>{production.products?.name}</TableCell>
                  <TableCell>{production.production_schedules?.projections?.customers?.name}</TableCell>
                  <TableCell>{new Date(production.scheduled_date).toLocaleDateString()}</TableCell>
                  <TableCell>{production.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={getKitStatusColor(production.kit_status) as any}>
                      {production.kit_status?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getProductionStatusColor(production.status) as any}>
                      {production.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {production.kit_status === 'SENT' && production.status === 'PENDING' && (
                        <Button size="sm" className="gap-2">
                          <Package className="h-4 w-4" />
                          Start Production
                        </Button>
                      )}
                      {production.status === 'IN_PROGRESS' && (
                        <Button size="sm" variant="outline" className="gap-2">
                          <Factory className="h-4 w-4" />
                          View Details
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduledProductions;
