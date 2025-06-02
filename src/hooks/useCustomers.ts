
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCustomers = () => {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      console.log("Debug: Fetching customers...");
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      console.log("Debug customers data:", data);
      console.log("Debug customers error:", error);
      
      if (error) {
        console.error("Error fetching customers:", error);
        throw error;
      }
      return data || [];
    },
  });
};
