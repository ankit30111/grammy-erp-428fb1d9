
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Package, AlertTriangle, CheckCircle, ArrowLeftRight } from "lucide-react";

interface ProductionFeedbackDialogProps {
  productionOrderId: string;
  voucherNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

const ProductionFeedbackDialog = ({ productionOrderId, voucherNumber, isOpen, onClose }: ProductionFeedbackDialogProps) => {
  const [feedback, setFeedback] = useState<Record<string, { actualUsed: number; reason: string }>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch production order with BOM and sent materials
  const { data: productionData, isLoading } = useQuery({
    queryKey: ["production-feedback", productionOrderId],
    queryFn: async () => {
      console.log("🔍 Fetching production feedback data for:", productionOrderId);
      
      // Get production order with BOM
      const { data: prodOrder, error: prodError } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!product_id (
            name,
            bom!product_id (
              *,
              raw_materials!raw_material_id (
                id,
                material_code,
                name,
                category
              )
            )
          )
        `)
        .eq("id", productionOrderId)
        .single();

      if (prodError) throw prodError;

      // Get materials sent by store
      const { data: sentMaterials, error: sentError } = await supabase
        .from("kit_items")
        .select(`
          *,
          raw_materials!inner(
            id,
            material_code,
            name,
            category
          ),
          kit_preparation!inner(
            production_order_id
          )
        `)
        .eq("kit_preparation.production_order_id", productionOrderId);

      if (sentError) throw sentError;

      console.log("📊 Production feedback data:", { prodOrder, sentMaterials });
      return { productionOrder: prodOrder, sentMaterials };
    },
    enabled: !!productionOrderId && isOpen,
  });

  // ENHANCED: Production feedback submission with inventory adjustment
  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: Array<{ materialId: string; sentQuantity: number; actualUsed: number; reason: string }>) => {
      console.log("🎯 PROCESSING PRODUCTION FEEDBACK WITH INVENTORY ADJUSTMENT...");
      console.log("📋 Feedback data:", feedbackData);

      for (const feedback of feedbackData) {
        console.log(`🔄 Processing feedback for material ${feedback.materialId}:`);
        console.log(`   - Sent: ${feedback.sentQuantity}`);
        console.log(`   - Actually Used: ${feedback.actualUsed}`);
        console.log(`   - Difference: ${feedback.sentQuantity - feedback.actualUsed}`);
        console.log(`   - Reason: ${feedback.reason}`);
        
        const excessQuantity = feedback.sentQuantity - feedback.actualUsed;

        // Update kit item with actual used quantity
        const { error: kitUpdateError } = await supabase
          .from("kit_items")
          .update({
            actual_quantity: feedback.actualUsed,
            verified_by_production: true
          })
          .eq("raw_material_id", feedback.materialId)
          .eq("kit_preparation_id", (await supabase
            .from("kit_preparation")
            .select("id")
            .eq("production_order_id", productionOrderId)
            .single()).data?.id);

        if (kitUpdateError) {
          console.error("❌ Error updating kit item:", kitUpdateError);
          throw new Error(`Failed to update kit item: ${kitUpdateError.message}`);
        }

        // CRITICAL: If production used less than sent, return excess to inventory
        if (excessQuantity > 0) {
          console.log(`🔄 RETURNING EXCESS TO INVENTORY: ${excessQuantity} units`);
          
          // Get current inventory
          const { data: currentInventory, error: invFetchError } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("raw_material_id", feedback.materialId)
            .single();

          if (invFetchError) {
            console.error("❌ Error fetching current inventory:", invFetchError);
            throw new Error(`Failed to fetch inventory for return: ${invFetchError.message}`);
          }

          const newQuantity = currentInventory.quantity + excessQuantity;
          
          // Update inventory with returned quantity
          const { error: invUpdateError } = await supabase
            .from("inventory")
            .update({
              quantity: newQuantity,
              last_updated: new Date().toISOString()
            })
            .eq("raw_material_id", feedback.materialId);

          if (invUpdateError) {
            console.error("❌ Error updating inventory:", invUpdateError);
            throw new Error(`Failed to return excess to inventory: ${invUpdateError.message}`);
          }

          console.log(`✅ EXCESS RETURNED TO INVENTORY: +${excessQuantity} units`);

          // Log the inventory return movement
          const { error: movementError } = await supabase
            .from("material_movements")
            .insert({
              raw_material_id: feedback.materialId,
              movement_type: "PRODUCTION_RETURN",
              quantity: excessQuantity,
              reference_id: productionOrderId,
              reference_type: "PRODUCTION_ORDER",
              reference_number: voucherNumber,
              notes: `Production Feedback Return: Sent ${feedback.sentQuantity}, Used ${feedback.actualUsed}, Returned ${excessQuantity}. Reason: ${feedback.reason}`
            });

          if (movementError) {
            console.error("❌ Error logging return movement:", movementError);
            // Don't fail the transaction for logging errors
          } else {
            console.log("✅ RETURN MOVEMENT LOGGED SUCCESSFULLY");
          }
        }

        // If production used more than sent, log material request
        if (excessQuantity < 0) {
          const shortageQuantity = Math.abs(excessQuantity);
          console.log(`📝 LOGGING MATERIAL REQUEST FOR SHORTAGE: ${shortageQuantity} units`);
          
          await supabase
            .from("material_requests")
            .insert({
              production_order_id: productionOrderId,
              raw_material_id: feedback.materialId,
              requested_quantity: shortageQuantity,
              reason: `Production feedback shortage: ${feedback.reason}`,
              status: 'PENDING'
            });
        }
      }

      console.log("✅ PRODUCTION FEEDBACK PROCESSING COMPLETED");
    },
    onSuccess: () => {
      toast({
        title: "Production Feedback Submitted",
        description: "Feedback processed and inventory adjusted accordingly",
      });
      
      // Refresh all related queries
      queryClient.invalidateQueries({ queryKey: ["production-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      queryClient.invalidateQueries({ queryKey: ["sent-materials-detail"] });
      
      setFeedback({});
      onClose();
    },
    onError: (error: Error) => {
      console.error("❌ Failed to submit production feedback:", error);
      toast({
        title: "Feedback Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFeedbackChange = (materialId: string, field: 'actualUsed' | 'reason', value: string | number) => {
    setFeedback(prev => ({
      ...prev,
      [materialId]: {
        ...prev[materialId],
        [field]: value,
        actualUsed: field === 'actualUsed' ? Number(value) : (prev[materialId]?.actualUsed || 0),
        reason: field === 'reason' ? String(value) : (prev[materialId]?.reason || '')
      }
    }));
  };

  const handleSubmitFeedback = () => {
    if (!productionData?.sentMaterials) return;

    const feedbackToSubmit = productionData.sentMaterials
      .filter(item => feedback[item.raw_material_id])
      .map(item => ({
        materialId: item.raw_material_id,
        sentQuantity: item.actual_quantity,
        actualUsed: feedback[item.raw_material_id].actualUsed,
        reason: feedback[item.raw_material_id].reason
      }))
      .filter(f => f.actualUsed !== f.sentQuantity); // Only submit if there's a difference

    if (feedbackToSubmit.length === 0) {
      toast({
        title: "No Changes to Report",
        description: "Please provide feedback for materials where actual usage differs from sent quantity",
        variant: "destructive",
      });
      return;
    }

    console.log("🚀 Submitting production feedback:", feedbackToSubmit);
    submitFeedbackMutation.mutate(feedbackToSubmit);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Loading Production Feedback...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Package className="h-12 w-12 text-muted-foreground animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { productionOrder, sentMaterials } = productionData || {};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Production Feedback - {voucherNumber}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Production Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Product:</span>
                  <p className="font-medium">{productionOrder?.products?.name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Production Quantity:</span>
                  <p className="font-medium">{productionOrder?.quantity}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant="outline">{productionOrder?.status}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Material Usage Feedback */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Material Usage Feedback & Inventory Adjustment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Quantity Sent</TableHead>
                    <TableHead>Actually Used</TableHead>
                    <TableHead>Difference</TableHead>
                    <TableHead>Reason/Notes</TableHead>
                    <TableHead>Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sentMaterials?.map((item) => {
                    const sentQty = item.actual_quantity;
                    const actualUsed = feedback[item.raw_material_id]?.actualUsed ?? sentQty;
                    const difference = sentQty - actualUsed;
                    const isAlreadyVerified = item.verified_by_production;
                    
                    return (
                      <TableRow key={item.raw_material_id} className={isAlreadyVerified ? "bg-gray-50" : ""}>
                        <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                        <TableCell>{item.raw_materials.name}</TableCell>
                        <TableCell className="font-medium text-blue-600">{sentQty}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={actualUsed}
                            onChange={(e) => handleFeedbackChange(item.raw_material_id, 'actualUsed', e.target.value)}
                            className="w-24"
                            min="0"
                            disabled={isAlreadyVerified}
                          />
                        </TableCell>
                        <TableCell className={`font-medium ${
                          difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {difference > 0 ? `+${difference}` : difference < 0 ? difference : '0'}
                          {difference > 0 && <div className="text-xs text-green-600">Return to inventory</div>}
                          {difference < 0 && <div className="text-xs text-red-600">Request additional</div>}
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={feedback[item.raw_material_id]?.reason || ''}
                            onChange={(e) => handleFeedbackChange(item.raw_material_id, 'reason', e.target.value)}
                            placeholder="Reason for difference..."
                            className="min-h-[60px]"
                            disabled={isAlreadyVerified}
                          />
                        </TableCell>
                        <TableCell>
                          {isAlreadyVerified ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </Badge>
                          ) : difference === 0 ? (
                            <Badge variant="secondary">No Change</Badge>
                          ) : difference > 0 ? (
                            <Badge variant="default" className="gap-1">
                              <ArrowLeftRight className="h-3 w-3" />
                              Return {difference}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Need {Math.abs(difference)}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitFeedback}
                  disabled={submitFeedbackMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {submitFeedbackMutation.isPending ? "Processing..." : "Submit Feedback & Adjust Inventory"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionFeedbackDialog;
