
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";

export const useDispatchOrders = () => {
  const plantId = usePlantId();
  return useQuery({
    queryKey: ["dispatch-orders", plantId],
    enabled: !!plantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatch_orders")
        .select(`
          *,
          dispatch_order_items (
            *,
            product_id,
            quantity
          ),
          customers (name)
        `)
        .eq('plant_id', plantId!)
        .order("dispatch_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};
