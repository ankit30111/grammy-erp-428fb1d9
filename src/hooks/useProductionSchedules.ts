
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

// Helper function to generate voucher number
const generateVoucherNumber = async (scheduledDate: string) => {
  const date = new Date(scheduledDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Get count of existing vouchers for this month
  const { data: existingVouchers, error } = await supabase
    .from('production_orders')
    .select('voucher_number')
    .like('voucher_number', `${month}-%`)
    .order('voucher_number', { ascending: false })
    .limit(1);
  
  if (error) throw error;
  
  let sequence = 1;
  if (existingVouchers && existingVouchers.length > 0) {
    const lastVoucher = existingVouchers[0].voucher_number;
    const lastSequence = parseInt(lastVoucher.split('-')[1]) || 0;
    sequence = lastSequence + 1;
  }
  
  return `${month}-${String(sequence).padStart(2, '0')}`;
};

export const useCreateProductionSchedule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleData: any) => {
      console.log('🎯 Creating production schedule with data:', scheduleData);
      
      // First create the production schedule with the selected production line
      const { data: schedule, error: scheduleError } = await supabase
        .from('production_schedules')
        .insert({
          projection_id: scheduleData.projection_id,
          scheduled_date: scheduleData.scheduled_date,
          quantity: scheduleData.quantity,
          production_line: scheduleData.production_line, // This is crucial
          status: 'SCHEDULED',
        })
        .select()
        .single();

      if (scheduleError) {
        console.error('❌ Schedule creation error:', scheduleError);
        throw scheduleError;
      }

      console.log('✅ Schedule created:', schedule);

      // Generate voucher number
      const voucherNumber = await generateVoucherNumber(scheduleData.scheduled_date);

      // Get product_id from projection
      const { data: projection, error: projectionError } = await supabase
        .from('projections')
        .select('product_id')
        .eq('id', scheduleData.projection_id)
        .single();

      if (projectionError) {
        console.error('❌ Projection fetch error:', projectionError);
        throw projectionError;
      }

      // Create production order with voucher number and link to schedule
      const { data: productionOrder, error: orderError } = await supabase
        .from('production_orders')
        .insert({
          production_schedule_id: schedule.id,
          product_id: projection.product_id,
          quantity: scheduleData.quantity,
          scheduled_date: scheduleData.scheduled_date,
          voucher_number: voucherNumber,
          status: 'SCHEDULED',
          kit_status: 'NOT_PREPARED'
        })
        .select()
        .single();

      if (orderError) {
        console.error('❌ Production order creation error:', orderError);
        throw orderError;
      }

      console.log('✅ Production order created:', productionOrder);
      
      return { schedule, productionOrder };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['projections'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-productions'] });
      queryClient.invalidateQueries({ queryKey: ['production-lines-overview'] });
      queryClient.invalidateQueries({ queryKey: ['production-queue'] });
      toast({
        title: "Success",
        description: "Production scheduled successfully and assigned to production line",
      });
    },
    onError: (error) => {
      console.error('❌ Schedule creation failed:', error);
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
      // First delete related production orders
      const { error: orderError } = await supabase
        .from('production_orders')
        .delete()
        .eq('production_schedule_id', scheduleId);

      if (orderError) throw orderError;

      // Then delete the production schedule
      const { error: scheduleError } = await supabase
        .from('production_schedules')
        .delete()
        .eq('id', scheduleId);

      if (scheduleError) throw scheduleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
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
