
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, Settings, TrendingUp } from "lucide-react";
import ProductionStatusSummary from "./ProductionStatusSummary";
import ProductionFeedbackDialog from "./ProductionFeedbackDialog";
import EnhancedBOMTable from "./EnhancedBOMTable";
import EnhancedDispatchReceiptHandler from "./EnhancedDispatchReceiptHandler";

interface ProductionVoucherDetailViewProps {
  production: any;
  isOpen: boolean;
  onClose: () => void;
}

const ProductionVoucherDetailView = ({ production, isOpen, onClose }: ProductionVoucherDetailViewProps) => {
  const [lineAssignments, setLineAssignments] = useState<Record<string, string>>({});
  const [showStatusSummary, setShowStatusSummary] = useState(false);
  const [showProductionFeedback, setShowProductionFeedback] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const productionLines = ["Line 1", "Line 2", "Sub Assembly 1", "Sub Assembly 2"];

  // Initialize line assignments from existing production order data
  useEffect(() => {
    if (production?.production_lines) {
      try {
        const existingAssignments = typeof production.production_lines === 'string' 
          ? JSON.parse(production.production_lines) 
          : production.production_lines;
        setLineAssignments(existingAssignments || {});
      } catch (error) {
        console.log("No existing line assignments found");
        setLineAssignments({});
      }
    }
  }, [production]);

  // Save line assignments mutation
  const saveLineAssignments = useMutation({
    mutationFn: async () => {
      console.log("🏭 Saving line assignments:", lineAssignments);
      
      const { error } = await supabase
        .from("production_orders")
        .update({
          production_lines: lineAssignments,
          status: 'IN_PROGRESS',
          updated_at: new Date().toISOString()
        })
        .eq("id", production.id);
      
      if (error) {
        console.error("❌ Error updating production order:", error);
        throw error;
      }
      
      console.log("✅ Line assignments saved and status updated to IN_PROGRESS");
    },
    onSuccess: () => {
      toast({
        title: "Line Assignments Saved",
        description: "Production line assignments have been updated and production started",
      });
      
      queryClient.invalidateQueries({ queryKey: ["production-lines-overview"] });
      queryClient.invalidateQueries({ queryKey: ["line-production"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-productions"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Production Voucher Details - {production?.voucher_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Voucher Information */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Product:</span>
                  <p className="font-medium">{production?.products?.name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Production Quantity:</span>
                  <p className="font-medium">{production?.quantity}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Scheduled Date:</span>
                  <p className="font-medium">{new Date(production?.scheduled_date).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Material Receipt Handler */}
          <EnhancedDispatchReceiptHandler 
            productionOrderId={production.id}
            voucherNumber={production.voucher_number}
          />

          {/* Enhanced BOM Table with Material Categorization */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Material Requirements - Grouped by BOM Category</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowProductionFeedback(true)}
                  className="gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Production Feedback
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowStatusSummary(true)}
                  className="gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Production Status
                </Button>
              </div>
            </div>
            
            <EnhancedBOMTable 
              productionOrderId={production.id}
              productId={production.product_id}
              productionQuantity={production.quantity}
            />
          </div>

          {/* Line Assignment Section */}
          <Card>
            <CardHeader>
              <CardTitle>Production Line Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {["sub_assembly", "main_assembly", "accessory"].map((category) => (
                  <div key={category} className="space-y-2">
                    <label className="text-sm font-medium capitalize">
                      {category.replace('_', ' ')} Line:
                    </label>
                    <Select
                      value={lineAssignments[category] || ""}
                      onValueChange={(value) => setLineAssignments(prev => ({ ...prev, [category]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Line" />
                      </SelectTrigger>
                      <SelectContent>
                        {productionLines.map((line) => (
                          <SelectItem key={line} value={line}>
                            {line}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              onClick={() => {
                if (Object.keys(lineAssignments).length > 0) {
                  saveLineAssignments.mutate();
                }
              }}
              disabled={saveLineAssignments.isPending}
            >
              Save Line Assignments & Start Production
            </Button>
          </div>
        </div>

        {/* Production Status Summary Dialog */}
        {showStatusSummary && (
          <ProductionStatusSummary
            productionId={production.id}
            voucherNumber={production.voucher_number}
            isOpen={showStatusSummary}
            onClose={() => setShowStatusSummary(false)}
          />
        )}

        {/* Production Feedback Dialog */}
        {showProductionFeedback && (
          <ProductionFeedbackDialog
            productionOrderId={production.id}
            voucherNumber={production.voucher_number}
            isOpen={showProductionFeedback}
            onClose={() => setShowProductionFeedback(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProductionVoucherDetailView;
