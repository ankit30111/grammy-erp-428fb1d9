
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProjections = () => {
  return useQuery({
    queryKey: ["projections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projections")
        .select(`
          *,
          customers!customer_id (name),
          products!product_id (name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateProjection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (projection: {
      customer_id: string;
      product_id: string;
      quantity: number;
      delivery_month: string;
    }) => {
      const { data, error } = await supabase
        .from("projections")
        .insert([projection])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projections"] });
    },
  });
};
