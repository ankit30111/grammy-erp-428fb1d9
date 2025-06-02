
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useInventory = () => {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      console.log("🔍 Fetching inventory data...");
      
      // First get all raw materials that have been received by store
      const { data: receivedMaterials, error: receivedError } = await supabase
        .from("grn_items")
        .select(`
          raw_material_id,
          accepted_quantity,
          store_confirmed_at,
          raw_materials!inner (
            material_code,
            name,
            category
          )
        `)
        .eq("store_confirmed", true);

      if (receivedError) {
        console.error("❌ Error fetching received materials:", receivedError);
        throw receivedError;
      }

      console.log("📦 Store confirmed materials:", receivedMaterials);

      // Then get the current inventory data
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

      // Create a combined view to ensure all received materials are shown
      const materialMap = new Map();

      // Add all inventory data
      inventoryData?.forEach(item => {
        console.log(`📝 Adding inventory item: ${item.raw_materials?.material_code} - Qty: ${item.quantity}`);
        materialMap.set(item.raw_material_id, item);
      });

      // Add any received materials that might not be in inventory yet
      receivedMaterials?.forEach(item => {
        const existingItem = materialMap.get(item.raw_material_id);
        if (!existingItem) {
          console.log(`⚠️ Material ${item.raw_materials?.material_code} received but not in inventory - creating temp record`);
          // Create a temporary inventory record for display
          materialMap.set(item.raw_material_id, {
            id: `temp-${item.raw_material_id}`,
            raw_material_id: item.raw_material_id,
            quantity: 0, // This might need investigation
            location: 'Main Store',
            bin_location: null,
            minimum_stock: 0,
            last_updated: item.store_confirmed_at,
            created_at: item.store_confirmed_at,
            raw_materials: item.raw_materials
          });
        } else {
          console.log(`✅ Material ${item.raw_materials?.material_code} found in inventory with qty: ${existingItem.quantity}`);
        }
      });

      const result = Array.from(materialMap.values());
      console.log("🎯 Final inventory result:", result);
      return result;
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

// Add a new hook to manually sync inventory
export const useManualInventorySync = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      console.log("🔧 Starting manual inventory sync...");
      
      // Get all store confirmed GRN items that should be in inventory
      const { data: confirmedItems, error } = await supabase
        .from("grn_items")
        .select(`
          raw_material_id,
          accepted_quantity,
          store_confirmed_at
        `)
        .eq("store_confirmed", true);

      if (error) {
        console.error("❌ Error fetching confirmed items:", error);
        throw error;
      }

      console.log("📋 Store confirmed items to sync:", confirmedItems);

      // Group by material and sum quantities
      const materialTotals = new Map();
      confirmedItems?.forEach(item => {
        const current = materialTotals.get(item.raw_material_id) || 0;
        const newTotal = current + item.accepted_quantity;
        materialTotals.set(item.raw_material_id, newTotal);
        console.log(`🧮 Material ${item.raw_material_id}: ${current} + ${item.accepted_quantity} = ${newTotal}`);
      });

      // Update or create inventory records
      for (const [materialId, totalQuantity] of materialTotals) {
        console.log(`💾 Upserting inventory for material ${materialId} with quantity ${totalQuantity}`);
        
        const { error: upsertError } = await supabase
          .from("inventory")
          .upsert({
            raw_material_id: materialId,
            quantity: totalQuantity,
            location: 'Main Store',
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'raw_material_id'
          });

        if (upsertError) {
          console.error(`❌ Error updating inventory for material ${materialId}:`, upsertError);
        } else {
          console.log(`✅ Successfully updated inventory for material ${materialId}`);
        }
      }

      console.log("🎉 Manual inventory sync completed");
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};
