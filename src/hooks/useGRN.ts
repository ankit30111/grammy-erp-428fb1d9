
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlantId } from "@/hooks/usePlantId";
import { getStockLocationId, postStockMovements } from "@/utils/stockLedger";

export const useGRN = () => {
  const plantId = usePlantId();
  return useQuery({
    queryKey: ['grn', plantId],
    enabled: !!plantId,
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
            parts (
              id,
              name,
              part_code
            )
          )
        `)
        .eq('plant_id', plantId!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateGRN = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const plantId = usePlantId();

  return useMutation({
    mutationFn: async (grnData: any) => {
      try {
        if (!plantId) throw new Error('No active plant selected');
        console.log('Creating GRN with data:', grnData);
        
        // Insert GRN with empty grn_number (let trigger generate it)
        const { data: grnRecord, error: grnError } = await supabase
          .from('grn')
          .insert({
            grn_number: '', // Empty string will be replaced by trigger
            purchase_order_id: grnData.purchase_order_id || null, // Allow null for non-PO GRNs
            vendor_id: grnData.vendor_id,
            // status is deliberately NOT set here. The recalc_grn_status trigger
            // owns this column and derives it from the items: DRAFT with no items,
            // IQC_PENDING once they exist, IQC_DONE when every line is inspected,
            // STORE_CONFIRMED when every line is counted in. The column defaults to
            // DRAFT, and the trigger corrects it the moment items are inserted.
            // (The old code wrote 'RECEIVED', which is a po_status value and not a
            // member of grn_status at all, so every GRN insert was rejected.)
            notes: grnData.notes,
            received_date: grnData.received_date || new Date().toISOString().split('T')[0],
            plant_id: plantId,
          })
          .select()
          .single();

        if (grnError) {
          console.error('GRN creation error:', grnError);
          throw new Error(`Failed to create GRN: ${grnError.message}`);
        }

        console.log('GRN created successfully:', grnRecord);

      // Insert GRN items.
      //
      // purchase_order_item_id is what links this receipt back to the PO line.
      // Without it recalc_po_item_received returns early, so the PO's received
      // and pending quantities never move however much material arrives. It is
      // null for a non-PO GRN, which is legitimate.
      //
      // plant_id and po_quantity are NOT columns on grn_items: the plant comes
      // from the parent grn, and the ordered quantity from the linked PO line.
      const items = grnData.items.map((item: any) => ({
        grn_id: grnRecord.id,
        purchase_order_item_id: item.purchase_order_item_id ?? null,
        part_id: item.part_id,
        received_quantity: item.received_quantity,
        iqc_outcome: 'PENDING',
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('grn_items')
        .insert(items)
        .select('id, part_id, received_quantity');

        if (itemsError) {
          console.error('GRN items creation error:', itemsError);
          // Don't leave a headless GRN behind holding a document number.
          await supabase.from('grn').delete().eq('id', grnRecord.id);
          throw new Error(`Failed to create GRN items: ${itemsError.message}`);
        }

        console.log('GRN items created successfully');

        // Received material lands in QUARANTINE — not usable until IQC clears it.
        const quarantineId = await getStockLocationId(plantId, 'QUAR');
        await postStockMovements(
          (insertedItems || []).map((item) => ({
            plant_id: plantId,
            part_id: item.part_id,
            location_id: quarantineId,
            qty_delta: Number(item.received_quantity) || 0,
            movement_type: 'RECEIPT',
            reason_code: 'GRN_RECEIPT',
            reference_type: 'GRN_ITEM_RECEIPT',
            reference_id: item.id,
            reference_number: grnRecord.grn_number,
            notes: `Received into quarantine via GRN ${grnRecord.grn_number}`,
          }))
        );

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

export const useDeleteGRN = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (grnId: string) => {
      // First delete all GRN items
      const { error: itemsError } = await supabase
        .from('grn_items')
        .delete()
        .eq('grn_id', grnId);

      if (itemsError) throw itemsError;

      // Then delete the GRN record
      const { error: grnError } = await supabase
        .from('grn')
        .delete()
        .eq('id', grnId);

      if (grnError) throw grnError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      toast({
        title: "Success",
        description: "GRN deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Delete GRN error:', error);
      toast({
        title: "Error",
        description: "Failed to delete GRN",
        variant: "destructive",
      });
    },
  });
};
