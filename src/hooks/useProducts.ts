
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      console.log("Debug: Fetching products...");
      
      // Test connection first
      const { data: testData, error: testError } = await supabase
        .from("products")
        .select("count", { count: 'exact' });
      
      console.log("Debug: Products count test:", testData, testError);
      
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      
      console.log("Debug products data:", data);
      console.log("Debug products error:", error);
      
      if (error) {
        console.error("Error fetching products:", error);
        throw error;
      }
      return data || [];
    },
    retry: 3,
    retryDelay: 1000,
  });
};
