import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDashProducts = () => {
  return useQuery({
    queryKey: ["dash-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashProductMutations = () => {
  const queryClient = useQueryClient();

  const addProduct = useMutation({
    mutationFn: async (product: {
      product_name: string;
      model_number: string;
      category: string;
      description?: string;
      technical_specs?: Record<string, unknown>;
      mrp: number;
      dealer_price: number;
      distributor_price: number;
      barcode_ean?: string;
      warranty_period_months?: number;
      status?: string;
    }) => {
      const { data, error } = await supabase
        .from("dash_products")
        .insert(product as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-products"] });
      toast.success("Product added successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("dash_products")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dash-products"] });
      toast.success("Product updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { addProduct, updateProduct };
};
