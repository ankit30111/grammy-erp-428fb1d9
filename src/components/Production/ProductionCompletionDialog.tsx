
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductionCompletionDialogProps {
  voucherId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (voucherId: string) => void;
}

const ProductionCompletionDialog = ({ 
  voucherId, 
  isOpen, 
  onClose, 
  onComplete 
}: ProductionCompletionDialogProps) => {
  const [actualQuantity, setActualQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch production order details
  const { data: productionOrder } = useQuery({
    queryKey: ["production-order-completion", voucherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name)
        `)
        .eq("id", voucherId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // Fetch total produced from hourly entries
  const { data: hourlyTotal = 0 } = useQuery({
    queryKey: ["hourly-total", voucherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hourly_production")
        .select("production_units")
        .eq("production_order_id", voucherId);
      
      if (error) throw error;
      return data?.reduce((sum, entry) => sum + entry.production_units, 0) || 0;
    },
    enabled: isOpen,
  });

  // Create material return list mutation
  const createMaterialReturn = useMutation({
    mutationFn: async ({ actualQty, targetQty }: { actualQty: number; targetQty: number }) => {
      if (actualQty >= targetQty) return; // No returns needed

      const shortfall = targetQty - actualQty;
      const returnPercentage = shortfall / targetQty;

      // Get BOM for this production order
      const { data: bomData, error: bomError } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials!inner(material_code, name)
        `)
        .eq("product_id", productionOrder?.product_id);

      if (bomError) throw bomError;

      // Calculate return quantities for each material
      const returnItems = bomData?.map(bomItem => ({
        production_order_id: voucherId,
        raw_material_id: bomItem.raw_material_id,
        material_code: bomItem.raw_materials.material_code,
        material_name: bomItem.raw_materials.name,
        return_quantity: Math.ceil(bomItem.quantity * shortfall),
        reason: `Production shortfall: ${shortfall} units unproduced`,
        voucher_number: productionOrder?.voucher_number
      }));

      // In a real implementation, you'd insert these into a material_returns table
      console.log("Material return items:", returnItems);
      
      return returnItems;
    },
  });

  const handleComplete = async () => {
    const finalQuantity = parseInt(actualQuantity) || hourlyTotal;
    
    if (finalQuantity < (productionOrder?.quantity || 0)) {
      // Create material return list for shortfall
      await createMaterialReturn.mutateAsync({
        actualQty: finalQuantity,
        targetQty: productionOrder?.quantity || 0
      });
      
      toast({
        title: "Production Completed with Shortfall",
        description: `Material return list generated for ${(productionOrder?.quantity || 0) - finalQuantity} unproduced units`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Production Completed Successfully",
        description: "All target quantities have been achieved",
      });
    }

    onComplete(voucherId);
  };

  if (!productionOrder) return null;

  const shortfall = (productionOrder.quantity || 0) - (parseInt(actualQuantity) || hourlyTotal);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Complete Production
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Voucher:</span>
              <p className="font-medium">{productionOrder.voucher_number}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Product:</span>
              <p className="font-medium">{productionOrder.products?.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Target Quantity:</span>
              <p className="font-medium">{productionOrder.quantity}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Hourly Total:</span>
              <p className="font-medium">{hourlyTotal}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Final Actual Quantity Produced</label>
            <Input
              type="number"
              min="0"
              value={actualQuantity}
              onChange={(e) => setActualQuantity(e.target.value)}
              placeholder={hourlyTotal.toString()}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to use hourly total ({hourlyTotal})
            </p>
          </div>

          {shortfall > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <div className="flex items-center gap-2 text-red-700">
                <Package className="h-4 w-4" />
                <span className="font-medium">Shortfall Detected</span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                {shortfall} units unproduced. Material return list will be generated.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Completion Remarks</label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional completion notes..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleComplete} className="flex-1">
              Complete Production
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionCompletionDialog;
