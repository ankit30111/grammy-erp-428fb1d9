
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getStockLocationId, hasLedgerEntry, postStockMovement } from "@/utils/stockLedger";

export const useGRNReceiving = () => {
  const [physicalQuantities, setPhysicalQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const item = grnItems.find((i: any) => i.id === itemId);

      const { error } = await supabase
        .from('grn_items')
        .update({
          store_physical_quantity: physicalQuantity,
          physical_verification_date: new Date().toISOString(),
          physical_verified_by: user.id,
          store_confirmed: true,
          store_confirmed_at: new Date().toISOString(),
          store_confirmed_by: user.id,
        })
        .eq('id', itemId);

      if (error) throw error;

      // Post only the variance against the quantity IQC already released to MAIN
      const delta = physicalQuantity - Number(item?.accepted_quantity || 0);
      if (item?.plant_id && delta !== 0 && !(await hasLedgerEntry('GRN_ITEM_STORE_VARIANCE', itemId))) {
        const mainId = await getStockLocationId(item.plant_id, 'MAIN');
        await postStockMovement({
          plant_id: item.plant_id,
          raw_material_id: item.raw_material_id,
          location_id: mainId,
          qty_delta: delta,
          movement_type: 'ADJUSTMENT',
          reason_code: 'STORE_PHYSICAL_VARIANCE',
          reference_type: 'GRN_ITEM_STORE_VARIANCE',
          reference_id: itemId,
          reference_number: item.grn?.grn_number ?? null,
          notes: `Store physical verification variance of ${delta} against IQC accepted quantity`,
        });
      }
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
    onError: (error: any) => {
      console.error('Error confirming physical verification:', error);
      
      let errorMessage = "Failed to confirm physical verification";
      if (error?.message?.includes('not authenticated')) {
        errorMessage = "Please sign in to confirm receipt";
      } else if (error?.message?.includes('row-level security')) {
        errorMessage = "You don't have permission to confirm this receipt";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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
