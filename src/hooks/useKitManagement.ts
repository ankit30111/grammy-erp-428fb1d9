
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useKitManagement = () => {
  const [kitStatuses, setKitStatuses] = useState<Record<string, string>>({});
  const [sentComponents, setSentComponents] = useState<Record<string, string[]>>({});
  const queryClient = useQueryClient();

  // Get all production vouchers in KIT state
  const { data: voucherStatuses } = useQuery({
    queryKey: ["voucher-kit-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          id,
          voucher_number,
          product_id,
          quantity,
          kit_status,
          scheduled_date,
          status,
          products (name),
          kit_preparation (
            id,
            status,
            kit_items (
              id,
              raw_material_id,
              required_quantity,
              issued_quantity,
              verified_by_production,
              actual_quantity,
              raw_materials (name, material_code)
            )
          )
        `)
        .in("status", ["PENDING", "IN_PROGRESS"])
        .in("kit_status", ["KIT SCHEDULED", "KIT PREPARING", "KIT READY", "KIT VERIFIED", "KIT SENT", "KIT SHORTAGE"])
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Send kit items to production
  const sendToProduction = useMutation({
    mutationFn: async ({ 
      voucherId, 
      kitId, 
      kitItems 
    }: { 
      voucherId: string, 
      kitId: string, 
      kitItems: Array<{
        kitItemId: string,
        rawMaterialId: string,
        issuedQuantity: number,
        materialCode: string,
        materialName: string
      }> 
    }) => {
      // First update all kit items with issued quantities
      const updatePromises = kitItems.map(item => {
        return supabase
          .from("kit_items")
          .update({
            issued_quantity: item.issuedQuantity,
          })
          .eq("id", item.kitItemId);
      });
      
      await Promise.all(updatePromises);
      
      // Update kit preparation status
      const { error: kitError } = await supabase
        .from("kit_preparation")
        .update({ status: "SENT" })
        .eq("id", kitId);
      
      if (kitError) throw kitError;
      
      // Update production voucher kit status
      const { error: voucherError } = await supabase
        .from("production_orders")
        .update({ kit_status: "KIT SENT" })
        .eq("id", voucherId);
      
      if (voucherError) throw voucherError;
      
      // Create material movement records for inventory deduction
      const movementRecords = kitItems.map(item => ({
        raw_material_id: item.rawMaterialId,
        quantity: item.issuedQuantity,
        reference_id: voucherId,
        reference_type: "PRODUCTION_ORDER",
        reference_number: kitItems[0].materialCode, // Use the voucher number
        movement_type: "OUT",
        issued_to: "Production",
        notes: `Sent to production for voucher ${kitItems[0].materialCode}`
      }));
      
      const { error: movementError } = await supabase
        .from("material_movements")
        .insert(movementRecords);
      
      if (movementError) throw movementError;
      
      // Deduct from inventory
      for (const item of kitItems) {
        // First get current quantity
        const { data: invData, error: invError } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("raw_material_id", item.rawMaterialId)
          .single();
        
        if (invError && invError.code !== 'PGRST116') throw invError;
        
        const currentQty = invData?.quantity || 0;
        const newQty = Math.max(0, currentQty - item.issuedQuantity);
        
        // Update inventory with deducted quantity
        const { error: updateError } = await supabase
          .from("inventory")
          .update({ 
            quantity: newQty, 
            last_updated: new Date().toISOString() 
          })
          .eq("raw_material_id", item.rawMaterialId);
        
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher-kit-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Materials sent to production and inventory updated");
    },
    onError: (error) => {
      console.error("Error sending kit to production:", error);
      toast.error("Failed to send materials to production");
    },
  });

  // Report kit shortages
  const reportKitShortage = useMutation({
    mutationFn: async ({ 
      voucherId, 
      kitId, 
      shortageItems 
    }: { 
      voucherId: string, 
      kitId: string, 
      shortageItems: Array<{
        rawMaterialId: string,
        requiredQuantity: number,
        availableQuantity: number,
        shortageQuantity: number,
        materialName: string
      }>
    }) => {
      // Update kit preparation status
      const { error: kitError } = await supabase
        .from("kit_preparation")
        .update({ status: "SHORTAGE" })
        .eq("id", kitId);
      
      if (kitError) throw kitError;
      
      // Update production voucher kit status
      const { error: voucherError } = await supabase
        .from("production_orders")
        .update({ kit_status: "KIT SHORTAGE" })
        .eq("id", voucherId);
      
      if (voucherError) throw voucherError;
      
      // Create material shortages notification or log
      // This could be implemented according to business needs
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher-kit-statuses"] });
      toast.success("Kit shortage reported");
    },
    onError: (error) => {
      console.error("Error reporting kit shortage:", error);
      toast.error("Failed to report kit shortage");
    },
  });

  return {
    kitStatuses,
    setKitStatuses,
    sentComponents,
    setSentComponents,
    voucherStatuses,
    sendToProduction,
    reportKitShortage
  };
};
