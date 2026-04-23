import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Safe columns only. Banking + certificate URLs are revoked at the column
// level for `authenticated` (see migration 003e); they're admin-readable via
// the get_customer_finance(uuid) RPC, fetched on demand from the edit dialog.
const CUSTOMER_SAFE_COLS =
  "id, customer_code, name, brand_name, contact_person_name, email, contact_number, address, gst_number, is_active, created_at, updated_at, created_by";

export const useCustomers = () => {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(CUSTOMER_SAFE_COLS)
        .order("name");

      if (error) {
        console.error("Error fetching customers:", error);
        throw error;
      }
      return data || [];
    },
    retry: 3,
    retryDelay: 1000,
  });
};
