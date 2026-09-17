import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProjections = () => {
  return useQuery({
    queryKey: ["projections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projections")
        .select(
          `*,
           customers!customer_id ( id, name ),
           parts!part_id ( id, name, part_code, uom )`,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useCreateProjection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projection: {
      customer_id: string;
      part_id: string;
      quantity: number;
      month: string;
      notes?: string;
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
      queryClient.invalidateQueries({ queryKey: ["shortages"] });
    },
  });
};

export const useUpdateProjection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<{
      customer_id: string;
      part_id: string;
      quantity: number;
      month: string;
      notes: string;
      status: string;
    }>}) => {
      // scheduled_quantity / vouchered_quantity / produced_quantity are maintained by triggers.
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
      queryClient.invalidateQueries({ queryKey: ["shortages"] });
    },
  });
};

/** A projection can be deleted until its production has moved past planning. */
export const useValidateProjectionDeletion = () => {
  return useMutation({
    mutationFn: async (projectionId: string) => {
      const { data: schedules, error: scheduleError } = await supabase
        .from("production_schedules")
        .select("id, status, scheduled_date")
        .eq("projection_id", projectionId);

      if (scheduleError) throw scheduleError;

      const blocking = (schedules || []).filter(
        (s) => s.status !== "PLANNED" && s.status !== "CANCELLED",
      );
      if (blocking.length > 0) {
        return {
          canDelete: false,
          reason: `Cannot delete: ${blocking.length} scheduled production(s) have already moved past planning (${blocking
            .map((s) => s.status)
            .join(", ")}).`,
        };
      }

      const { data: orders, error: orderError } = await supabase
        .from("production_orders")
        .select("voucher_number, status")
        .eq("projection_id", projectionId);

      if (orderError) throw orderError;

      const activeOrder = (orders || []).find(
        (o) => o.status !== "PLANNED" && o.status !== "CANCELLED",
      );
      if (activeOrder) {
        return {
          canDelete: false,
          reason: `Cannot delete: voucher ${activeOrder.voucher_number} is ${activeOrder.status}.`,
        };
      }

      return { canDelete: true, reason: "" };
    },
  });
};

export const useDeleteProjection = () => {
  const queryClient = useQueryClient();
  const validateDeletion = useValidateProjectionDeletion();

  return useMutation({
    mutationFn: async (id: string) => {
      const validation = await validateDeletion.mutateAsync(id);
      if (!validation.canDelete) throw new Error(validation.reason);

      const { error } = await supabase.from("projections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projections"] });
      queryClient.invalidateQueries({ queryKey: ["production-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
      queryClient.invalidateQueries({ queryKey: ["shortages"] });
    },
  });
};
