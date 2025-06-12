
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useManualInventorySync = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      console.log("🔧 Starting enhanced manual inventory sync with store physical quantities...");
      
      // Get all store confirmed GRN items with their physical quantities
      const { data: confirmedItems, error } = await supabase
        .from("grn_items")
        .select(`
          raw_material_id,
          store_physical_quantity,
          accepted_quantity,
          store_confirmed_at,
          grn!inner(grn_number),
          raw_materials(material_code, name)
        `)
        .eq("store_confirmed", true);

      if (error) {
        console.error("❌ Error fetching confirmed items:", error);
        throw error;
      }

      console.log("📋 Store confirmed items to sync:", confirmedItems);

      // Get current inventory to check for existing records
      const { data: currentInventory, error: invError } = await supabase
        .from("inventory")
        .select("raw_material_id, quantity");

      if (invError) {
        console.error("❌ Error fetching current inventory:", invError);
        throw invError;
      }

      console.log("📦 Current inventory records:", currentInventory);

      // Create a map of current inventory quantities
      const inventoryMap = new Map();
      currentInventory?.forEach(item => {
        inventoryMap.set(item.raw_material_id, item.quantity);
      });

      // Calculate what the correct quantities should be based on STORE PHYSICAL QUANTITIES
      const correctQuantities = new Map();
      confirmedItems?.forEach(item => {
        const current = correctQuantities.get(item.raw_material_id) || 0;
        // Use store_physical_quantity if available, otherwise fall back to accepted_quantity
        const quantityToAdd = item.store_physical_quantity || item.accepted_quantity;
        const newTotal = current + quantityToAdd;
        correctQuantities.set(item.raw_material_id, newTotal);
        
        console.log(`🧮 Material ${item.raw_materials?.material_code}: Adding ${quantityToAdd} (Store Physical: ${item.store_physical_quantity}, IQC: ${item.accepted_quantity}), Total should be: ${newTotal}`);
        console.log(`   - GRN: ${item.grn?.grn_number}, Confirmed at: ${item.store_confirmed_at}`);
      });

      // Compare and fix any discrepancies
      let correctedCount = 0;
      for (const [materialId, correctQuantity] of correctQuantities) {
        const currentQuantity = inventoryMap.get(materialId) || 0;
        
        if (currentQuantity !== correctQuantity) {
          console.log(`🔧 FIXING DISCREPANCY for material ${materialId}:`);
          console.log(`   - Current in inventory: ${currentQuantity}`);
          console.log(`   - Should be (from Store Physical): ${correctQuantity}`);
          console.log(`   - Difference: ${correctQuantity - currentQuantity}`);
          
          // Update to correct quantity
          const { error: upsertError } = await supabase
            .from("inventory")
            .upsert({
              raw_material_id: materialId,
              quantity: correctQuantity,
              location: 'Main Store',
              last_updated: new Date().toISOString()
            }, {
              onConflict: 'raw_material_id'
            });

          if (upsertError) {
            console.error(`❌ Error fixing inventory for material ${materialId}:`, upsertError);
          } else {
            console.log(`✅ FIXED: Material ${materialId} quantity corrected to ${correctQuantity}`);
            correctedCount++;
          }
        } else {
          console.log(`✅ Material ${materialId} quantity is correct: ${correctQuantity}`);
        }
      }

      console.log("🎉 Enhanced manual inventory sync completed with store physical quantities");
      return { success: true, correctedItems: correctedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      console.log(`✅ Enhanced sync completed. Corrected ${result.correctedItems} materials.`);
    },
  });
};
