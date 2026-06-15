import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Safe columns only. Bank account, IFSC, PAN, MSME and certificate URLs are
// admin-only (column-level grants); fetch them on demand via the
// get_dash_customer_finance(uuid) RPC when the caller is admin.
const DASH_CUSTOMER_SAFE_COLS =
  "id, customer_name, customer_type, gst_number, credit_limit, outstanding_balance, contact_person, phone, email, address, city, state, territory, assigned_sales_manager, is_active, created_at, updated_at, owner_name, owner_phone, primary_address, godown_address, pincode, salesman_name, notes, created_by, updated_by";

export type DashCustomerFinance = {
  id: string;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  pan_number: string | null;
  msme_number: string | null;
  gst_certificate_url: string | null;
  cancelled_cheque_url: string | null;
  msme_certificate_url: string | null;
};

/** Admin-only finance fetch for a DASH customer. */
export const useDashCustomerFinance = (customerId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: ["dash-customer-finance", customerId],
    enabled: !!customerId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dash_customer_finance", {
        p_customer_id: customerId,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as DashCustomerFinance | undefined;
    },
  });
};

export const useDashCustomers = () => {
  return useQuery({
    queryKey: ["dash-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dash_customers")
        .select(DASH_CUSTOMER_SAFE_COLS)
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
        .select(DASH_CUSTOMER_SAFE_COLS)
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
