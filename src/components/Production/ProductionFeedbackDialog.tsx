
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

  // Save production feedback mutation
  const saveProductionFeedback = useMutation({
    mutationFn: async (feedbackData: Array<{ kitItemId: string; actualReceived: number; materialId: string }>) => {
      // Update kit_items with actual received quantities
      for (const feedback of feedbackData) {
        const { error } = await supabase
          .from("kit_items")
          .update({
            actual_quantity: feedback.actualReceived,
            verified_by_production: true
          })
          .eq("id", feedback.kitItemId);

        if (error) throw error;

        // Log any discrepancies in material movements
        const originalSent = sentMaterials.find(item => item.id === feedback.kitItemId)?.actual_quantity || 0;
        const discrepancy = originalSent - feedback.actualReceived;
        
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
              notes: `Production Feedback: Sent ${originalSent}, Received ${feedback.actualReceived}, Difference: ${discrepancy}`
            });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Production Feedback Saved",
        description: "Actual received quantities have been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["production-feedback-materials"] });
      queryClient.invalidateQueries({ queryKey: ["dispatched-materials"] });
      onClose();
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
    const feedbackData = Object.entries(receivedQuantities)
      .filter(([_, quantity]) => quantity > 0)
      .map(([kitItemId, actualReceived]) => {
        const item = sentMaterials.find(m => m.id === kitItemId);
        return {
          kitItemId,
          actualReceived,
          materialId: item?.raw_material_id || ""
        };
      });

    if (feedbackData.length === 0) {
      toast({
        title: "No Feedback Entered",
        description: "Please enter actual received quantities",
        variant: "destructive",
      });
      return;
    }

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
            Enter the actual quantities received by production. This helps track material losses and calculate remaining requirements accurately.
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
                    const actualReceived = receivedQuantities[item.id] || item.actual_quantity || 0;
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
