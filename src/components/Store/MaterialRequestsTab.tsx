
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, XCircle, ArrowLeftRight, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const MaterialRequestsTab = memo(() => {
  const queryClient = useQueryClient();

  const { data: materialRequests = [], isLoading, refetch } = useQuery({
    queryKey: ["material-requests"],
    queryFn: async () => {
      console.log("🔍 Fetching material requests from production...");
      
      const { data, error } = await supabase
        .from("material_requests")
        .select(`
          id,
          production_order_id,
          raw_material_id,
          requested_quantity,
          approved_quantity,
          reason,
          status,
          created_at,
          requested_by,
          approved_by,
          raw_materials!inner(
            material_code,
            name
          ),
          production_orders!inner(
            voucher_number,
            products!inner(
              name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100); // Performance limit

      if (error) {
        console.error("❌ Error fetching material requests:", error);
        throw error;
      }
      
      console.log("📋 Material requests found:", data?.length || 0);
      return data || [];
    },
    refetchInterval: 10000, // Real-time updates for production requests
    staleTime: 5000,
  });

  const handleRequestMutation = useMutation({
    mutationFn: async ({ requestId, action, approvedQuantity }: {
      requestId: string;
      action: 'APPROVE' | 'REJECT';
      approvedQuantity?: number;
    }) => {
      console.log(`🔄 Processing material request ${action}:`, { requestId, approvedQuantity });
      
      const { error } = await supabase
        .from("material_requests")
        .update({ 
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          approved_quantity: action === 'APPROVE' ? approvedQuantity : 0,
          approved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", requestId);

      if (error) throw error;

      // If approved, add material back to inventory
      if (action === 'APPROVE' && approvedQuantity) {
        const requestData = materialRequests.find(r => r.id === requestId);
        if (requestData) {
          // Update inventory
          const { data: currentInventory, error: fetchError } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("raw_material_id", requestData.raw_material_id)
            .single();

          if (!fetchError && currentInventory) {
            const { error: inventoryError } = await supabase
              .from("inventory")
              .update({ 
                quantity: currentInventory.quantity + approvedQuantity,
                last_updated: new Date().toISOString()
              })
              .eq("raw_material_id", requestData.raw_material_id);

            if (!inventoryError) {
              // Log the movement
              await supabase
                .from("material_movements")
                .insert({
                  raw_material_id: requestData.raw_material_id,
                  movement_type: "PRODUCTION_RETURN",
                  quantity: approvedQuantity,
                  reference_type: "MATERIAL_REQUEST",
                  reference_id: requestId,
                  reference_number: `MR-${requestId.slice(0, 8)}`,
                  notes: `Material request approved - ${requestData.reason || 'Additional material needed'}`
                });
            }
          }
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      
      toast.success(
        variables.action === 'APPROVE' 
          ? "Material request approved and inventory updated" 
          : "Material request rejected"
      );
    },
    onError: (error) => {
      console.error("❌ Error processing material request:", error);
      toast.error("Failed to process material request");
    },
  });

  const handleApprove = (request: any) => {
    handleRequestMutation.mutate({
      requestId: request.id,
      action: 'APPROVE',
      approvedQuantity: request.requested_quantity
    });
  };

  const handleReject = (request: any) => {
    handleRequestMutation.mutate({
      requestId: request.id,
      action: 'REJECT'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'APPROVED':
        return <Badge variant="default">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
          <p className="text-muted-foreground">Loading material requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Material Requests from Production ({materialRequests.length})
            <Badge variant="outline">Real-time Updates</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="ml-auto gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {materialRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowLeftRight className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>No material requests found</p>
              <p className="text-sm mt-1">Additional material requests from production will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher No.</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Requested Qty</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {format(new Date(request.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-mono">
                        {request.production_orders?.voucher_number}
                      </TableCell>
                      <TableCell>
                        {request.production_orders?.products?.name}
                      </TableCell>
                      <TableCell className="font-mono">
                        {request.raw_materials?.material_code}
                      </TableCell>
                      <TableCell>
                        {request.raw_materials?.name}
                      </TableCell>
                      <TableCell className="font-medium">
                        {request.requested_quantity} units
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {request.reason || 'No reason provided'}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(request)}
                              className="gap-1"
                              disabled={handleRequestMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(request)}
                              className="gap-1"
                              disabled={handleRequestMutation.isPending}
                            >
                              <XCircle className="h-3 w-3" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

MaterialRequestsTab.displayName = "MaterialRequestsTab";

export default MaterialRequestsTab;
