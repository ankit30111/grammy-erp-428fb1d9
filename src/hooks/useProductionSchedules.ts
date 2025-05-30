
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useProductionSchedules = () => {
  return useQuery({
    queryKey: ['production_schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_schedules')
        .select(`
          *,
          projections (
            id,
            products (
              id,
              name,
              product_code
            ),
            customers (
              id,
              name
            )
          )
        `)
        .order('scheduled_date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateProductionSchedule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleData: any) => {
      const { data, error } = await supabase
        .from('production_schedules')
        .insert({
          projection_id: scheduleData.projection_id,
          scheduled_date: scheduleData.scheduled_date,
          quantity: scheduleData.quantity,
          production_line: scheduleData.production_line,
          status: 'SCHEDULED',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['projections'] });
      toast({
        title: "Success",
        description: "Production scheduled successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to schedule production",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteProductionSchedule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from('production_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_schedules'] });
      toast({
        title: "Success",
        description: "Production schedule deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete production schedule",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateProductionSchedule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ scheduleId, updates }: { scheduleId: string; updates: any }) => {
      const { error } = await supabase
        .from('production_schedules')
        .update(updates)
        .eq('id', scheduleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_schedules'] });
      toast({
        title: "Success",
        description: "Production schedule updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update production schedule",
        variant: "destructive",
      });
    },
  });
};
