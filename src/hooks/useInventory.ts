
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useInventory = () => {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      console.log("🔍 Fetching inventory data...");
      
      // Get the current inventory data with material details
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select(`
          *,
          raw_materials!raw_material_id (
            material_code,
            name,
            category
          )
        `)
        .order("last_updated", { ascending: false });
      
      if (inventoryError) {
        console.error("❌ Error fetching inventory:", inventoryError);
        throw inventoryError;
      }

      console.log("📊 Current inventory data:", inventoryData);
      return inventoryData || [];
    },
  });
};

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

// Updated manual sync with better error checking and duplicate prevention
export const useManualInventorySync = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      console.log("🔧 Starting manual inventory sync...");
      
      // Get all store confirmed GRN items with detailed logging
      const { data: confirmedItems, error } = await supabase
        .from("grn_items")
        .select(`
          raw_material_id,
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

      // Calculate what the correct quantities should be based on GRN data
      const correctQuantities = new Map();
      confirmedItems?.forEach(item => {
        const current = correctQuantities.get(item.raw_material_id) || 0;
        const newTotal = current + item.accepted_quantity;
        correctQuantities.set(item.raw_material_id, newTotal);
        
        console.log(`🧮 Material ${item.raw_materials?.material_code}: Adding ${item.accepted_quantity}, Total should be: ${newTotal}`);
        console.log(`   - GRN: ${item.grn?.grn_number}, Confirmed at: ${item.store_confirmed_at}`);
      });

      // Compare and fix any discrepancies
      for (const [materialId, correctQuantity] of correctQuantities) {
        const currentQuantity = inventoryMap.get(materialId) || 0;
        
        if (currentQuantity !== correctQuantity) {
          console.log(`🔧 FIXING DISCREPANCY for material ${materialId}:`);
          console.log(`   - Current in inventory: ${currentQuantity}`);
          console.log(`   - Should be (from GRN): ${correctQuantity}`);
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
          }
        } else {
          console.log(`✅ Material ${materialId} quantity is correct: ${correctQuantity}`);
        }
      }

      console.log("🎉 Manual inventory sync completed");
      return { success: true, correctedItems: correctQuantities.size };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      console.log(`✅ Sync completed. Processed ${result.correctedItems} materials.`);
    },
  });
};

// New function to check for specific material issues
export const useCheckMaterialInventory = () => {
  return useMutation({
    mutationFn: async (materialCode: string) => {
      console.log(`🔍 Checking inventory for material: ${materialCode}`);
      
      // Get material details
      const { data: material, error: materialError } = await supabase
        .from("raw_materials")
        .select("id, material_code, name")
        .eq("material_code", materialCode)
        .single();

      if (materialError) {
        console.error("❌ Material not found:", materialError);
        throw materialError;
      }

      // Get all GRN items for this material
      const { data: grnItems, error: grnError } = await supabase
        .from("grn_items")
        .select(`
          accepted_quantity,
          store_confirmed,
          store_confirmed_at,
          grn!inner(grn_number, received_date)
        `)
        .eq("raw_material_id", material.id)
        .eq("store_confirmed", true);

      if (grnError) throw grnError;

      // Get current inventory
      const { data: inventory, error: invError } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("raw_material_id", material.id)
        .maybeSingle();

      if (invError) throw invError;

      const totalFromGRN = grnItems?.reduce((sum, item) => sum + item.accepted_quantity, 0) || 0;
      const currentInventory = inventory?.quantity || 0;

      console.log(`📊 Analysis for ${materialCode}:`);
      console.log(`   - Total from GRN receipts: ${totalFromGRN}`);
      console.log(`   - Current inventory: ${currentInventory}`);
      console.log(`   - Discrepancy: ${currentInventory - totalFromGRN}`);
      console.log(`   - GRN entries:`, grnItems);

      return {
        materialCode,
        totalFromGRN,
        currentInventory,
        discrepancy: currentInventory - totalFromGRN,
        grnEntries: grnItems
      };
    },
  });
};
