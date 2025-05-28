
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProductionOrders = () => {
  return useQuery({
    queryKey: ["production-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          production_schedules!production_schedule_id (
            *,
            projections!projection_id (
              customers!customer_id (name),
              products!product_id (name)
            )
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateProductionOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        status: string;
        kit_status: string;
      }>;
    }) => {
      const { data, error } = await supabase
        .from("production_orders")
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    },
  });
};
