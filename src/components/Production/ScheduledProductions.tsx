
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Play, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import ProductionDetailsDialog from "./ProductionDetailsDialog";

const ScheduledProductions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLines, setSelectedLines] = useState<Record<string, string>>({});
  const [selectedProduction, setSelectedProduction] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch scheduled productions with kit status information
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
              products!inner(name)
            )
          ),
          kit_preparation(
            id,
            status,
            kit_items(
              id,
              verified_by_production,
              raw_materials!inner(*)
            )
          )
        `)
        .in("status", ["PENDING", "IN_PROGRESS", "COMPLETED"])
        .order("scheduled_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Mutation to start production
  const startProductionMutation = useMutation({
    mutationFn: async ({ productionOrderId, productionLine }: { productionOrderId: string; productionLine: string }) => {
      const { error } = await supabase
        .from("production_orders")
        .update({ 
          status: "IN_PROGRESS"
        })
        .eq("id", productionOrderId);

      if (error) throw error;

      // Update production schedule with assigned line
      const { data: productionOrder } = await supabase
        .from("production_orders")
        .select("production_schedule_id")
        .eq("id", productionOrderId)
        .single();

      if (productionOrder) {
        await supabase
          .from("production_schedules")
          .update({ production_line: productionLine })
          .eq("id", productionOrder.production_schedule_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-productions"] });
      queryClient.invalidateQueries({ queryKey: ["production-lines-orders"] });
      toast({
        title: "Production Started",
        description: "Production has been started successfully",
      });
    },
    onError: (error) => {
      console.error("Error starting production:", error);
      toast({
        title: "Error",
        description: "Failed to start production",
        variant: "destructive",
      });
    },
  });

  const getKitStatus = (production: any) => {
    if (!production.kit_preparation || production.kit_preparation.length === 0) {
      return "Kit Not Prepared";
    }

    const kit = production.kit_preparation[0];
    if (!kit.kit_items || kit.kit_items.length === 0) {
      return "Kit Not Prepared";
    }

    // Check if all items are verified by production
    const allVerified = kit.kit_items.every((item: any) => item.verified_by_production);
    
    if (!allVerified) {
      return "Kit Sent - Pending Verification";
    }

    // Check what types of components are verified
    const verifiedComponents = kit.kit_items.filter((item: any) => item.verified_by_production);
    
    // You might want to add logic here to determine component types based on BOM data
    // For now, we'll use the kit status from the database
    if (kit.status?.includes("COMPLETE KIT")) {
      return "Complete Kit Received";
    } else if (kit.status?.includes("SUB ASSEMBLY")) {
      return "Sub Assembly Received";
    } else if (kit.status?.includes("ACCESSORY")) {
      return "Accessory Received";
    } else if (kit.status?.includes("MAIN ASSEMBLY")) {
      return "Main Assembly Received";
    }
    
    return "Kit Received";
  };

  const getKitStatusColor = (status: string) => {
    switch (status) {
      case 'Complete Kit Received': return 'default';
      case 'Sub Assembly Received': return 'warning';
      case 'Accessory Received': return 'warning';
      case 'Main Assembly Received': return 'warning';
      case 'Kit Received': return 'default';
      case 'Kit Sent - Pending Verification': return 'secondary';
      case 'Kit Not Prepared': return 'destructive';
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

  const canStartProduction = (production: any) => {
    const kitStatus = getKitStatus(production);
    return production.status === 'PENDING' && 
           (kitStatus === 'Complete Kit Received' || 
            kitStatus === 'Sub Assembly Received' || 
            kitStatus === 'Accessory Received' || 
            kitStatus === 'Main Assembly Received' || 
            kitStatus === 'Kit Received');
  };

  const handleLineSelection = (productionOrderId: string, line: string) => {
    setSelectedLines(prev => ({
      ...prev,
      [productionOrderId]: line
    }));
  };

  const handleStartProduction = (productionOrderId: string) => {
    const selectedLine = selectedLines[productionOrderId];
    if (!selectedLine) {
      toast({
        title: "Error",
        description: "Please select a production line",
        variant: "destructive",
      });
      return;
    }
    startProductionMutation.mutate({ productionOrderId, productionLine: selectedLine });
  };

  const handleViewDetails = (production: any) => {
    setSelectedProduction(production);
    setShowDetailsDialog(true);
  };

  const productionLines = ["Line 1", "Line 2", "Sub Assembly 1", "Sub Assembly 2"];

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
                <TableHead>Kit Status</TableHead>
                <TableHead>Production Status</TableHead>
                <TableHead>Production Line</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduledProductions.map((production) => {
                const kitStatus = getKitStatus(production);
                
                return (
                  <TableRow key={production.id}>
                    <TableCell className="font-medium">{production.voucher_number}</TableCell>
                    <TableCell>{production.products?.name}</TableCell>
                    <TableCell>{new Date(production.scheduled_date).toLocaleDateString()}</TableCell>
                    <TableCell>{production.quantity}</TableCell>
                    <TableCell>
                      <Badge variant={getKitStatusColor(kitStatus) as any}>
                        {kitStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getProductionStatusColor(production.status) as any}>
                        {production.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canStartProduction(production) && production.status === 'PENDING' ? (
                        <Select
                          value={selectedLines[production.id] || ""}
                          onValueChange={(value) => handleLineSelection(production.id, value)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select Line" />
                          </SelectTrigger>
                          <SelectContent>
                            {productionLines.map((line) => (
                              <SelectItem key={line} value={line}>
                                {line}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : production.status === 'IN_PROGRESS' || production.status === 'COMPLETED' ? (
                        <span className="text-sm text-muted-foreground">
                          {production.production_schedules?.production_line || 'Assigned'}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
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
                        {canStartProduction(production) && (
                          <Button 
                            size="sm" 
                            className="gap-2"
                            onClick={() => handleStartProduction(production.id)}
                            disabled={startProductionMutation.isPending}
                          >
                            <Play className="h-4 w-4" />
                            Start Production
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Production Details Dialog */}
      <ProductionDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        productionOrder={selectedProduction}
      />
    </div>
  );
};

export default ScheduledProductions;
