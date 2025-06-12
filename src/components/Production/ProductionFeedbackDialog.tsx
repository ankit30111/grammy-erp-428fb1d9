
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Package } from "lucide-react";

interface ProductionFeedbackDialogProps {
  productionOrderId: string;
  voucherNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

const ProductionFeedbackDialog = ({ productionOrderId, voucherNumber, isOpen, onClose }: ProductionFeedbackDialogProps) => {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch materials sent to this production order
  const { data: sentMaterials = [] } = useQuery({
    queryKey: ["production-feedback-materials", productionOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
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
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionOrderId && isOpen,
  });

  // Enhanced production feedback mutation with inventory adjustment
  const saveProductionFeedback = useMutation({
    mutationFn: async (feedbackData: Array<{ kitItemId: string; actualReceived: number; materialId: string; sentQuantity: number }>) => {
      console.log("🎯 Processing production feedback with inventory adjustment...");
      console.log("📋 Feedback data:", feedbackData);

      // Update kit_items with actual received quantities and handle inventory adjustments
      for (const feedback of feedbackData) {
        console.log(`🔄 Processing feedback for material ${feedback.materialId}:`);
        console.log(`   - Sent: ${feedback.sentQuantity}`);
        console.log(`   - Received: ${feedback.actualReceived}`);
        
        const discrepancy = feedback.sentQuantity - feedback.actualReceived;
        console.log(`   - Discrepancy: ${discrepancy}`);

        // Update kit item with actual received quantity
        const { error: kitItemError } = await supabase
          .from("kit_items")
          .update({
            actual_quantity: feedback.actualReceived,
            verified_by_production: true
          })
          .eq("id", feedback.kitItemId);

        if (kitItemError) {
          console.error("❌ Error updating kit item:", kitItemError);
          throw kitItemError;
        }

        // CRITICAL: If there's a discrepancy, adjust inventory
        if (discrepancy !== 0) {
          console.log(`🔄 Adjusting inventory for discrepancy: ${discrepancy}`);
          
          if (discrepancy > 0) {
            // Production received less than sent - return excess to inventory
            console.log(`↩️ Returning ${discrepancy} units to inventory`);
            
            const { data: currentInventory, error: invFetchError } = await supabase
              .from("inventory")
              .select("quantity")
              .eq("raw_material_id", feedback.materialId)
              .single();

            if (invFetchError) {
              console.error("❌ Error fetching current inventory:", invFetchError);
              throw new Error(`Failed to fetch inventory for adjustment: ${invFetchError.message}`);
            }

            const newQuantity = currentInventory.quantity + discrepancy;
            
            const { error: invUpdateError } = await supabase
              .from("inventory")
              .update({
                quantity: newQuantity,
                last_updated: new Date().toISOString()
              })
              .eq("raw_material_id", feedback.materialId);

            if (invUpdateError) {
              console.error("❌ Error updating inventory:", invUpdateError);
              throw new Error(`Failed to update inventory: ${invUpdateError.message}`);
            }

            console.log(`✅ Inventory adjusted: +${discrepancy} units returned`);

            // Log the inventory adjustment
            await supabase
              .from("material_movements")
              .insert({
                raw_material_id: feedback.materialId,
                movement_type: "PRODUCTION_RETURN",
                quantity: discrepancy,
                reference_id: productionOrderId,
                reference_type: "PRODUCTION_ORDER",
                reference_number: voucherNumber,
                notes: `Production Feedback Return: Sent ${feedback.sentQuantity}, Received ${feedback.actualReceived}, Returned ${discrepancy} to inventory`
              });
          } else {
            // Production received more than sent (should not happen normally, but log it)
            console.log(`⚠️ Production received more than sent: ${Math.abs(discrepancy)} excess`);
          }
        }

        // Log any discrepancies in material movements for audit trail
        if (discrepancy !== 0) {
          await supabase
            .from("material_movements")
            .insert({
              raw_material_id: feedback.materialId,
              movement_type: discrepancy > 0 ? "PRODUCTION_SHORTAGE" : "PRODUCTION_EXCESS",
              quantity: Math.abs(discrepancy),
              reference_id: productionOrderId,
              reference_type: "PRODUCTION_ORDER",
              reference_number: voucherNumber,
              notes: `Production Feedback: Sent ${feedback.sentQuantity}, Received ${feedback.actualReceived}, Difference: ${discrepancy}`
            });
        }
      }

      console.log("✅ Production feedback processing completed");
    },
    onSuccess: () => {
      toast({
        title: "Production Feedback Saved",
        description: "Actual received quantities have been updated and inventory adjusted for discrepancies",
      });
      queryClient.invalidateQueries({ queryKey: ["production-feedback-materials"] });
      queryClient.invalidateQueries({ queryKey: ["dispatched-materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      onClose();
    },
    onError: (error: Error) => {
      console.error("❌ Failed to save production feedback:", error);
      toast({
        title: "Production Feedback Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuantityChange = (kitItemId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setReceivedQuantities(prev => ({
      ...prev,
      [kitItemId]: quantity
    }));
  };

  const handleSaveFeedback = () => {
    const feedbackData = sentMaterials
      .filter(item => receivedQuantities[item.id] !== undefined)
      .map(item => ({
        kitItemId: item.id,
        actualReceived: receivedQuantities[item.id] || 0,
        materialId: item.raw_material_id,
        sentQuantity: item.actual_quantity || 0
      }))
      .filter(feedback => feedback.actualReceived >= 0);

    if (feedbackData.length === 0) {
      toast({
        title: "No Feedback Entered",
        description: "Please enter actual received quantities",
        variant: "destructive",
      });
      return;
    }

    console.log("💾 Saving production feedback:", feedbackData);
    saveProductionFeedback.mutate(feedbackData);
  };

  // Group materials by kit preparation (dispatch batch)
  const groupedMaterials = sentMaterials.reduce((acc, item) => {
    const key = item.kit_preparation_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof sentMaterials>);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Production Feedback - {voucherNumber}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Enter the actual quantities received by production. Discrepancies will automatically adjust inventory levels.
          </div>

          {Object.entries(groupedMaterials).map(([kitPrepId, materials]) => (
            <div key={kitPrepId} className="space-y-4">
              <h3 className="font-medium">Dispatch Batch</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Quantity Sent</TableHead>
                    <TableHead>Actual Received</TableHead>
                    <TableHead>Difference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((item) => {
                    const actualReceived = receivedQuantities[item.id] !== undefined 
                      ? receivedQuantities[item.id] 
                      : item.verified_by_production 
                        ? item.actual_quantity 
                        : item.actual_quantity; // Default to sent quantity
                    const quantitySent = item.actual_quantity || 0;
                    const difference = quantitySent - actualReceived;
                    const isVerified = item.verified_by_production;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                        <TableCell>{item.raw_materials.name}</TableCell>
                        <TableCell className="font-medium">{quantitySent}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={quantitySent}
                            value={actualReceived}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            className="w-24"
                            disabled={isVerified}
                          />
                        </TableCell>
                        <TableCell className={`font-medium ${difference > 0 ? 'text-red-600' : difference < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {difference > 0 ? `-${difference}` : difference < 0 ? `+${Math.abs(difference)}` : '0'}
                          {difference > 0 && (
                            <div className="text-xs text-muted-foreground">Will return to inventory</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isVerified ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveFeedback}
              disabled={saveProductionFeedback.isPending}
            >
              Save Production Feedback
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionFeedbackDialog;
