
import { memo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, XCircle, ArrowLeftRight, Package, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { useInventoryDeduction } from "@/hooks/inventory";

interface SendingQuantities {
  [requestId: string]: number;
}

const MaterialRequestsTab = memo(() => {
  const queryClient = useQueryClient();
  const inventoryDeduction = useInventoryDeduction();
  const [sendingQuantities, setSendingQuantities] = useState<SendingQuantities>({});

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
            name,
            category
          ),
          production_orders!inner(
            voucher_number,
            production_lines,
            products!inner(
              name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error("❌ Error fetching material requests:", error);
        throw error;
      }
      
      console.log("📋 Material requests found:", data?.length || 0);
      return data || [];
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Fetch inventory data for available quantities
  const { data: inventoryData = [] } = useQuery({
    queryKey: ["inventory-for-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          raw_material_id,
          quantity,
          raw_materials!inner(
            material_code,
            name
          )
        `);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
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
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      
      toast.success(
        variables.action === 'APPROVE' 
          ? "Material request approved" 
          : "Material request rejected"
      );
    },
    onError: (error) => {
      console.error("❌ Error processing material request:", error);
      toast.error("Failed to process material request");
    },
  });

  const sendMaterialMutation = useMutation({
    mutationFn: async ({ requestId, sendQuantity }: { requestId: string; sendQuantity: number }) => {
      console.log(`📦 SENDING MATERIAL TO PRODUCTION:`, { requestId, sendQuantity });
      
      const requestData = materialRequests.find(r => r.id === requestId);
      if (!requestData) {
        throw new Error("Request not found");
      }

      // Check inventory availability
      const inventoryItem = inventoryData.find(inv => inv.raw_material_id === requestData.raw_material_id);
      if (!inventoryItem || inventoryItem.quantity < sendQuantity) {
        throw new Error(`Insufficient inventory. Available: ${inventoryItem?.quantity || 0}, Requested: ${sendQuantity}`);
      }

      // Deduct from inventory using the existing hook
      await inventoryDeduction.mutateAsync({
        rawMaterialId: requestData.raw_material_id,
        quantityToDeduct: sendQuantity,
        referenceId: requestData.production_order_id,
        referenceNumber: requestData.production_orders.voucher_number,
        notes: `Material sent to production for request: ${requestData.reason}`
      });

      // Update the material request status to indicate it's been sent
      const { error: updateError } = await supabase
        .from("material_requests")
        .update({
          status: 'SENT',
          approved_quantity: sendQuantity
        })
        .eq("id", requestId);

      if (updateError) {
        console.error("❌ Error updating request status:", updateError);
        throw new Error(`Failed to update request status: ${updateError.message}`);
      }

      console.log(`✅ MATERIAL SENT SUCCESSFULLY: ${sendQuantity} units`);
      return { requestId, sentQuantity: sendQuantity };
    },
    onSuccess: (data) => {
      toast.success(`Material sent successfully: ${data.sentQuantity} units`);
      
      // Clear the sending quantity for this request
      setSendingQuantities(prev => {
        const updated = { ...prev };
        delete updated[data.requestId];
        return updated;
      });
      
      // Refresh all related queries
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-for-requests"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
    },
    onError: (error: Error) => {
      console.error("❌ Failed to send material:", error);
      toast.error(`Failed to send material: ${error.message}`);
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

  const handleSendMaterial = (request: any) => {
    const sendQuantity = sendingQuantities[request.id];
    if (!sendQuantity || sendQuantity <= 0) {
      toast.error("Please enter a valid quantity to send");
      return;
    }

    sendMaterialMutation.mutate({
      requestId: request.id,
      sendQuantity
    });
  };

  const getAvailableQuantity = (rawMaterialId: string) => {
    const inventoryItem = inventoryData.find(inv => inv.raw_material_id === rawMaterialId);
    return inventoryItem?.quantity || 0;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'APPROVED':
        return <Badge variant="default">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'SENT':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Material Sent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProductionLineDisplay = (productionLines: any) => {
    if (!productionLines || typeof productionLines !== 'object') return 'Not Assigned';
    
    const lines = Object.values(productionLines).filter(Boolean);
    return lines.length > 0 ? lines.join(', ') : 'Not Assigned';
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
                    <TableHead>Production Lines</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Requested Qty</TableHead>
                    <TableHead>Available Qty</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialRequests.map((request) => {
                    const availableQty = getAvailableQuantity(request.raw_material_id);
                    const sendingQty = sendingQuantities[request.id] || 0;
                    
                    return (
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
                        <TableCell>
                          <span className="text-sm">
                            {getProductionLineDisplay(request.production_orders?.production_lines)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.raw_materials?.material_code}</p>
                            <p className="text-sm text-muted-foreground">{request.raw_materials?.name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {request.requested_quantity} units
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${availableQty < request.requested_quantity ? 'text-red-600' : 'text-green-600'}`}>
                            {availableQty} units
                          </span>
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
                          {request.status === 'APPROVED' && (
                            <div className="flex gap-2 items-center">
                              <Input
                                type="number"
                                min="1"
                                max={availableQty}
                                placeholder="Qty to send"
                                className="w-24"
                                value={sendingQuantities[request.id] || ''}
                                onChange={(e) => setSendingQuantities(prev => ({
                                  ...prev,
                                  [request.id]: parseInt(e.target.value) || 0
                                }))}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSendMaterial(request)}
                                disabled={sendMaterialMutation.isPending || sendingQty <= 0 || sendingQty > availableQty}
                                className="gap-1"
                              >
                                <Send className="h-3 w-3" />
                                Send
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
