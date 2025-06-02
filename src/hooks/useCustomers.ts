
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCustomers = () => {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      console.log("Debug: Fetching customers...");
      
      // Test connection first
      const { data: testData, error: testError } = await supabase
        .from("customers")
        .select("count", { count: 'exact' });
      
      console.log("Debug: Customers count test:", testData, testError);
      
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      
      console.log("Debug customers data:", data);
      console.log("Debug customers error:", error);
      
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
