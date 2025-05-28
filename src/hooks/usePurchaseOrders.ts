
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
      return data;
    },
  });
};

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderData: any) => {
      // Insert purchase order without po_number (let trigger generate it)
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
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
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast({
        title: "Success",
        description: "Purchase order created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    },
  });
};
