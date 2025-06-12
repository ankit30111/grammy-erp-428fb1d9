
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, X, Clock } from "lucide-react";

const ProductionFeedbackTab = () => {
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch production feedback/discrepancies
  const { data: feedbackData = [] } = useQuery({
    queryKey: ["production-feedback-discrepancies"],
    queryFn: async () => {
      console.log("🔍 Fetching production feedback and discrepancies...");
      
      // Get material requests which represent discrepancies
      const { data: discrepancies, error } = await supabase
        .from("material_requests")
        .select(`
          *,
          production_orders!inner(
            voucher_number,
            products!inner(name)
          ),
          raw_materials!inner(
            material_code,
            name
          )
        `)
        .in("status", ["PENDING", "RESOLVED"])
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("❌ Error fetching discrepancies:", error);
        throw error;
      }

      // Also get kit items where production verified different quantities
      const { data: verificationDiscrepancies, error: verifyError } = await supabase
        .from("kit_items")
        .select(`
          id,
          raw_material_id,
          required_quantity,
          actual_quantity,
          created_at,
          raw_materials!inner(
            material_code,
            name
          ),
          kit_preparation!inner(
            production_order_id,
            production_orders!inner(
              voucher_number,
              products!inner(name)
            )
          )
        `)
        .eq("verified_by_production", true)
        .neq("required_quantity", "actual_quantity");

      if (verifyError) {
        console.error("❌ Error fetching verification discrepancies:", verifyError);
        // Don't throw, just log the error
      }

      console.log("📋 Feedback data:", { discrepancies, verificationDiscrepancies });
      
      // Combine both types of discrepancies
      const combined = [
        ...(discrepancies || []).map(d => ({
          ...d,
          type: 'material_request',
          discrepancy_type: d.reason?.includes('shortage') ? 'shortage' : 'general'
        })),
        ...(verificationDiscrepancies || []).map(v => ({
          id: v.id,
          type: 'verification_discrepancy',
          voucher_number: v.kit_preparation?.production_orders?.voucher_number,
          product_name: v.kit_preparation?.production_orders?.products?.name,
          material_code: v.raw_materials?.material_code,
          material_name: v.raw_materials?.name,
          sent_quantity: v.required_quantity,
          received_quantity: v.actual_quantity,
          difference: v.actual_quantity - v.required_quantity,
          created_at: v.created_at,
          status: 'PENDING'
        }))
      ];

      return combined;
    },
    refetchInterval: 5000, // Check for new feedback every 5 seconds
  });

  // Handle discrepancy resolution
  const resolveDiscrepancyMutation = useMutation({
    mutationFn: async ({ discrepancyId, action, notes }: { discrepancyId: string; action: 'accept' | 'reject'; notes: string }) => {
      console.log("🎯 Resolving discrepancy:", { discrepancyId, action, notes });
      
      const discrepancy = feedbackData.find(d => d.id === discrepancyId);
      if (!discrepancy) throw new Error("Discrepancy not found");

      if (discrepancy.type === 'material_request') {
        // Update material request status
        const { error } = await supabase
          .from("material_requests")
          .update({
            status: action === 'accept' ? 'APPROVED' : 'REJECTED',
            approved_by: 'store-user', // In real app, use actual user ID
            approved_quantity: action === 'accept' ? discrepancy.requested_quantity : 0,
            reason: `${discrepancy.reason} - Store ${action}ed: ${notes}`
          })
          .eq("id", discrepancyId);

        if (error) throw error;

        // If accepted and it's a return, update inventory
        if (action === 'accept' && discrepancy.discrepancy_type === 'return') {
          const { data: currentInventory, error: invError } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("raw_material_id", discrepancy.raw_material_id)
            .single();

          if (invError) throw invError;

          await supabase
            .from("inventory")
            .update({
              quantity: currentInventory.quantity + discrepancy.requested_quantity,
              last_updated: new Date().toISOString()
            })
            .eq("raw_material_id", discrepancy.raw_material_id);

          // Log the movement
          await supabase
            .from("material_movements")
            .insert({
              raw_material_id: discrepancy.raw_material_id,
              movement_type: "PRODUCTION_FEEDBACK_RETURN",
              quantity: discrepancy.requested_quantity,
              reference_id: discrepancy.production_order_id,
              reference_type: "PRODUCTION_ORDER",
              reference_number: discrepancy.voucher_number,
              notes: `Store accepted production feedback return: ${notes}`
            });
        }
      }

      console.log("✅ Discrepancy resolved successfully");
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Discrepancy Resolved",
        description: `Production feedback ${variables.action}ed successfully`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["production-feedback-discrepancies"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      
      setSelectedDiscrepancy(null);
      setResolutionNotes("");
    },
    onError: (error) => {
      toast({
        title: "Resolution Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const getDiscrepancyBadge = (discrepancy: any) => {
    if (discrepancy.status === 'RESOLVED' || discrepancy.status === 'APPROVED') {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Resolved
        </Badge>
      );
    }
    
    if (discrepancy.type === 'verification_discrepancy') {
      return discrepancy.difference > 0 ? (
        <Badge variant="secondary" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Return Needed
        </Badge>
      ) : (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Shortage
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Pending Review
      </Badge>
    );
  };

  const pendingCount = feedbackData.filter(d => d.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Production Feedback & Discrepancies
            {pendingCount > 0 && (
              <Badge variant="destructive">{pendingCount} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedbackData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No production feedback or discrepancies</p>
              <p className="text-sm mt-1">All material dispatches are aligned between Store and Production</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher No.</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Sent Qty</TableHead>
                  <TableHead>Received Qty</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbackData.map((feedback) => {
                  const sentQty = feedback.sent_quantity || feedback.required_quantity || 0;
                  const receivedQty = feedback.received_quantity || feedback.requested_quantity || 0;
                  const difference = receivedQty - sentQty;

                  return (
                    <TableRow key={feedback.id}>
                      <TableCell>{format(new Date(feedback.created_at), "MMM dd, yyyy HH:mm")}</TableCell>
                      <TableCell className="font-medium">
                        {feedback.voucher_number || feedback.production_orders?.voucher_number}
                      </TableCell>
                      <TableCell>
                        {feedback.product_name || feedback.production_orders?.products?.name}
                      </TableCell>
                      <TableCell className="font-mono">
                        {feedback.material_code || feedback.raw_materials?.material_code}
                      </TableCell>
                      <TableCell>
                        {feedback.material_name || feedback.raw_materials?.name}
                      </TableCell>
                      <TableCell className="font-medium text-blue-600">{sentQty}</TableCell>
                      <TableCell className="font-medium text-green-600">{receivedQty}</TableCell>
                      <TableCell className={`font-medium ${
                        difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {difference > 0 ? `+${difference}` : difference < 0 ? difference : '0'}
                      </TableCell>
                      <TableCell>{getDiscrepancyBadge(feedback)}</TableCell>
                      <TableCell>
                        {feedback.status === 'PENDING' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDiscrepancy(feedback)}
                          >
                            Review
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      {selectedDiscrepancy && (
        <Dialog open={!!selectedDiscrepancy} onOpenChange={() => setSelectedDiscrepancy(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Resolve Production Feedback</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm text-muted-foreground">Voucher:</span>
                  <p className="font-medium">{selectedDiscrepancy.voucher_number || selectedDiscrepancy.production_orders?.voucher_number}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Material:</span>
                  <p className="font-medium">{selectedDiscrepancy.material_code || selectedDiscrepancy.raw_materials?.material_code}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Sent by Store:</span>
                  <p className="font-medium text-blue-600">{selectedDiscrepancy.sent_quantity || selectedDiscrepancy.required_quantity}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Received by Production:</span>
                  <p className="font-medium text-green-600">{selectedDiscrepancy.received_quantity || selectedDiscrepancy.requested_quantity}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Resolution Notes</label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedDiscrepancy(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => resolveDiscrepancyMutation.mutate({
                    discrepancyId: selectedDiscrepancy.id,
                    action: 'reject',
                    notes: resolutionNotes
                  })}
                  disabled={resolveDiscrepancyMutation.isPending}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Reject Production Report
                </Button>
                <Button
                  onClick={() => resolveDiscrepancyMutation.mutate({
                    discrepancyId: selectedDiscrepancy.id,
                    action: 'accept',
                    notes: resolutionNotes
                  })}
                  disabled={resolveDiscrepancyMutation.isPending}
                  className="gap-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  Accept & Adjust Inventory
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ProductionFeedbackTab;
