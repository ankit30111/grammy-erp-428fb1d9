
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useKitPreparation = (productionOrderId?: string) => {
  return useQuery({
    queryKey: ["kit-preparation", productionOrderId],
    queryFn: async () => {
      if (!productionOrderId) return null;
      
      const { data, error } = await supabase
        .from("kit_preparation")
        .select(`
          *,
          kit_items (
            *,
            raw_materials (
              id,
              material_code,
              name
            )
          )
        `)
        .eq("production_order_id", productionOrderId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!productionOrderId,
  });
};

export const useCreateKitPreparation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productionOrderId: string) => {
      const { data, error } = await supabase
        .from("kit_preparation")
        .insert({
          production_order_id: productionOrderId,
          status: "PREPARING"
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kit-preparation"] });
    },
  });
};

export const useUpdateKitItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      kitItemId,
      issuedQuantity,
    }: {
      kitItemId: string;
      issuedQuantity: number;
    }) => {
      const { data, error } = await supabase
        .from("kit_items")
        .update({ 
          issued_quantity: issuedQuantity,
          updated_at: new Date().toISOString()
        })
        .eq("id", kitItemId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kit-preparation"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};
