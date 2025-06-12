
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useProductionMaterialReceipts = (productionOrderId: string) => {
  const queryClient = useQueryClient();

  // Fetch production material receipts
  const { data: productionReceipts = [], isLoading } = useQuery({
    queryKey: ["production-material-receipts", productionOrderId],
    queryFn: async () => {
      if (!productionOrderId) return [];

      console.log("🔍 Fetching production material receipts for:", productionOrderId);

      const { data, error } = await supabase
        .from("production_material_receipts")
        .select("*")
        .eq("production_order_id", productionOrderId);

      if (error) {
        console.error("❌ Error fetching production receipts:", error);
        throw error;
      }

      console.log("📦 Production receipts fetched:", data);
      return data || [];
    },
    enabled: !!productionOrderId,
    refetchInterval: 3000, // Real-time updates
  });

  // Enhanced log production material receipt with better error handling
  const logProductionReceiptMutation = useMutation({
    mutationFn: async ({ 
      rawMaterialId, 
      quantity, 
      notes 
    }: { 
      rawMaterialId: string; 
      quantity: number; 
      notes?: string;
    }) => {
      console.log("📝 Logging production material receipt with enhanced safety:", {
        productionOrderId,
        rawMaterialId,
        quantity,
        notes
      });

      // First check if receipt already exists
      const { data: existingReceipt } = await supabase
        .from("production_material_receipts")
        .select("*")
        .eq("production_order_id", productionOrderId)
        .eq("raw_material_id", rawMaterialId)
        .single();

      if (existingReceipt) {
        // Update existing receipt
        const { error } = await supabase
          .from("production_material_receipts")
          .update({
            quantity_received: existingReceipt.quantity_received + quantity,
            notes: notes || existingReceipt.notes,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingReceipt.id);

        if (error) {
          console.error("❌ Error updating production receipt:", error);
          throw error;
        }
      } else {
        // Create new receipt
        const { error } = await supabase
          .from("production_material_receipts")
          .insert({
            production_order_id: productionOrderId,
            raw_material_id: rawMaterialId,
            quantity_received: quantity,
            notes: notes
          });

        if (error) {
          console.error("❌ Error creating production receipt:", error);
          throw error;
        }
      }

      // Use the existing log_material_movement function
      const { error: movementError } = await supabase.rpc("log_material_movement", {
        p_raw_material_id: rawMaterialId,
        p_movement_type: "PRODUCTION_RECEIPT_VERIFIED",
        p_quantity: quantity,
        p_reference_id: productionOrderId,
        p_reference_type: "PRODUCTION_VOUCHER",
        p_reference_number: `RECEIPT-${productionOrderId.slice(0, 8)}`,
        p_notes: notes || "Material receipt verified by production team"
      });

      if (movementError) {
        console.warn("⚠️ Movement logging failed (non-critical):", movementError);
        // Don't throw error for movement logging failures
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-material-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["material-dispatch-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      queryClient.invalidateQueries({ queryKey: ["production-discrepancies"] });
      toast.success("Material receipt logged successfully");
    },
    onError: (error) => {
      console.error("❌ Failed to log production receipt:", error);
      toast.error(`Failed to log material receipt: ${error.message}`);
    }
  });

  const getReceivedQuantity = (rawMaterialId: string): number => {
    const receipt = productionReceipts.find(r => r.raw_material_id === rawMaterialId);
    return receipt?.quantity_received || 0;
  };

  return {
    productionReceipts,
    isLoading,
    logProductionReceipt: logProductionReceiptMutation.mutate,
    isLoggingReceipt: logProductionReceiptMutation.isPending,
    getReceivedQuantity
  };
};
