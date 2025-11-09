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
          ),
          production_orders!production_schedule_id (
            id,
            voucher_number,
            status,
            kit_status
          )
        `)
        .order('scheduled_date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
};

// Helper function to generate voucher number based on scheduled date with correct PROD_MM_XX format
const generateVoucherNumber = async (scheduledDate: string) => {
  const date = new Date(scheduledDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  // Calculate the start and end of the month for the query
  const monthStart = `${year}-${month}-01`;
  
  // Calculate next month properly
  let nextMonth = date.getMonth() + 1;
  let nextYear = year;
  
  if (nextMonth === 12) {
    nextMonth = 0; // January
    nextYear = year + 1;
  }
  
  const nextMonthPadded = String(nextMonth + 1).padStart(2, '0');
  const monthEnd = `${nextYear}-${nextMonthPadded}-01`;
  
  console.log('📅 Date range for voucher query:', { monthStart, monthEnd, scheduledDate });
  
  // Get existing production orders for the same month and year to determine sequence
  const { data: existingOrders, error } = await supabase
    .from('production_orders')
    .select('voucher_number')
    .gte('scheduled_date', monthStart)
    .lt('scheduled_date', monthEnd)
    .order('voucher_number', { ascending: false });
  
  if (error) {
    console.error('Error fetching existing vouchers:', error);
    throw error;
  }
  
  console.log('📋 Existing orders found:', existingOrders);
  
  // Find the highest sequence number for this month using the correct PROD_MM_XX pattern
  let maxSequence = 0;
  if (existingOrders && existingOrders.length > 0) {
    const voucherPattern = new RegExp(`^PROD_${month}_(\\d{2})$`);
    existingOrders.forEach(order => {
      const match = order.voucher_number.match(voucherPattern);
      if (match) {
        const sequence = parseInt(match[1]);
        if (sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    });
  }
  
  // Generate next sequence number with correct format
  const nextSequence = maxSequence + 1;
  const voucherNumber = `PROD_${month}_${String(nextSequence).padStart(2, '0')}`;
  
  console.log('🎯 Generated voucher number:', voucherNumber);
  return voucherNumber;
};

export const useCreateProductionSchedule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleData: any) => {
      console.log('🎯 Creating production schedule with data:', scheduleData);
      
      // IMMEDIATE FIX: Fetch projection data BEFORE any mutations to avoid RLS conflicts
      const { data: projection, error: projectionError } = await supabase
        .from('projections')
        .select('product_id, quantity, scheduled_quantity')
        .eq('id', scheduleData.projection_id)
        .maybeSingle();

      if (projectionError) {
        console.error('❌ Projection fetch error:', projectionError);
        throw new Error(`Failed to fetch projection: ${projectionError.message}`);
      }

      if (!projection) {
        throw new Error('Projection not found. Please ensure you have permission to access this projection.');
      }

      // Validate scheduling quantity
      const remainingQuantity = projection.quantity - (projection.scheduled_quantity || 0);
      if (scheduleData.quantity > remainingQuantity) {
        throw new Error(`Cannot schedule ${scheduleData.quantity} units. Only ${remainingQuantity} units remaining.`);
      }

      // Generate voucher number based on scheduled date
      const voucherNumber = await generateVoucherNumber(scheduleData.scheduled_date);
      console.log('📋 Generated voucher number:', voucherNumber);
      
      // Create the production schedule without requiring production line
      const { data: schedule, error: scheduleError } = await supabase
        .from('production_schedules')
        .insert({
          projection_id: scheduleData.projection_id,
          scheduled_date: scheduleData.scheduled_date,
          quantity: scheduleData.quantity,
          production_line: scheduleData.production_line || null,
          status: 'SCHEDULED',
        })
        .select()
        .single();

      if (scheduleError) {
        console.error('❌ Schedule creation error:', scheduleError);
        throw new Error(`Failed to create schedule: ${scheduleError.message}`);
      }

      console.log('✅ Schedule created:', schedule);

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
        // Rollback the schedule if order creation fails
        await supabase.from('production_schedules').delete().eq('id', schedule.id);
        throw new Error(`Failed to create production order: ${orderError.message}`);
      }

      console.log('✅ Production order created:', productionOrder);
      
      return { schedule, productionOrder, voucherNumber };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['projections'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-productions'] });
      queryClient.invalidateQueries({ queryKey: ['production-lines-overview'] });
      queryClient.invalidateQueries({ queryKey: ['production-queue'] });
      toast({
        title: "Success",
        description: `Production scheduled successfully with voucher: ${data.voucherNumber}`,
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
      queryClient.invalidateQueries({ queryKey: ['production-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['projections'] });
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

      // Also update related production order if quantity changed
      if (updates.quantity) {
        const { error: orderError } = await supabase
          .from('production_orders')
          .update({ quantity: updates.quantity })
          .eq('production_schedule_id', scheduleId);

        if (orderError) throw orderError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['projections'] });
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
