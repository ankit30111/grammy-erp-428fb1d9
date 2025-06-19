
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useGRNReceiving = () => {
  const [physicalQuantities, setPhysicalQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch GRN items that are ready for store receipt (IQC approved)
  const { data: grnItems = [], isLoading } = useQuery({
    queryKey: ['grn-items-for-store'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grn_items')
        .select(`
          *,
          grn (
            grn_number,
            received_date,
            vendors (
              name,
              vendor_code
            )
          ),
          raw_materials (
            material_code,
            name
          )
        `)
        .in('iqc_status', ['APPROVED', 'SEGREGATED'])
        .neq('accepted_quantity', 0)
        .is('store_confirmed', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Filter items that have actual accepted quantity > 0
      return data?.filter(item => (item.accepted_quantity || 0) > 0) || [];
    },
  });

  // Mutation to handle physical verification and store confirmation
  const confirmPhysicalVerificationMutation = useMutation({
    mutationFn: async ({ itemId, physicalQuantity }: { itemId: string; physicalQuantity: number }) => {
      const { error } = await supabase
        .from('grn_items')
        .update({
          store_physical_quantity: physicalQuantity,
          physical_verification_date: new Date().toISOString(),
          physical_verified_by: null, // Would be set from auth in real app
          store_confirmed: true,
          store_confirmed_at: new Date().toISOString(),
          store_confirmed_by: null, // Would be set from auth in real app
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn-items-for-store'] });
      queryClient.invalidateQueries({ queryKey: ['store-discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setPhysicalQuantities({});
      toast({
        title: "Physical Verification Complete",
        description: "Material has been received to store and inventory updated",
      });
    },
    onError: (error) => {
      console.error('Error confirming physical verification:', error);
      toast({
        title: "Error",
        description: "Failed to confirm physical verification",
        variant: "destructive",
      });
    },
  });

  const handlePhysicalQuantityChange = (itemId: string, quantity: string) => {
    const numQuantity = parseInt(quantity) || 0;
    setPhysicalQuantities(prev => ({
      ...prev,
      [itemId]: numQuantity
    }));
  };

  const handleConfirmReceipt = (item: any) => {
    const physicalQuantity = physicalQuantities[item.id];
    
    if (physicalQuantity === undefined || physicalQuantity < 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid physical quantity",
        variant: "destructive",
      });
      return;
    }

    confirmPhysicalVerificationMutation.mutate({
      itemId: item.id,
      physicalQuantity
    });
  };

  return {
    grnItems,
    isLoading,
    physicalQuantities,
    handlePhysicalQuantityChange,
    handleConfirmReceipt,
    isPending: confirmPhysicalVerificationMutation.isPending
  };
};
