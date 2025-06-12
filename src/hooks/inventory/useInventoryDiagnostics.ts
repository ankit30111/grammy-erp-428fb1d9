
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

      // Get all GRN items for this material
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

      // Get material movements for this material
      const { data: movements, error: movError } = await supabase
        .from("material_movements")
        .select("*")
        .eq("raw_material_id", material.id)
        .order("created_at", { ascending: false });

      if (movError) throw movError;

      const totalFromGRN = grnItems?.reduce((sum, item) => sum + item.accepted_quantity, 0) || 0;
      const currentInventory = inventory?.quantity || 0;
      const totalIssued = movements?.filter(m => m.movement_type === 'ISSUED_TO_PRODUCTION')
        .reduce((sum, m) => sum + m.quantity, 0) || 0;

      console.log(`📊 Enhanced analysis for ${materialCode}:`);
      console.log(`   - Total from GRN receipts: ${totalFromGRN}`);
      console.log(`   - Total issued to production: ${totalIssued}`);
      console.log(`   - Current inventory: ${currentInventory}`);
      console.log(`   - Expected inventory: ${totalFromGRN - totalIssued}`);
      console.log(`   - Discrepancy: ${currentInventory - (totalFromGRN - totalIssued)}`);

      return {
        materialCode,
        totalFromGRN,
        totalIssued,
        currentInventory,
        expectedInventory: totalFromGRN - totalIssued,
        discrepancy: currentInventory - (totalFromGRN - totalIssued),
        grnEntries: grnItems,
        movements: movements
      };
    },
  });
};
