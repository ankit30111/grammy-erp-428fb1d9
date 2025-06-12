import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, XCircle, AlertTriangle, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useProductionDiscrepancies } from "@/hooks/useProductionDiscrepancies";
import { useState } from "react";

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
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  // Fetch material requests
  const { data: feedbackItems = [], isLoading, refetch } = useQuery({
    queryKey: ["production-feedback"],
    queryFn: async () => {
      console.log("🔍 Fetching production feedback and discrepancies...");
      
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
      return materialRequests || [];
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Fetch production discrepancies
  const { discrepancies, resolveDiscrepancy, isResolving } = useProductionDiscrepancies();

  // Material request handling
  const handleFeedbackMutation = useMutation({
    mutationFn: async ({ feedbackId, action, rawMaterialId, approvedQuantity }: {
      feedbackId: string;
      action: 'ACCEPT' | 'REJECT';
      rawMaterialId?: string;
      approvedQuantity?: number;
    }) => {
      console.log(`🔄 Processing production feedback ${action}:`, { feedbackId, rawMaterialId, approvedQuantity });

      if (action === 'ACCEPT' && rawMaterialId && approvedQuantity) {
        const { error: updateError } = await supabase
          .from("material_requests")
          .update({ 
            status: 'APPROVED',
            approved_quantity: approvedQuantity,
            approved_by: (await supabase.auth.getUser()).data.user?.id
          })
          .eq("id", feedbackId);

        if (updateError) throw updateError;

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

  const handleDiscrepancyResolve = (discrepancyId: string, action: 'APPROVE' | 'REJECT') => {
    const notes = resolutionNotes[discrepancyId];
    resolveDiscrepancy({ discrepancyId, action, resolutionNotes: notes });
    setResolutionNotes(prev => ({ ...prev, [discrepancyId]: '' }));
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

  const getDiscrepancyTypeBadge = (type: string) => {
    switch (type) {
      case 'SHORTAGE':
        return <Badge variant="destructive">Shortage</Badge>;
      case 'EXCESS':
        return <Badge variant="secondary">Excess</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
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
      {/* Production Discrepancies Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Production Quantity Discrepancies ({discrepancies.filter(d => d.status === 'PENDING').length})
            <Badge variant="outline">Store Review Required</Badge>
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
          {discrepancies.filter(d => d.status === 'PENDING').length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No pending quantity discrepancies</p>
              <p className="text-sm mt-1">
                All production receipts match store dispatch quantities
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sent Qty</TableHead>
                    <TableHead>Received Qty</TableHead>
                    <TableHead>Discrepancy</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Resolution Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discrepancies.filter(d => d.status === 'PENDING').map((discrepancy) => (
                    <TableRow key={discrepancy.id}>
                      <TableCell>
                        {format(new Date(discrepancy.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-mono">
                        {discrepancy.production_orders?.voucher_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-mono text-sm">{discrepancy.raw_materials?.material_code}</div>
                          <div className="text-xs text-muted-foreground">{discrepancy.raw_materials?.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getDiscrepancyTypeBadge(discrepancy.discrepancy_type)}
                      </TableCell>
                      <TableCell className="font-medium text-blue-600">
                        {discrepancy.sent_quantity}
                      </TableCell>
                      <TableCell className="font-medium text-green-600">
                        {discrepancy.received_quantity}
                      </TableCell>
                      <TableCell className="font-medium text-red-600">
                        {discrepancy.discrepancy_quantity}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm truncate" title={discrepancy.reason}>
                          {discrepancy.reason}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          placeholder="Add resolution notes..."
                          value={resolutionNotes[discrepancy.id] || ''}
                          onChange={(e) => setResolutionNotes(prev => ({
                            ...prev,
                            [discrepancy.id]: e.target.value
                          }))}
                          className="min-h-[60px] text-xs"
                          disabled={isResolving}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDiscrepancyResolve(discrepancy.id, 'APPROVE')}
                            className="gap-1"
                            disabled={isResolving}
                          >
                            <CheckCircle className="h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDiscrepancyResolve(discrepancy.id, 'REJECT')}
                            className="gap-1"
                            disabled={isResolving}
                          >
                            <XCircle className="h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Material Requests Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Material Requests & Issues ({feedbackItems.length})
            <Badge variant="outline">Production Feedback</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedbackItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>No pending material requests</p>
              <p className="text-sm mt-1">
                Material requests and production issues will appear here
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
                    <TableHead>Material</TableHead>
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
                        <div>
                          <div className="font-mono text-sm">{feedback.raw_materials?.material_code}</div>
                          <div className="text-xs text-muted-foreground">{feedback.raw_materials?.name}</div>
                        </div>
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
