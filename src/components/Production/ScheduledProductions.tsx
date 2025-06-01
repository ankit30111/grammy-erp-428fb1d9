
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Play } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ScheduledProductions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        .order("scheduled_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Mutation to start production
  const startProductionMutation = useMutation({
    mutationFn: async (productionOrderId: string) => {
      const { error } = await supabase
        .from("production_orders")
        .update({ 
          status: "IN_PROGRESS"
        })
        .eq("id", productionOrderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-productions"] });
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
           (kitStatus === 'Complete Kit Received' || kitStatus === 'Kit Received');
  };

  const handleStartProduction = (productionOrderId: string) => {
    startProductionMutation.mutate(productionOrderId);
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
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Kit Status</TableHead>
                <TableHead>Production Status</TableHead>
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
                      <div className="flex gap-2">
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
    </div>
  );
};

export default ScheduledProductions;
