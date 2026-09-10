
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePlantId } from "@/hooks/usePlantId";
import {
  fetchStockQuantity,
  getStockLocationId,
  postStockMovement,
} from "@/utils/stockLedger";

export const useInventoryMutations = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const plantId = usePlantId();

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
      if (!plantId) throw new Error("No active plant selected");
      console.log(`🔧 STOCK MOVEMENT: ${operation.toUpperCase()}`, { 
        materialId, 
        newQuantity, 
        referenceNumber,
        plantId,
      });

      // Post the difference against the MAIN location through the ledger.
      const current = await fetchStockQuantity(plantId, materialId, "MAIN");
      const delta = newQuantity - current;
      if (delta === 0) return;

      const locationId = await getStockLocationId(plantId, "MAIN");
      await postStockMovement({
        plant_id: plantId,
        raw_material_id: materialId,
        location_id: locationId,
        qty_delta: delta,
        movement_type:
          operation === "dispatch" ? "ISSUE" : operation === "return" ? "RETURN" : "ADJUSTMENT",
        reason_code: operation.toUpperCase(),
        reference_type: "MANUAL_ADJUSTMENT",
        reference_number: referenceNumber ?? null,
        notes: notes ?? null,
      });

      console.log(`✅ STOCK POSTED - new balance ${newQuantity}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
    },
    onError: (error: Error) => {
      console.error("❌ Failed to post stock movement:", error);
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
