
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCheckMaterialInventory = () => {
  return useMutation({
    mutationFn: async (materialCode: string) => {
      console.log(`🔍 Checking enhanced inventory for material: ${materialCode}`);
      
      // Get material details
      const { data: material, error: materialError } = await supabase
        .from("raw_materials")
        .select("id, material_code, name")
        .eq("material_code", materialCode)
        .single();

      if (materialError) {
        console.error("❌ Material not found:", materialError);
        throw materialError;
      }

      // Get all GRN items for this material (store confirmed only)
      const { data: grnItems, error: grnError } = await supabase
        .from("grn_items")
        .select(`
          accepted_quantity,
          store_confirmed,
          store_confirmed_at,
          grn!inner(grn_number, received_date)
        `)
        .eq("raw_material_id", material.id)
        .eq("store_confirmed", true);

      if (grnError) throw grnError;

      // Get current inventory
      const { data: inventory, error: invError } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("raw_material_id", material.id)
        .maybeSingle();

      if (invError) throw invError;

      // Get production dispatches (materials issued to production)
      const { data: productionDispatches, error: dispatchError } = await supabase
        .from("material_movements")
        .select("quantity")
        .eq("raw_material_id", material.id)
        .eq("movement_type", "ISSUED_TO_PRODUCTION")
        .order("created_at", { ascending: false });

      if (dispatchError) throw dispatchError;

      // Get approved material requests
      const { data: materialRequests, error: requestError } = await supabase
        .from("material_requests")
        .select("approved_quantity")
        .eq("raw_material_id", material.id)
        .eq("status", "APPROVED");

      if (requestError) throw requestError;

      // Calculate totals
      const totalFromGRN = grnItems?.reduce((sum, item) => sum + item.accepted_quantity, 0) || 0;
      const totalProductionDispatches = productionDispatches?.reduce((sum, dispatch) => sum + dispatch.quantity, 0) || 0;
      const totalMaterialRequests = materialRequests?.reduce((sum, request) => sum + (request.approved_quantity || 0), 0) || 0;
      const totalStoreOutput = totalProductionDispatches + totalMaterialRequests;
      const currentInventory = inventory?.quantity || 0;
      const expectedInventory = totalFromGRN - totalStoreOutput;
      const discrepancy = currentInventory - expectedInventory;

      console.log(`📊 Enhanced inventory analysis for ${materialCode}:`);
      console.log(`   - Total from GRN receipts: ${totalFromGRN}`);
      console.log(`   - Production dispatches: ${totalProductionDispatches}`);
      console.log(`   - Material requests (approved): ${totalMaterialRequests}`);
      console.log(`   - Total store output: ${totalStoreOutput}`);
      console.log(`   - Current inventory: ${currentInventory}`);
      console.log(`   - Expected inventory: ${expectedInventory}`);
      console.log(`   - Discrepancy: ${discrepancy}`);

      return {
        materialCode,
        materialName: material.name,
        totalFromGRN,
        totalProductionDispatches,
        totalMaterialRequests,
        totalStoreOutput,
        currentInventory,
        expectedInventory,
        discrepancy,
        grnEntries: grnItems,
        productionDispatches: productionDispatches,
        materialRequests: materialRequests
      };
    },
  });
};
