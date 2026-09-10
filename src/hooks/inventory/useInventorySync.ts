
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlantId } from "@/hooks/usePlantId";
import { fetchStockBalanceRows } from "@/utils/stockLedger";

/**
 * Reconciliation report only.
 *
 * The stock ledger is now the source of truth, so this no longer rewrites
 * balances. It compares store-confirmed GRN receipts against the current
 * main-store balance and reports any difference for review.
 */
export const useManualInventorySync = () => {
  const queryClient = useQueryClient();
  const plantId = usePlantId();

  return useMutation({
    mutationFn: async () => {
      if (!plantId) throw new Error("No active plant selected");
      console.log("🔧 Reconciling store receipts against the stock ledger...");

      const { data: confirmedItems, error } = await supabase
        .from("grn_items")
        .select(`
          raw_material_id,
          store_physical_quantity,
          accepted_quantity,
          store_confirmed_at,
          grn!inner(grn_number),
          raw_materials(material_code, name)
        `)
        .eq("store_confirmed", true)
        .eq("plant_id", plantId);

      if (error) {
        console.error("❌ Error fetching confirmed items:", error);
        throw error;
      }

      const balances = await fetchStockBalanceRows(plantId, "MAIN");
      const balanceMap = new Map<string, number>();
      balances.forEach((row: any) => balanceMap.set(row.raw_material_id, row.quantity));

      const receivedTotals = new Map<string, number>();
      confirmedItems?.forEach((item: any) => {
        const received = item.store_physical_quantity ?? item.accepted_quantity ?? 0;
        receivedTotals.set(
          item.raw_material_id,
          (receivedTotals.get(item.raw_material_id) || 0) + received
        );
      });

      let differences = 0;
      for (const [materialId, receivedTotal] of receivedTotals) {
        const balance = balanceMap.get(materialId) || 0;
        if (balance !== receivedTotal) {
          differences++;
          console.log(
            `ℹ️ Material ${materialId}: received ${receivedTotal}, current main-store balance ${balance} (difference explained by issues/returns or a real gap)`
          );
        }
      }

      console.log("🎉 Reconciliation report completed");
      return { success: true, correctedItems: differences };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      console.log(`✅ Reconciliation completed. ${result.correctedItems} materials differ from receipts.`);
    },
  });
};
