
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, XCircle, AlertTriangle, Package } from "lucide-react";
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
}

interface DiscrepancyEntry {
  id: string;
  type: string;
  voucher_number: string;
  product_name: string;
  material_code: string;
  material_name: string;
  sent_quantity: number;
  received_quantity: number;
  difference: number;
  created_at: string;
  status: string;
}

type FeedbackItem = MaterialRequest | DiscrepancyEntry;

const ProductionFeedbackTab = () => {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const queryClient = useQueryClient();

  // Fetch pending production feedback requests
  const { data: feedbackItems = [], isLoading } = useQuery({
    queryKey: ["production-feedback"],
    queryFn: async () => {
      console.log("🔍 Fetching production feedback items...");
      
      // Fetch material requests
      const { data: materialRequests, error: requestsError } = await supabase
        .from("material_requests")
        .select(`
          *,
          raw_materials!inner(
            material_code,
            name
          )
        `)
        .eq("status", "PENDING");

      if (requestsError) {
        console.error("❌ Error fetching material requests:", requestsError);
        throw requestsError;
      }

      // For now, we'll use material requests as the main feedback source
      // In a real implementation, you might have a separate discrepancies table
      const items: FeedbackItem[] = materialRequests?.map(request => ({
        ...request,
        type: "MATERIAL_REQUEST"
      })) || [];

      console.log("📋 Production feedback items:", items.length);
      return items;
    },
    refetchInterval: 5000,
  });

  // Helper function to check if item is a material request
  const isMaterialRequest = (item: FeedbackItem): item is MaterialRequest => {
    return 'requested_quantity' in item && 'reason' in item;
  };

  // Helper function to check if item is a discrepancy entry
  const isDiscrepancyEntry = (item: FeedbackItem): item is DiscrepancyEntry => {
    return 'sent_quantity' in item && 'received_quantity' in item;
  };

  // Mutation to handle feedback response
  const handleFeedbackMutation = useMutation({
    mutationFn: async ({ feedbackId, action, rawMaterialId, approvedQuantity }: {
      feedbackId: string;
      action: 'ACCEPT' | 'REJECT';
      rawMaterialId?: string;
      approvedQuantity?: number;
    }) => {
      console.log(`🔄 Processing feedback ${action}:`, { feedbackId, rawMaterialId, approvedQuantity });

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

        // Update inventory using standard Supabase update method
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
            reference_number: `MR-${feedbackId.slice(0, 8)}`,
            notes: `Production feedback accepted - quantity returned to inventory`
          });

        if (logError) throw logError;

      } else {
        // Reject feedback
        const { error: rejectError } = await supabase
          .from("material_requests")
          .update({ status: 'REJECTED' })
          .eq("id", feedbackId);

        if (rejectError) throw rejectError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      
      toast.success(
        variables.action === 'ACCEPT' 
          ? "Production feedback accepted - inventory updated" 
          : "Production feedback rejected"
      );
      setSelectedFeedback(null);
    },
    onError: (error) => {
      console.error("❌ Error processing feedback:", error);
      toast.error("Failed to process production feedback");
    },
  });

  const handleAcceptFeedback = (feedback: FeedbackItem) => {
    if (isMaterialRequest(feedback)) {
      handleFeedbackMutation.mutate({
        feedbackId: feedback.id,
        action: 'ACCEPT',
        rawMaterialId: feedback.raw_material_id,
        approvedQuantity: feedback.requested_quantity
      });
    }
  };

  const handleRejectFeedback = (feedback: FeedbackItem) => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedbackItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>No pending production feedback</p>
              <p className="text-sm mt-1">Discrepancies will appear here when reported by production</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Details</TableHead>
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
                    <TableCell>
                      {isMaterialRequest(feedback) ? (
                        <Badge variant="outline">Additional Material Request</Badge>
                      ) : (
                        <Badge variant="outline">Quantity Discrepancy</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {isMaterialRequest(feedback) 
                        ? feedback.raw_materials?.material_code 
                        : isDiscrepancyEntry(feedback) 
                          ? feedback.material_code 
                          : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {isMaterialRequest(feedback) 
                        ? feedback.raw_materials?.name 
                        : isDiscrepancyEntry(feedback) 
                          ? feedback.material_name 
                          : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {isMaterialRequest(feedback) ? (
                        <div>
                          <p className="font-medium">Requested: {feedback.requested_quantity} units</p>
                          <p className="text-sm text-muted-foreground">{feedback.reason}</p>
                        </div>
                      ) : isDiscrepancyEntry(feedback) ? (
                        <div>
                          <p className="font-medium">
                            Sent: {feedback.sent_quantity} | Received: {feedback.received_quantity}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Difference: {feedback.difference}
                          </p>
                        </div>
                      ) : null}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionFeedbackTab;
