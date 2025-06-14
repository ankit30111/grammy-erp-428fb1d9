
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useInventoryMutations = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateInventoryQuantity = useMutation({
    mutationFn: async ({ 
      materialId, 
      newQuantity, 
      operation,
      referenceNumber,
      notes 
    }: { 
      materialId: string; 
      newQuantity: number; 
      operation: 'dispatch' | 'return' | 'adjustment';
      referenceNumber?: string;
      notes?: string;
    }) => {
      console.log(`🔧 INVENTORY UPDATE: ${operation.toUpperCase()}`, { 
        materialId, 
        newQuantity, 
        referenceNumber 
      });

      // Update inventory quantity directly - NO MANUAL LOGGING
      const { error: updateError } = await supabase
        .from("inventory")
        .update({ 
          quantity: newQuantity,
          last_updated: new Date().toISOString()
        })
        .eq("raw_material_id", materialId);

      if (updateError) {
        console.error("❌ Error updating inventory:", updateError);
        throw updateError;
      }

      console.log(`✅ INVENTORY UPDATED - Quantity set to ${newQuantity}`);
      // Material movement logging will be handled by specific components with proper voucher numbers
    },
    onSuccess: () => {
      // Invalidate all inventory-related queries
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
    },
    onError: (error: Error) => {
      console.error("❌ Failed to update inventory:", error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    updateInventoryQuantity
  };
};
