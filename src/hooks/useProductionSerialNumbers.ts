import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductionSerialNumber {
  id: string;
  production_order_id: string;
  starting_serial_number?: string;
  ending_serial_number?: string;
  quantity: number;
  status: string;
  assigned_by?: string;
  assigned_at?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface ProductionVoucherWithDispatch {
  id: string;
  voucher_number: string;
  quantity: number;
  scheduled_date: string;
  status: string;
  products: {
    name: string;
  };
  production_schedules: {
    projections: {
      customers: {
        name: string;
      };
    };
  };
  has_material_dispatch: boolean;
  serial_number_assignment?: ProductionSerialNumber;
}

export const useProductionVouchersWithDispatch = () => {
  return useQuery({
    queryKey: ["production-vouchers-with-dispatch"],
    queryFn: async () => {
      // First get all production orders with their details
      const { data: productionOrders, error: ordersError } = await supabase
        .from("production_orders")
        .select(`
          id,
          voucher_number,
          quantity,
          scheduled_date,
          status,
          products!product_id (name),
          production_schedules!production_schedule_id (
            projections!projection_id (
              customers!customer_id (name)
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Get material movements to check which orders have dispatches
      // Updated to look for both PRODUCTION_VOUCHER and PRODUCTION_ORDER reference types
      const { data: movements, error: movementsError } = await supabase
        .from("material_movements")
        .select("reference_id")
        .eq("movement_type", "ISSUED_TO_PRODUCTION")
        .in("reference_type", ["PRODUCTION_VOUCHER", "PRODUCTION_ORDER"]);

      if (movementsError) throw movementsError;

      // Get existing serial number assignments
      const { data: serialNumbers, error: serialError } = await supabase
        .from("production_serial_numbers")
        .select("*");

      if (serialError) throw serialError;

      // Create a set of production order IDs that have material dispatches
      const dispatchedOrderIds = new Set(
        movements?.map(m => m.reference_id) || []
      );

      // Create a map of serial number assignments by production order ID
      const serialNumberMap = new Map(
        serialNumbers?.map(sn => [sn.production_order_id, sn]) || []
      );

      // Filter and enhance production orders
      const vouchersWithDispatch = productionOrders
        ?.filter(order => dispatchedOrderIds.has(order.id))
        .map(order => ({
          ...order,
          has_material_dispatch: true,
          serial_number_assignment: serialNumberMap.get(order.id)
        })) || [];

      return vouchersWithDispatch as ProductionVoucherWithDispatch[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useCreateSerialNumberAssignment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      production_order_id: string;
      starting_serial_number: string;
      ending_serial_number: string;
      quantity: number;
      assigned_by?: string;
      notes?: string;
    }) => {
      const { data: result, error } = await supabase
        .from("production_serial_numbers")
        .insert({
          ...data,
          assigned_at: new Date().toISOString(),
          status: "ASSIGNED"
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-vouchers-with-dispatch"] });
      toast({
        title: "Serial Numbers Assigned",
        description: "Serial number range has been successfully assigned to the production voucher."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign serial numbers",
        variant: "destructive"
      });
    }
  });
};

export const useUpdateSerialNumberAssignment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      updates
    }: {
      id: string;
      updates: Partial<{
        starting_serial_number: string;
        ending_serial_number: string;
        notes: string;
        status: string;
      }>;
    }) => {
      const { data, error } = await supabase
        .from("production_serial_numbers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-vouchers-with-dispatch"] });
      toast({
        title: "Serial Numbers Updated",
        description: "Serial number assignment has been updated successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update serial numbers",
        variant: "destructive"
      });
    }
  });
};
