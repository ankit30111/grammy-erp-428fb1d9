import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDashInventory = () => {
  return useQuery({
    queryKey: ["dash-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_inventory")
        .select("*, dash_products(product_name, model_number, category)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashInventoryMovements = () => {
  return useQuery({
    queryKey: ["dash-inventory-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_inventory_movements")
        .select("*, dash_products(product_name, model_number)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
};

export const useDashInventoryMutations = () => {
  const qc = useQueryClient();

  const updateInventory = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("dash_inventory").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-inventory"] });
      toast.success("Inventory updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { updateInventory };
};
