
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
            product_code
          ),
          raw_materials (
            id,
            name,
            material_code,
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
          raw_materials (
            id,
            name,
            material_code,
            vendor_id,
            vendors (
              id,
              name
            )
          )
        `)
        .eq('product_id', productId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });
};
