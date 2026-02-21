import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDashSalesOrders = () => {
  return useQuery({
    queryKey: ["dash-sales-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_sales_orders")
        .select("*, dash_customers(customer_name, customer_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashSalesOrderItems = (salesOrderId?: string) => {
  return useQuery({
    queryKey: ["dash-sales-order-items", salesOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_sales_order_items")
        .select("*, dash_products(product_name, model_number)")
        .eq("sales_order_id", salesOrderId!);
      if (error) throw error;
      return data;
    },
    enabled: !!salesOrderId,
  });
};

export const useDashSalesMutations = () => {
  const qc = useQueryClient();

  const createSalesOrder = useMutation({
    mutationFn: async ({
      order,
      items,
    }: {
      order: Record<string, unknown>;
      items: Record<string, unknown>[];
    }) => {
      const { data: so, error: soErr } = await supabase
        .from("dash_sales_orders")
        .insert({ ...order, so_number: "" } as any)
        .select()
        .single();
      if (soErr) throw soErr;

      if (items.length > 0) {
        const itemsWithSO = items.map((i) => ({ ...i, sales_order_id: so.id }));
        const { error: itemErr } = await supabase.from("dash_sales_order_items").insert(itemsWithSO as any);
        if (itemErr) throw itemErr;
      }
      return so;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-sales-orders"] });
      toast.success("Sales order created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSalesOrder = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("dash_sales_orders").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-sales-orders"] });
      toast.success("Sales order updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { createSalesOrder, updateSalesOrder };
};

export const useDashPayments = (customerId?: string) => {
  return useQuery({
    queryKey: ["dash-payments", customerId],
    queryFn: async () => {
      let q = supabase
        .from("dash_payments")
        .select("*, dash_customers(customer_name), dash_sales_orders(so_number)")
        .order("created_at", { ascending: false });
      if (customerId) q = q.eq("customer_id", customerId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
};

export const useDashPaymentMutations = () => {
  const qc = useQueryClient();

  const addPayment = useMutation({
    mutationFn: async (payment: Record<string, unknown>) => {
      const { error } = await supabase.from("dash_payments").insert(payment as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-payments"] });
      qc.invalidateQueries({ queryKey: ["dash-sales-orders"] });
      toast.success("Payment recorded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { addPayment };
};
