
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";

export const useInventory = () => {
  const plantId = usePlantId();
  return useQuery({
    queryKey: ["inventory", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      console.log("🔍 Fetching inventory data...");
      
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
        .eq("plant_id", plantId!)
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

export const useRealTimeInventory = () => {
  const plantId = usePlantId();
  return useQuery({
    queryKey: ["inventory-real-time", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      console.log("🔍 Fetching ENHANCED real-time inventory data...");
      
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          raw_materials!raw_material_id (
            id,
            material_code,
            name,
            category
          )
        `)
        .eq("plant_id", plantId!)
        .order("last_updated", { ascending: false });
      
      if (error) {
        console.error("❌ Error fetching real-time inventory:", error);
        throw error;
      }

      console.log("📦 ENHANCED real-time inventory data:", data?.length, "items");
      return data || [];
    },
    refetchInterval: 2000, // Refresh every 2 seconds for real-time sync
  });
};
