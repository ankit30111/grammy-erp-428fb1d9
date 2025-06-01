
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CreateProductionScheduleData {
  projection_id: string;
  scheduled_date: string;
  quantity: number;
}

export interface UpdateProductionScheduleData {
  scheduleId: string;
  updates: {
    status?: string;
    quantity?: number;
    scheduled_date?: string;
  };
}

// Generate voucher number in mm-ss format
const generateVoucherNumber = async (scheduledDate: string): Promise<string> => {
  const date = new Date(scheduledDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Get the count of schedules for this month to determine sequence
  const { data, error } = await supabase
    .from('production_schedules')
    .select('id')
    .gte('scheduled_date', `${date.getFullYear()}-${month}-01`)
    .lt('scheduled_date', `${date.getFullYear()}-${String(date.getMonth() + 2).padStart(2, '0')}-01`);
  
  if (error) {
    console.error('Error getting voucher count:', error);
    throw error;
  }
  
  const sequence = String((data?.length || 0) + 1).padStart(2, '0');
  return `${month}-${sequence}`;
};

export const useProductionSchedules = () => {
  return useQuery({
    queryKey: ["production-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_schedules")
        .select(`
          *,
          projections!inner (
            id,
            quantity,
            delivery_month,
            customers!inner (
              id,
              name,
              customer_code
            ),
            products!inner (
              id,
              name,
              product_code
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching production schedules:", error);
        throw error;
      }

      return data;
    },
  });
};

export const useCreateProductionSchedule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateProductionScheduleData) => {
      // Generate voucher number
      const voucherNumber = await generateVoucherNumber(data.scheduled_date);
      
      const { data: schedule, error } = await supabase
        .from("production_schedules")
        .insert({
          projection_id: data.projection_id,
          scheduled_date: data.scheduled_date,
          quantity: data.quantity,
          status: 'SCHEDULED'
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating production schedule:", error);
        throw error;
      }

      // Create production order with voucher number
      const { error: orderError } = await supabase
        .from('production_orders')
        .insert({
          production_schedule_id: schedule.id,
          voucher_number: voucherNumber,
          quantity: data.quantity,
          scheduled_date: data.scheduled_date,
          status: 'PENDING'
        });

      if (orderError) {
        console.error("Error creating production order:", orderError);
        throw orderError;
      }

      return schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["projections"] });
      toast({
        title: "Production Scheduled",
        description: "Production has been scheduled successfully with voucher number",
      });
    },
    onError: (error) => {
      console.error("Error scheduling production:", error);
      toast({
        title: "Error",
        description: "Failed to schedule production",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateProductionSchedule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ scheduleId, updates }: UpdateProductionScheduleData) => {
      const { data, error } = await supabase
        .from("production_schedules")
        .update(updates)
        .eq("id", scheduleId)
        .select()
        .single();

      if (error) {
        console.error("Error updating production schedule:", error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-schedules"] });
      toast({
        title: "Schedule Updated",
        description: "Production schedule updated successfully",
      });
    },
    onError: (error) => {
      console.error("Error updating production schedule:", error);
      toast({
        title: "Error",
        description: "Failed to update production schedule",
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
      // First delete any associated production orders
      const { error: orderError } = await supabase
        .from('production_orders')
        .delete()
        .eq('production_schedule_id', scheduleId);

      if (orderError) {
        console.error("Error deleting production order:", orderError);
        throw orderError;
      }

      // Then delete the schedule
      const { error } = await supabase
        .from("production_schedules")
        .delete()
        .eq("id", scheduleId);

      if (error) {
        console.error("Error deleting production schedule:", error);
        throw error;
      }

      return scheduleId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["projections"] });
      toast({
        title: "Schedule Deleted",
        description: "Production schedule deleted successfully",
      });
    },
    onError: (error) => {
      console.error("Error deleting production schedule:", error);
      toast({
        title: "Error",
        description: "Failed to delete production schedule",
        variant: "destructive",
      });
    },
  });
};
