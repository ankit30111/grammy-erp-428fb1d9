
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

// Validation function to check if projection can be deleted
export const useValidateProjectionDeletion = () => {
  return useMutation({
    mutationFn: async (projectionId: string) => {
      // Check production status through the chain
      const { data: schedules, error: scheduleError } = await supabase
        .from("production_schedules")
        .select(`
          id,
          production_orders!production_schedule_id (
            id,
            status,
            kit_preparation!production_order_id (
              id,
              status
            )
          )
        `)
        .eq("projection_id", projectionId);

      if (scheduleError) throw scheduleError;

      // If no production schedules exist, deletion is allowed
      if (!schedules || schedules.length === 0) {
        return { canDelete: true, reason: "" };
      }

      // Check production orders and kit preparation status
      for (const schedule of schedules) {
        const orders = schedule.production_orders || [];
        
        for (const order of orders) {
          // Check if production has started or completed
          if (order.status === "IN_PROGRESS") {
            return { 
              canDelete: false, 
              reason: "Cannot delete: Production is currently in progress" 
            };
          }
          
          if (order.status === "COMPLETED") {
            return { 
              canDelete: false, 
              reason: "Cannot delete: Production has already been completed" 
            };
          }

          // Check if materials have been sent to production
          const kitPreps = order.kit_preparation || [];
          for (const kit of kitPreps) {
            if (kit.status === "MATERIALS_SENT" || kit.status === "SENT") {
              return { 
                canDelete: false, 
                reason: "Cannot delete: Materials have already been sent to production" 
              };
            }
          }
        }
      }

      // If we reach here, deletion is allowed
      return { canDelete: true, reason: "" };
    },
  });
};

export const useDeleteProjection = () => {
  const queryClient = useQueryClient();
  const validateDeletion = useValidateProjectionDeletion();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // First validate if deletion is allowed
      const validation = await validateDeletion.mutateAsync(id);
      
      if (!validation.canDelete) {
        throw new Error(validation.reason);
      }

      // If validation passes, proceed with deletion
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
