
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDispatchOrders = () => {
  return useQuery({
    queryKey: ["dispatch-orders"],
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
        .order("dispatch_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};
