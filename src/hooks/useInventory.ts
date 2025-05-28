
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useInventory = () => {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
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
      
      if (error) throw error;
      return data;
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
