
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useProductionCompletion = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check for production orders that should be marked complete
  const { data: productionToComplete = [] } = useQuery({
    queryKey: ["production-completion-check"],
    queryFn: async () => {
      // Get production orders that are IN_PROGRESS
      const { data: inProgressOrders, error: ordersError } = await supabase
        .from("production_orders")
        .select("*")
        .eq("status", "IN_PROGRESS");

      if (ordersError) throw ordersError;

      const ordersToComplete = [];

      for (const order of inProgressOrders || []) {
        // Get total hourly production for this order
        const { data: hourlyData, error: hourlyError } = await supabase
          .from("hourly_production")
          .select("production_units")
          .eq("production_order_id", order.id);

        if (hourlyError) {
          console.error("Error fetching hourly production:", hourlyError);
          continue;
        }

        const totalProduced = hourlyData?.reduce((sum, record) => sum + record.production_units, 0) || 0;

        console.log(`Production Order ${order.voucher_number}: Target ${order.quantity}, Produced ${totalProduced}`);

        // If total produced matches or exceeds the target quantity
        if (totalProduced >= order.quantity) {
          ordersToComplete.push({
            ...order,
            totalProduced
          });
        }
      }

      return ordersToComplete;
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Auto-complete production orders
  useEffect(() => {
    const completeProduction = async () => {
      for (const order of productionToComplete) {
        try {
          console.log(`Auto-completing production order: ${order.voucher_number}`);

          // Update production order status to COMPLETED
          const { error: updateError } = await supabase
            .from("production_orders")
            .update({ 
              status: "COMPLETED",
              updated_at: new Date().toISOString()
            })
            .eq("id", order.id);

          if (updateError) {
            console.error("Error updating production order:", updateError);
            continue;
          }

          // Create finished goods inventory entry
          const { error: inventoryError } = await supabase
            .from("finished_goods_inventory")
            .insert({
              production_order_id: order.id,
              product_id: order.product_id,
              quantity: order.quantity,
              lot_number: `LOT-${order.voucher_number}`,
              production_date: new Date().toISOString().split('T')[0],
              quality_status: "PENDING_OQC",
              location: "Production Floor"
            });

          if (inventoryError) {
            console.error("Error creating finished goods entry:", inventoryError);
          }

          toast({
            title: "Production Completed",
            description: `Production order ${order.voucher_number} has been completed and sent to OQC.`,
          });

          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ["production-orders"] });
          queryClient.invalidateQueries({ queryKey: ["completed-production-orders"] });
          queryClient.invalidateQueries({ queryKey: ["finished-goods-inventory"] });

        } catch (error) {
          console.error("Error completing production:", error);
        }
      }
    };

    if (productionToComplete.length > 0) {
      completeProduction();
    }
  }, [productionToComplete, toast, queryClient]);

  return { productionToComplete };
};
