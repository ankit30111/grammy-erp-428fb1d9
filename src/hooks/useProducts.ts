
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      console.log("Debug: Fetching products...");
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      console.log("Debug products data:", data);
      console.log("Debug products error:", error);
      
      if (error) throw error;
      return data;
    },
  });
};
