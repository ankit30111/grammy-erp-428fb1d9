
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

  // Log production material receipt
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
      console.log("📝 Logging production material receipt:", {
        productionOrderId,
        rawMaterialId,
        quantity,
        notes
      });

      const { error } = await supabase.rpc("log_production_material_receipt", {
        p_production_order_id: productionOrderId,
        p_raw_material_id: rawMaterialId,
        p_quantity: quantity,
        p_received_by: null, // Will be handled by auth context later
        p_notes: notes
      });

      if (error) {
        console.error("❌ Error logging production receipt:", error);
        throw error;
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-material-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["material-dispatch-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      toast.success("Material receipt logged successfully");
    },
    onError: (error) => {
      console.error("❌ Failed to log production receipt:", error);
      toast.error("Failed to log material receipt");
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
