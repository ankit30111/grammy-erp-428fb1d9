
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Eye, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import ProductionVoucherDetailView from "./ProductionVoucherDetailView";
import ProductionLineManager from "./ProductionLineManager";

const ScheduledProductions = () => {
  const [selectedProduction, setSelectedProduction] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showLineManager, setShowLineManager] = useState<string | null>(null);

  // Fetch scheduled productions
  const { data: scheduledProductions = [] } = useQuery({
    queryKey: ["scheduled-productions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name)
        `)
        .in("status", ["PENDING", "IN_PROGRESS", "COMPLETED", "SCHEDULED"])
        .order("scheduled_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const getProductionStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS': return 'default';
      case 'COMPLETED': return 'default';
      case 'SCHEDULED': return 'default';
      case 'ON_HOLD': return 'destructive';
      case 'PENDING': return 'secondary';
      default: return 'secondary';
    }
  };

  const handleViewDetails = (production: any) => {
    setSelectedProduction(production);
    setShowDetailsDialog(true);
  };

  const handleManageLines = (productionId: string) => {
    setShowLineManager(productionId);
  };

  if (showLineManager) {
    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          onClick={() => setShowLineManager(null)}
        >
          ← Back to Scheduled Productions
        </Button>
        <ProductionLineManager productionOrderId={showLineManager} />
      </div>
    );
  }

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
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Production Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduledProductions.map((production) => (
                <TableRow key={production.id}>
                  <TableCell className="font-medium">{production.voucher_number}</TableCell>
                  <TableCell>{production.products?.name}</TableCell>
                  <TableCell>{new Date(production.scheduled_date).toLocaleDateString()}</TableCell>
                  <TableCell>{production.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={getProductionStatusColor(production.status) as any}>
                      {production.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(production)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManageLines(production.id)}
                        className="gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        Manage Lines
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Production Voucher Detail View Dialog */}
      {selectedProduction && (
        <ProductionVoucherDetailView
          production={selectedProduction}
          isOpen={showDetailsDialog}
          onClose={() => {
            setShowDetailsDialog(false);
            setSelectedProduction(null);
          }}
        />
      )}
    </div>
  );
};

export default ScheduledProductions;
