import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Finished goods (what used to be "products") live in parts now. */
export const useFinishedGoodParts = () => {
  return useQuery({
    queryKey: ["parts", "finished-goods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts")
        .select("id, part_code, name, category, uom, source_type, is_active")
        .eq("source_type", "FINISHED_GOOD")
        .eq("is_active", true)
        .order("part_code");
      if (error) throw error;
      return data || [];
    },
    retry: 2,
  });
};

/** Kept name for screens not yet rewired. */
export const useProducts = useFinishedGoodParts;
