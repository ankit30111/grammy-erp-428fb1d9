
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useInventory = () => {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
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

      if (receivedError) throw receivedError;

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
      
      if (inventoryError) throw inventoryError;

      // Create a combined view to ensure all received materials are shown
      const materialMap = new Map();

      // Add all inventory data
      inventoryData?.forEach(item => {
        materialMap.set(item.raw_material_id, item);
      });

      // Add any received materials that might not be in inventory yet
      receivedMaterials?.forEach(item => {
        if (!materialMap.has(item.raw_material_id)) {
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
        }
      });

      return Array.from(materialMap.values());
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
      const { data, error } = await supabase
        .from("inventory")
        .update({ 
          quantity,
          last_updated: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
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
      // Get all store confirmed GRN items that should be in inventory
      const { data: confirmedItems, error } = await supabase
        .from("grn_items")
        .select(`
          raw_material_id,
          accepted_quantity,
          store_confirmed_at
        `)
        .eq("store_confirmed", true);

      if (error) throw error;

      // Group by material and sum quantities
      const materialTotals = new Map();
      confirmedItems?.forEach(item => {
        const current = materialTotals.get(item.raw_material_id) || 0;
        materialTotals.set(item.raw_material_id, current + item.accepted_quantity);
      });

      // Update or create inventory records
      for (const [materialId, totalQuantity] of materialTotals) {
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
          console.error(`Error updating inventory for material ${materialId}:`, upsertError);
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};
