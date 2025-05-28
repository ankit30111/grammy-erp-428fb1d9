
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useGRN = () => {
  return useQuery({
    queryKey: ['grn'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grn')
        .select(`
          *,
          vendors (
            id,
            name
          ),
          purchase_orders (
            id,
            po_number
          ),
          grn_items (
            *,
            raw_materials (
              id,
              name,
              material_code
            )
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateGRN = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (grnData: any) => {
      // Insert GRN with empty grn_number (let trigger generate it)
      const { data: grnRecord, error: grnError } = await supabase
        .from('grn')
        .insert({
          grn_number: '', // Empty string will be replaced by trigger
          purchase_order_id: grnData.purchase_order_id,
          vendor_id: grnData.vendor_id,
          status: 'PENDING',
          notes: grnData.notes,
        })
        .select()
        .single();

      if (grnError) throw grnError;

      // Insert GRN items
      const items = grnData.items.map((item: any) => ({
        grn_id: grnRecord.id,
        raw_material_id: item.raw_material_id,
        po_quantity: item.po_quantity,
        received_quantity: item.received_quantity,
        iqc_status: 'PENDING',
      }));

      const { error: itemsError } = await supabase
        .from('grn_items')
        .insert(items);

      if (itemsError) throw itemsError;

      return grnRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      toast({
        title: "Success",
        description: "GRN created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create GRN",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateGRNItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: any }) => {
      const { error } = await supabase
        .from('grn_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      toast({
        title: "Success",
        description: "GRN item updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update GRN item",
        variant: "destructive",
      });
    },
  });
};
