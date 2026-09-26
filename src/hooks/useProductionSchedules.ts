import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlantId } from "@/hooks/usePlantId";
import { attachParentVouchers } from "@/utils/voucherLinks";

/** Voucher states after which a schedule belongs in Completed Production. */
const DONE_STATES = ["COMPLETED", "OQC_PASSED", "OQC_FAILED", "CANCELLED"];

const PLANNING_KEYS = ["production_schedules", "projections", "production-orders", "production-orders-list",
  "scheduled-productions", "production-lines-overview", "production-queue", "subassembly-positions"];

export const useProductionSchedules = () => {
  const plantId = usePlantId();
  return useQuery({
    queryKey: ['production_schedules', plantId],
    enabled: !!plantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_schedules')
        .select(`
          *,
          parts ( id, name, part_code ),
          production_lines (
            name
          ),
          projections (
            id,
            parts (
              id,
              name,
              part_code
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
            quantity,
            parent_order_id,
            kit_preparation (
              status
            ),
            subs:production_orders!parent_order_id (
              id, voucher_number, status, quantity, planned_date,
              parts!part_id ( part_code, name )
            )
          )
        `)
        .eq('plant_id', plantId!)
        .order('scheduled_date', { ascending: true });
      
      if (error) throw error;
      // Hide schedules whose production is already completed — they belong in Completed Production
      const open = (data || []).filter((s: any) => {
        const orders = Array.isArray(s.production_orders) ? s.production_orders : [];
        if (orders.length === 0) return true;
        return !orders.every((o: any) => DONE_STATES.includes(o.status));
      });
      // A sub-assembly voucher issued for a finished-good voucher: show which one.
      const orders = await attachParentVouchers(open.flatMap((s: any) => s.production_orders ?? []));
      const byId = new Map(orders.map((o: any) => [o.id, o]));
      return open.map((s: any) => ({
        ...s,
        production_orders: (s.production_orders ?? []).map((o: any) => byId.get(o.id) ?? o),
      }));
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
    .gte('planned_date', monthStart)
    .lt('planned_date', monthEnd)
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
  const plantId = usePlantId();

  return useMutation({
    mutationFn: async (scheduleData: any) => {
      if (!plantId) throw new Error('No active plant selected');
      console.log('🎯 Creating production schedule with data:', scheduleData);
      
      // IMMEDIATE FIX: Fetch projection data BEFORE any mutations to avoid RLS conflicts
      const { data: projection, error: projectionError } = await supabase
        .from('projections')
        .select('part_id, quantity, scheduled_quantity')
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
      // voucher_number is NOT generated here. set_voucher_number owns that column
      // and issues the PV-YYYYMM-NNNNN series from a sequence. Minting one in the
      // app was a second writer with its own scheme (PROD_MM_NN), so the same
      // voucher could be numbered two different ways depending on the screen used.
      
      // Create the production schedule without requiring production line
      const { data: schedule, error: scheduleError } = await supabase
        .from('production_schedules')
        .insert({
          projection_id: scheduleData.projection_id,
          // part_id is NOT NULL and was missing, so every insert here was rejected.
          part_id: projection.part_id,
          scheduled_date: scheduleData.scheduled_date,
          quantity: scheduleData.quantity,
          production_line_id: scheduleData.production_line_id || null,
          status: 'PLANNED',
          plant_id: plantId,
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
          part_id: projection.part_id,
          quantity: scheduleData.quantity,
          // production_orders.scheduled_date is planned_date now.
          planned_date: scheduleData.scheduled_date,
          voucher_number: '',
          status: 'PLANNED',
          plant_id: plantId,
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

      // scheduled_quantity / vouchered_qty are maintained by database triggers
      // (recomputed as the SUM of linked schedules) — never incremented here.

      return { schedule, productionOrder, voucherNumber: productionOrder.voucher_number };
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
      const { error } = await supabase.rpc('delete_production_schedule_cascade', {
        p_schedule_id: scheduleId,
      });
      if (error) throw error;
      // Projection scheduled_quantity / vouchered_qty are recomputed by database triggers.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['projections'] });
      queryClient.invalidateQueries({ queryKey: ['subassembly-positions'] });
      toast({
        title: "Success",
        description: "Production schedule deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cannot delete schedule",
        description: error?.message || "Failed to delete production schedule",
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

      // Keep the voucher in step with its schedule.
      const orderUpdates: Record<string, any> = {};
      if (updates.quantity) orderUpdates.quantity = updates.quantity;
      if (updates.scheduled_date) orderUpdates.planned_date = updates.scheduled_date;
      if (Object.keys(orderUpdates).length) {
        const { error: orderError } = await supabase
          .from('production_orders')
          .update(orderUpdates)
          .eq('production_schedule_id', scheduleId);

        if (orderError) throw orderError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['projections'] });
      queryClient.invalidateQueries({ queryKey: ['subassembly-positions'] });
      toast({
        title: "Success",
        description: "Production schedule updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cannot update schedule",
        description: error?.message || "Failed to update production schedule",
        variant: "destructive",
      });
    },
  });
};

export interface SubAssemblyToIssue {
  part_id: string;
  quantity: number;
  date: string;
  line_id?: string | null;
}

/**
 * Schedule a finished good from its projection, together with the new
 * sub-assembly vouchers the planner chose to issue for it. One database call:
 * either all of the vouchers are created or none are.
 */
export const useScheduleFinishedGood = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const plantId = usePlantId();

  return useMutation({
    mutationFn: async (input: {
      projection_id: string; quantity: number; scheduled_date: string;
      production_line_id?: string | null; subassemblies: SubAssemblyToIssue[];
    }) => {
      if (!plantId) throw new Error("No active plant selected");
      const { data, error } = await (supabase as any).rpc("schedule_finished_good", {
        p_plant_id: plantId,
        p_projection_id: input.projection_id,
        p_quantity: input.quantity,
        p_date: input.scheduled_date,
        p_line_id: input.production_line_id || null,
        p_subassemblies: input.subassemblies.map((s) => ({ ...s, line_id: s.line_id || null })),
      });
      if (error) throw error;
      return data as { voucher_number: string; subassemblies: { voucher_number: string }[] };
    },
    onSuccess: (data) => {
      for (const k of PLANNING_KEYS) queryClient.invalidateQueries({ queryKey: [k] });
      const subs = data.subassemblies?.map((s) => s.voucher_number) ?? [];
      toast({
        title: "Production scheduled",
        description: subs.length
          ? `Voucher ${data.voucher_number}, with sub-assembly vouchers ${subs.join(", ")}`
          : `Voucher ${data.voucher_number}`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Could not schedule", description: error?.message ?? "Unknown error", variant: "destructive" });
    },
  });
};

/**
 * A sub-assembly voucher: for stock, or for a finished-good voucher already
 * scheduled (parent_order_id). The database refuses one without a BOM.
 */
export const useCreateStockBuild = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const plantId = usePlantId();

  return useMutation({
    mutationFn: async (input: {
      part_id: string; quantity: number; scheduled_date: string;
      production_line_id?: string | null; parent_order_id?: string | null; notes?: string;
    }) => {
      if (!plantId) throw new Error("No active plant selected");
      const { data, error } = await (supabase as any).rpc("schedule_subassembly", {
        p_plant_id: plantId,
        p_part_id: input.part_id,
        p_quantity: input.quantity,
        p_date: input.scheduled_date,
        p_line_id: input.production_line_id || null,
        p_parent_order_id: input.parent_order_id || null,
        p_notes: input.notes || null,
      });
      if (error) throw error;
      return (data as any).voucher_number as string;
    },
    onSuccess: (voucher) => {
      for (const k of PLANNING_KEYS) queryClient.invalidateQueries({ queryKey: [k] });
      toast({ title: "Sub-assembly scheduled", description: `Voucher ${voucher}` });
    },
    onError: (error: any) => {
      toast({ title: "Could not schedule", description: error?.message ?? "Unknown error", variant: "destructive" });
    },
  });
};
