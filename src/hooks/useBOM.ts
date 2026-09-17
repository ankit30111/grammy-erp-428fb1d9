
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useBOM = () => {
  return useQuery({
    queryKey: ['bom'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bom')
        .select(`
          *,
          products (
            id,
            name,
            part_code
          ),
          parts (
            id,
            name,
            part_code,
            vendor_id,
            vendors (
              id,
              name
            )
          )
        `);
      
      if (error) throw error;
      return data;
    },
  });
};

export const useBOMByProduct = (productId: string) => {
  return useQuery({
    queryKey: ['bom', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bom')
        .select(`
          *,
          parts (
            id,
            name,
            part_code,
            category
          )
        `)
        .eq('part_id', productId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });
};
