
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, XCircle, AlertTriangle, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface MaterialRequest {
  id: string;
  production_order_id: string;
  raw_material_id: string;
  requested_quantity: number;
  approved_quantity: number;
  reason: string;
  status: string;
  created_at: string;
  raw_materials: {
    material_code: string;
    name: string;
  };
  production_orders: {
    voucher_number: string;
    products: {
      name: string;
    };
  };
}

const ProductionFeedbackTab = memo(() => {
  const queryClient = useQueryClient();

  // Enhanced query to fetch all production feedback and discrepancies
  const { data: feedbackItems = [], isLoading, refetch } = useQuery({
    queryKey: ["production-feedback"],
    queryFn: async () => {
      console.log("🔍 Fetching production feedback and discrepancies...");
      
      // Fetch material requests that indicate production issues
      const { data: materialRequests, error: requestsError } = await supabase
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
        .in("status", ["PENDING", "APPROVED", "REJECTED"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (requestsError) {
        console.error("❌ Error fetching production feedback:", requestsError);
        throw requestsError;
      }

      console.log("📋 Production feedback items found:", materialRequests?.length || 0);
      
      // Filter items that are actually discrepancies or feedback
      const feedbackItems = materialRequests?.filter(item => 
        item.reason && (
          item.reason.toLowerCase().includes('discrepancy') ||
          item.reason.toLowerCase().includes('shortage') ||
          item.reason.toLowerCase().includes('damaged') ||
          item.reason.toLowerCase().includes('insufficient') ||
          item.reason.toLowerCase().includes('defect')
        )
      ) || [];

      console.log("🚨 Actual feedback/discrepancy items:", feedbackItems.length);
      
      return materialRequests || [];
    },
    refetchInterval: 10000, // Real-time for production feedback
    staleTime: 5000,
  });

  // Mutation to handle feedback response
  const handleFeedbackMutation = useMutation({
    mutationFn: async ({ feedbackId, action, rawMaterialId, approvedQuantity }: {
      feedbackId: string;
      action: 'ACCEPT' | 'REJECT';
      rawMaterialId?: string;
      approvedQuantity?: number;
    }) => {
      console.log(`🔄 Processing production feedback ${action}:`, { feedbackId, rawMaterialId, approvedQuantity });

      if (action === 'ACCEPT' && rawMaterialId && approvedQuantity) {
        // Update material request as approved
        const { error: updateError } = await supabase
          .from("material_requests")
          .update({ 
            status: 'APPROVED',
            approved_quantity: approvedQuantity,
            approved_by: (await supabase.auth.getUser()).data.user?.id
          })
          .eq("id", feedbackId);

        if (updateError) throw updateError;

        // Update inventory - add back the returned/discrepant material
        const { data: currentInventory, error: fetchError } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("raw_material_id", rawMaterialId)
          .single();

        if (fetchError) throw fetchError;

        const { error: inventoryError } = await supabase
          .from("inventory")
          .update({ 
            quantity: (currentInventory?.quantity || 0) + approvedQuantity,
            last_updated: new Date().toISOString()
          })
          .eq("raw_material_id", rawMaterialId);

        if (inventoryError) throw inventoryError;

        // Log the movement
        const { error: logError } = await supabase
          .from("material_movements")
          .insert({
            raw_material_id: rawMaterialId,
            movement_type: "PRODUCTION_FEEDBACK_RETURN",
            quantity: approvedQuantity,
            reference_type: "MATERIAL_REQUEST",
            reference_id: feedbackId,
            reference_number: `FB-${feedbackId.slice(0, 8)}`,
            notes: `Production feedback accepted - material returned to inventory due to: ${feedbackItems.find(f => f.id === feedbackId)?.reason || 'Production issue'}`
          });

        if (logError) throw logError;

      } else {
        // Reject feedback
        const { error: rejectError } = await supabase
          .from("material_requests")
          .update({ 
            status: 'REJECTED',
            approved_by: (await supabase.auth.getUser()).data.user?.id
          })
          .eq("id", feedbackId);

        if (rejectError) throw rejectError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      
      toast.success(
        variables.action === 'ACCEPT' 
          ? "Production feedback accepted - inventory updated" 
          : "Production feedback rejected"
      );
    },
    onError: (error) => {
      console.error("❌ Error processing production feedback:", error);
      toast.error("Failed to process production feedback");
    },
  });

  const handleAcceptFeedback = (feedback: MaterialRequest) => {
    handleFeedbackMutation.mutate({
      feedbackId: feedback.id,
      action: 'ACCEPT',
      rawMaterialId: feedback.raw_material_id,
      approvedQuantity: feedback.requested_quantity
    });
  };

  const handleRejectFeedback = (feedback: MaterialRequest) => {
    handleFeedbackMutation.mutate({
      feedbackId: feedback.id,
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

  const getFeedbackType = (reason: string) => {
    if (!reason) return "Additional Request";
    
    const reasonLower = reason.toLowerCase();
    if (reasonLower.includes('discrepancy')) return "Quantity Discrepancy";
    if (reasonLower.includes('damaged')) return "Damaged Material";
    if (reasonLower.includes('defect')) return "Material Defect";
    if (reasonLower.includes('shortage')) return "Material Shortage";
    if (reasonLower.includes('insufficient')) return "Insufficient Quality";
    
    return "Production Issue";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
          <p className="text-muted-foreground">Loading production feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Production Feedback & Discrepancies ({feedbackItems.length})
            <Badge variant="outline">Store-Production Reconciliation</Badge>
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
          {feedbackItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>No pending production feedback</p>
              <p className="text-sm mt-1">
                Material discrepancies and production issues will appear here when reported
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Issue Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbackItems.map((feedback) => (
                    <TableRow key={feedback.id}>
                      <TableCell>
                        {format(new Date(feedback.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-mono">
                        {feedback.production_orders?.voucher_number}
                      </TableCell>
                      <TableCell>
                        {feedback.production_orders?.products?.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getFeedbackType(feedback.reason)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {feedback.raw_materials?.material_code}
                      </TableCell>
                      <TableCell>
                        {feedback.raw_materials?.name}
                      </TableCell>
                      <TableCell className="font-medium">
                        {feedback.requested_quantity} units
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm truncate" title={feedback.reason}>
                          {feedback.reason || 'No details provided'}
                        </p>
                      </TableCell>
                      <TableCell>{getStatusBadge(feedback.status)}</TableCell>
                      <TableCell>
                        {feedback.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcceptFeedback(feedback)}
                              className="gap-1"
                              disabled={handleFeedbackMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3" />
                              Accept
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectFeedback(feedback)}
                              className="gap-1"
                              disabled={handleFeedbackMutation.isPending}
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

ProductionFeedbackTab.displayName = "ProductionFeedbackTab";

export default ProductionFeedbackTab;
