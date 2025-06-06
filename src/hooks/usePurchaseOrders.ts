
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const usePurchaseOrders = () => {
  return useQuery({
    queryKey: ['purchase_orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (
            id,
            name
          ),
          purchase_order_items (
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

      // Get received quantities from the new view for each PO
      const { data: receivedQuantities, error: receivedError } = await supabase
        .from('purchase_order_received_quantities')
        .select('*');

      if (receivedError) throw receivedError;

      // Merge the received quantities data with PO items
      const enhancedData = data.map(po => ({
        ...po,
        purchase_order_items: po.purchase_order_items?.map(item => {
          const receivedData = receivedQuantities?.find(
            rq => rq.purchase_order_item_id === item.id
          );
          return {
            ...item,
            received_quantity: receivedData?.total_received_quantity || 0,
            pending_quantity: receivedData?.pending_quantity || item.quantity
          };
        })
      }));

      return enhancedData;
    },
  });
};

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderData: any) => {
      // Insert purchase order with empty po_number (let trigger generate it)
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: '', // Empty string will be replaced by trigger using PO-MM-XX format
          vendor_id: orderData.vendor_id,
          status: 'PENDING',
          notes: orderData.notes,
          expected_delivery_date: orderData.expected_delivery_date,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Insert purchase order items
      const items = orderData.items.map((item: any) => ({
        purchase_order_id: poData.id,
        raw_material_id: item.raw_material_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Update total amount
      const totalAmount = items.reduce((sum: number, item: any) => sum + item.total_price, 0);
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ total_amount: totalAmount })
        .eq('id', poData.id);

      if (updateError) throw updateError;

      return poData;
    },
    onSuccess: () => {
      // Invalidate both purchase orders and material shortages queries
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      queryClient.invalidateQueries({ queryKey: ['materials-for-po'] });
      queryClient.invalidateQueries({ queryKey: ['material-shortages-calculated'] });
      
      toast({
        title: "Success",
        description: "Purchase order created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating PO:', error);
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    },
  });
};

// Function to update PO status - used when sending to vendor
export const useUpdatePOStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ poId, status }: { poId: string, status: string }) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status })
        .eq('id', poId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      
      const statusMap: Record<string, string> = {
        'SENT': 'sent to vendor',
        'APPROVED': 'approved',
        'CANCELLED': 'cancelled'
      };
      
      toast({
        title: "PO Updated",
        description: `Purchase order ${statusMap[variables.status] || variables.status.toLowerCase()}`,
      });
    },
    onError: (error) => {
      console.error('Error updating PO status:', error);
      toast({
        title: "Error",
        description: "Failed to update purchase order status",
        variant: "destructive",
      });
    },
  });
};
