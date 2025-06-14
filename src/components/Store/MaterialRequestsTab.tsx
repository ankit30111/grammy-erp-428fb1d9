import { memo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, XCircle, ArrowLeftRight, Package, RefreshCw, Send, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { useInventoryMutations } from "@/hooks/inventory";

interface SendingQuantities {
  [requestId: string]: number;
}

const MaterialRequestsTab = memo(() => {
  const queryClient = useQueryClient();
  const { updateInventoryQuantity } = useInventoryMutations();
  const [sendingQuantities, setSendingQuantities] = useState<SendingQuantities>({});
  const [activeTab, setActiveTab] = useState("all");

  // Get current user for proper authentication
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error("❌ Error getting current user:", error);
        throw error;
      }
      return user;
    },
  });

  // Check if user has a user_accounts record
  const { data: userAccount } = useQuery({
    queryKey: ["user-account", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      
      const { data, error } = await supabase
        .from("user_accounts")
        .select("*")
        .eq("id", currentUser.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error("❌ Error getting user account:", error);
        throw error;
      }
      
      return data;
    },
    enabled: !!currentUser?.id,
  });

  // Create user account if it doesn't exist
  const createUserAccountMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) throw new Error("No current user");
      
      const { data, error } = await supabase
        .from("user_accounts")
        .insert({
          id: currentUser.id,
          full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || 'Unknown User',
          email: currentUser.email || 'no-email@example.com',
          username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || `user_${currentUser.id.substring(0, 8)}`,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-account"] });
      toast.success("User account created successfully");
    },
    onError: (error: Error) => {
      console.error("❌ Error creating user account:", error);
      toast.error(`Failed to create user account: ${error.message}`);
    },
  });

  // Auto-create user account if missing
  useState(() => {
    if (currentUser && userAccount === null && !createUserAccountMutation.isPending) {
      createUserAccountMutation.mutate();
    }
  });

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
        .order('created_at', { ascending: false });

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
      
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      if (!userAccount) {
        throw new Error("User account not found. Please refresh the page.");
      }

      const updateData = {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approved_quantity: action === 'APPROVE' ? approvedQuantity : 0,
        approved_by: currentUser.id
      };

      console.log("📝 Updating request with data:", updateData);

      const { data, error } = await supabase
        .from("material_requests")
        .update(updateData)
        .eq("id", requestId)
        .select()
        .single();

      if (error) {
        console.error("❌ Database error:", error);
        if (error.code === '23503') {
          throw new Error("User account validation failed. Please refresh the page and try again.");
        }
        throw new Error(`Database error: ${error.message}`);
      }

      console.log("✅ Request updated successfully:", data);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      
      toast.success(
        variables.action === 'APPROVE' 
          ? `Material request approved - ${variables.approvedQuantity} units` 
          : "Material request rejected"
      );
    },
    onError: (error: Error) => {
      console.error("❌ Error processing material request:", error);
      toast.error(`Failed to process material request: ${error.message}`);
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

      // Calculate new quantity after deduction
      const newQuantity = inventoryItem.quantity - sendQuantity;

      // Update inventory using the mutations hook
      await updateInventoryQuantity.mutateAsync({
        materialId: requestData.raw_material_id,
        newQuantity,
        operation: 'dispatch',
        referenceNumber: requestData.production_orders.voucher_number,
        notes: `Material sent to production for request: ${requestData.reason}`
      });

      // Log the material movement
      await supabase.rpc('log_material_movement', {
        p_raw_material_id: requestData.raw_material_id,
        p_movement_type: 'DISPATCH',
        p_quantity: sendQuantity,
        p_reference_id: requestData.production_order_id,
        p_reference_type: 'production_order',
        p_reference_number: requestData.production_orders.voucher_number,
        p_notes: `Material sent to production for request: ${requestData.reason}`
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
    if (!currentUser) {
      toast.error("Please log in to approve requests");
      return;
    }

    if (!userAccount) {
      toast.error("User account not found. Please refresh the page.");
      return;
    }

    handleRequestMutation.mutate({
      requestId: request.id,
      action: 'APPROVE',
      approvedQuantity: request.requested_quantity
    });
  };

  const handleReject = (request: any) => {
    if (!currentUser) {
      toast.error("Please log in to reject requests");
      return;
    }

    if (!userAccount) {
      toast.error("User account not found. Please refresh the page.");
      return;
    }

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
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending Review</Badge>;
      case 'APPROVED':
        return <Badge variant="default" className="gap-1"><ThumbsUp className="h-3 w-3" />Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive" className="gap-1"><ThumbsDown className="h-3 w-3" />Rejected</Badge>;
      case 'SENT':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1"><Send className="h-3 w-3" />Material Sent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProductionLineDisplay = (productionLines: any) => {
    if (!productionLines || typeof productionLines !== 'object') return 'Not Assigned';
    
    const lines = Object.values(productionLines).filter(Boolean);
    return lines.length > 0 ? lines.join(', ') : 'Not Assigned';
  };

  // Filter requests based on active tab
  const filteredRequests = materialRequests.filter(request => {
    if (activeTab === "all") return true;
    return request.status.toLowerCase() === activeTab.toLowerCase();
  });

  // Get counts for each status
  const statusCounts = {
    all: materialRequests.length,
    pending: materialRequests.filter(r => r.status === 'PENDING').length,
    approved: materialRequests.filter(r => r.status === 'APPROVED').length,
    rejected: materialRequests.filter(r => r.status === 'REJECTED').length,
    sent: materialRequests.filter(r => r.status === 'SENT').length,
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
            Material Requests from Production
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" className="relative">
                All ({statusCounts.all})
              </TabsTrigger>
              <TabsTrigger value="pending" className="relative">
                Pending ({statusCounts.pending})
                {statusCounts.pending > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                    {statusCounts.pending}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="relative">
                Approved ({statusCounts.approved})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="relative">
                Rejected ({statusCounts.rejected})
              </TabsTrigger>
              <TabsTrigger value="sent" className="relative">
                Sent ({statusCounts.sent})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {filteredRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowLeftRight className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                  <p>No {activeTab === 'all' ? '' : activeTab.toLowerCase()} material requests found</p>
                  <p className="text-sm mt-1">
                    {activeTab === 'pending' 
                      ? 'New material requests from production will appear here' 
                      : `${activeTab === 'all' ? 'Material requests' : activeTab + ' requests'} will be shown here`
                    }
                  </p>
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
                      {filteredRequests.map((request) => {
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
                            TableCell>
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
                                    {handleRequestMutation.isPending ? 'Processing...' : 'Approve'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReject(request)}
                                    className="gap-1"
                                    disabled={handleRequestMutation.isPending}
                                  >
                                    <XCircle className="h-3 w-3" />
                                    {handleRequestMutation.isPending ? 'Processing...' : 'Reject'}
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
                                    {sendMaterialMutation.isPending ? 'Sending...' : 'Send'}
                                  </Button>
                                </div>
                              )}
                              {(request.status === 'REJECTED' || request.status === 'SENT') && (
                                <div className="text-sm text-muted-foreground">
                                  {request.status === 'REJECTED' ? 'Request was rejected' : `${request.approved_quantity} units sent`}
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
});

MaterialRequestsTab.displayName = "MaterialRequestsTab";

export default MaterialRequestsTab;
