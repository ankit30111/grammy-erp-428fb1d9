
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useInventorySync = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const syncRawMaterialsToInventory = useMutation({
    mutationFn: async () => {
      // Get all raw materials
      const { data: rawMaterials, error: rmError } = await supabase
        .from("raw_materials")
        .select("id, material_code, name")
        .eq("is_active", true);

      if (rmError) throw rmError;

      // Get existing inventory records
      const { data: existingInventory, error: invError } = await supabase
        .from("inventory")
        .select("raw_material_id");

      if (invError) throw invError;

      // Find raw materials without inventory records
      const existingMaterialIds = new Set(
        existingInventory?.map(item => item.raw_material_id) || []
      );

      const materialsWithoutInventory = rawMaterials?.filter(
        material => !existingMaterialIds.has(material.id)
      ) || [];

      if (materialsWithoutInventory.length === 0) {
        return { created: 0, message: "All raw materials already have inventory records" };
      }

      // Create inventory records for materials without them
      const inventoryRecords = materialsWithoutInventory.map(material => ({
        raw_material_id: material.id,
        quantity: 0,
        minimum_stock: 10, // Default minimum stock
        location: "Main Warehouse",
        bin_location: "TBD",
      }));

      const { error: insertError } = await supabase
        .from("inventory")
        .insert(inventoryRecords);

      if (insertError) throw insertError;

      return { 
        created: materialsWithoutInventory.length, 
        message: `Created inventory records for ${materialsWithoutInventory.length} raw materials` 
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: "Inventory Sync Complete",
        description: result.message,
      });
    },
    onError: (error) => {
      console.error("Error syncing inventory:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync raw materials to inventory",
        variant: "destructive",
      });
    },
  });

  return {
    syncRawMaterialsToInventory,
    isLoading: syncRawMaterialsToInventory.isPending,
  };
};
