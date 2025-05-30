
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

export const useUpdateProjection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<{
      customer_id: string;
      product_id: string;
      quantity: number;
      delivery_month: string;
    }>}) => {
      const { data, error } = await supabase
        .from("projections")
        .update(updates)
        .eq("id", id)
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

export const useDeleteProjection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projections")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projections"] });
    },
  });
};
