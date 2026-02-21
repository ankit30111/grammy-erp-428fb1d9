import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDashFactoryOrders = () => {
  return useQuery({
    queryKey: ["dash-factory-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_factory_orders")
        .select("*, dash_products(product_name, model_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashFactoryOrderMutations = () => {
  const qc = useQueryClient();

  const addOrder = useMutation({
    mutationFn: async (order: {
      product_id: string;
      quantity_ordered: number;
      cost_per_unit: number;
      total_cost: number;
      expected_production_date?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("dash_factory_orders")
        .insert({ ...order, fo_number: "" } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-factory-orders"] });
      toast.success("Factory order created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("dash_factory_orders")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-factory-orders"] });
      qc.invalidateQueries({ queryKey: ["dash-inventory"] });
      toast.success("Factory order updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { addOrder, updateOrder };
};
