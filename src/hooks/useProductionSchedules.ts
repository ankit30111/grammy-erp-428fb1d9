
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProductionSchedules = () => {
  return useQuery({
    queryKey: ["production-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_schedules")
        .select(`
          *,
          projections!projection_id (
            *,
            customers!customer_id (name),
            products!product_id (name)
          )
        `)
        .order("scheduled_date", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateProductionSchedule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (schedule: {
      projection_id: string;
      scheduled_date: string;
      production_line: string;
      quantity: number;
    }) => {
      const { data, error } = await supabase
        .from("production_schedules")
        .insert([schedule])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["projections"] });
    },
  });
};
