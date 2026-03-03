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

export const useDashCustomerDocuments = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["dash-customer-documents", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("dash_customer_documents")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });
};

export const useDashCustomerDocumentMutations = () => {
  const qc = useQueryClient();

  const addDocument = useMutation({
    mutationFn: async (doc: { customer_id: string; document_type: string; file_name: string; file_url: string; uploaded_by?: string }) => {
      const { data, error } = await supabase
        .from("dash_customer_documents")
        .insert(doc)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["dash-customer-documents", variables.customer_id] });
      toast.success("Document uploaded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteDocument = useMutation({
    mutationFn: async ({ id, customerId }: { id: string; customerId: string }) => {
      const { error } = await supabase.from("dash_customer_documents").delete().eq("id", id);
      if (error) throw error;
      return customerId;
    },
    onSuccess: (customerId) => {
      qc.invalidateQueries({ queryKey: ["dash-customer-documents", customerId] });
      toast.success("Document deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { addDocument, deleteDocument };
};
