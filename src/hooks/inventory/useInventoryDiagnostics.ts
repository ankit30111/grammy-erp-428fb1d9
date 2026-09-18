
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { fetchStockQuantity } from "@/utils/stockLedger";
import { MOVEMENT_TYPES } from "@/constants/movementTypes";

export const useCheckMaterialInventory = () => {
  const plantId = usePlantId();
  return useMutation({
    mutationFn: async (materialCode: string) => {
      if (!plantId) throw new Error("No active plant selected");
      console.log(`🔍 Checking enhanced inventory for material: ${materialCode}`);
      
      // Get material details
      const { data: material, error: materialError } = await supabase
        .from("parts")
        .select("id, part_code, name")
        .eq("part_code", materialCode)
        .single();

      if (materialError) {
        console.error("❌ Material not found:", materialError);
        throw materialError;
      }

      // Get all GRN items for this material in this plant (store confirmed only)
      const { data: grnItems, error: grnError } = await supabase
        .from("grn_items")
        .select(`
          iqc_accepted_quantity,
          store_confirmed,
          store_confirmed_at,
          grn!inner(grn_number, received_date)
        `)
        .eq("part_id", material.id)
        .eq("store_confirmed", true)
        .eq("plant_id", plantId);

      if (grnError) throw grnError;

      // Get current main-store stock balance for this plant
      const inventory = {
        quantity: await fetchStockQuantity(plantId, material.id, "MAIN"),
      };

      // Get production dispatches (materials issued to production)
      const { data: productionDispatches, error: dispatchError } = await supabase
        .from("stock_ledger")
        .select("qty_delta")
        .eq("part_id", material.id)
        .eq("plant_id", plantId)
        .eq("movement_type", MOVEMENT_TYPES.ISSUED_TO_PRODUCTION)
        .order("created_at", { ascending: false });

      if (dispatchError) throw dispatchError;

      // Get approved material requests
      const { data: materialRequests, error: requestError } = await supabase
        .from("material_requests")
        .select("issued_quantity")
        .eq("part_id", material.id)
        .eq("status", "APPROVED");

      if (requestError) throw requestError;

      // Calculate totals
      const totalFromGRN = grnItems?.reduce((sum, item) => sum + item.iqc_accepted_quantity, 0) || 0;
      // qty_delta is signed and negative for issues, so the dispatched total is
      // the sum of absolute values — it is subtracted again below via
      // totalStoreOutput, which expects a positive quantity.
      const totalProductionDispatches = productionDispatches?.reduce((sum, dispatch) => sum + Math.abs(Number(dispatch.qty_delta) || 0), 0) || 0;
      const totalMaterialRequests = materialRequests?.reduce((sum, request) => sum + (request.issued_quantity || 0), 0) || 0;
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
