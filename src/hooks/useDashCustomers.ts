import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDashCustomers = () => {
  return useQuery({
    queryKey: ["dash-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useDashCustomerMutations = () => {
  const qc = useQueryClient();

  const addCustomer = useMutation({
    mutationFn: async (customer: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("dash_customers")
        .insert(customer as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-customers"] });
      toast.success("Customer added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("dash_customers").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dash-customers"] });
      toast.success("Customer updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { addCustomer, updateCustomer };
};
