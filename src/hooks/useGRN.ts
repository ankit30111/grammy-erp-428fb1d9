
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
      try {
        console.log('Creating GRN with data:', grnData);
        
        // Insert GRN with empty grn_number (let trigger generate it)
        const { data: grnRecord, error: grnError } = await supabase
          .from('grn')
          .insert({
            grn_number: '', // Empty string will be replaced by trigger
            purchase_order_id: grnData.purchase_order_id || null, // Allow null for non-PO GRNs
            vendor_id: grnData.vendor_id,
            status: 'RECEIVED', // Set to RECEIVED for both PO and non-PO GRNs
            notes: grnData.notes,
            received_date: grnData.received_date || new Date().toISOString().split('T')[0],
          })
          .select()
          .single();

        if (grnError) {
          console.error('GRN creation error:', grnError);
          throw new Error(`Failed to create GRN: ${grnError.message}`);
        }

        console.log('GRN created successfully:', grnRecord);

      // Insert GRN items
      const items = grnData.items.map((item: any) => ({
        grn_id: grnRecord.id,
        raw_material_id: item.raw_material_id,
        po_quantity: item.po_quantity || item.expected_quantity, // Use expected_quantity for non-PO GRNs
        received_quantity: item.received_quantity,
        iqc_status: 'PENDING',
      }));

      const { error: itemsError } = await supabase
        .from('grn_items')
        .insert(items);

        if (itemsError) {
          console.error('GRN items creation error:', itemsError);
          throw new Error(`Failed to create GRN items: ${itemsError.message}`);
        }

        console.log('GRN items created successfully');
        return grnRecord;
      } catch (error) {
        console.error('Error in GRN creation process:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: `GRN ${data.grn_number} created successfully`,
      });
    },
    onError: (error: any) => {
      console.error('GRN creation failed:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast({
        title: "Failed to create GRN",
        description: errorMessage,
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
