
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUpdateInventory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      id,
      quantity,
    }: {
      id: string;
      quantity: number;
    }) => {
      console.log(`🔄 Updating inventory ${id} with quantity ${quantity}`);
      const { data, error } = await supabase
        .from("inventory")
        .update({ 
          quantity,
          last_updated: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();
      
      if (error) {
        console.error("❌ Error updating inventory:", error);
        throw error;
      }
      
      console.log("✅ Inventory updated:", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};

export const useInventoryDeduction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      rawMaterialId,
      quantityToDeduct,
      referenceId,
      referenceNumber,
      notes,
    }: {
      rawMaterialId: string;
      quantityToDeduct: number;
      referenceId: string;
      referenceNumber: string;
      notes?: string;
    }) => {
      console.log(`🔄 ENHANCED: Processing inventory deduction for material ${rawMaterialId}`);
      console.log(`   - Quantity to deduct: ${quantityToDeduct}`);
      console.log(`   - Reference: ${referenceNumber}`);
      
      // STEP 1: Get current inventory with proper error handling
      const { data: currentInventory, error: invError } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("raw_material_id", rawMaterialId)
        .single();

      if (invError) {
        console.error("❌ CRITICAL: Error fetching current inventory:", invError);
        throw new Error(`Failed to fetch inventory: ${invError.message}`);
      }

      const currentStock = currentInventory.quantity;
      console.log(`📊 Current stock for material ${rawMaterialId}: ${currentStock}`);
      
      if (currentStock < quantityToDeduct) {
        const errorMsg = `Insufficient stock: Available ${currentStock}, Required ${quantityToDeduct}`;
        console.error("❌ INSUFFICIENT STOCK:", errorMsg);
        throw new Error(errorMsg);
      }

      const newStock = currentStock - quantityToDeduct;
      console.log(`🔄 Planned stock reduction: ${currentStock} → ${newStock}`);

      // STEP 2: CRITICAL - Update inventory (this will trigger the logging automatically via database trigger)
      const { data: updatedInventory, error: updateError } = await supabase
        .from("inventory")
        .update({
          quantity: newStock,
          last_updated: new Date().toISOString()
        })
        .eq("raw_material_id", rawMaterialId)
        .select("quantity")
        .single();

      if (updateError) {
        console.error("❌ CRITICAL: Inventory update failed:", updateError);
        throw new Error(`Failed to update inventory: ${updateError.message}`);
      }

      console.log("✅ INVENTORY UPDATE SUCCESSFUL:", {
        material: rawMaterialId,
        previous: currentStock,
        new: updatedInventory.quantity,
        deducted: quantityToDeduct
      });

      // STEP 3: Additional manual logging for production voucher context
      const { error: movementError } = await supabase
        .rpc('log_material_movement', {
          p_raw_material_id: rawMaterialId,
          p_movement_type: "ISSUED_TO_PRODUCTION",
          p_quantity: quantityToDeduct,
          p_reference_id: referenceId,
          p_reference_type: "PRODUCTION_ORDER",
          p_reference_number: referenceNumber,
          p_notes: notes || `Material dispatched to production via voucher. Stock: ${currentStock} → ${newStock}`
        });

      if (movementError) {
        console.error("❌ Error logging production movement:", movementError);
        console.warn("⚠️ Production movement logging failed, but inventory deduction successful");
      } else {
        console.log("✅ PRODUCTION MOVEMENT LOGGED SUCCESSFULLY");
      }

      console.log(`✅ ENHANCED INVENTORY DEDUCTION COMPLETE: ${currentStock} → ${newStock}`);
      return {
        previousStock: currentStock,
        newStock,
        quantityDeducted: quantityToDeduct
      };
    },
    onSuccess: () => {
      console.log("🔄 INVALIDATING ALL INVENTORY QUERIES FOR REAL-TIME SYNC...");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
    },
  });
};
