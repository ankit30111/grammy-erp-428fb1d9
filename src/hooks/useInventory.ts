import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useInventory = () => {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      console.log("🔍 Fetching inventory data...");
      
      // Get the current inventory data with material details
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select(`
          *,
          raw_materials!raw_material_id (
            material_code,
            name,
            category
          )
        `)
        .order("last_updated", { ascending: false });
      
      if (inventoryError) {
        console.error("❌ Error fetching inventory:", inventoryError);
        throw inventoryError;
      }

      console.log("📊 Current inventory data:", inventoryData);
      return inventoryData || [];
    },
  });
};

export const useUpdateInventory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      id,
      quantity,
    }: {
      id: string;
      quantity: number;
    }) => {
      console.log(`🔄 Updating inventory ${id} with quantity ${quantity}`);
      const { data, error } = await supabase
        .from("inventory")
        .update({ 
          quantity,
          last_updated: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();
      
      if (error) {
        console.error("❌ Error updating inventory:", error);
        throw error;
      }
      
      console.log("✅ Inventory updated:", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};

// ENHANCED: Inventory deduction with proper material movement logging
export const useInventoryDeduction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      rawMaterialId,
      quantityToDeduct,
      referenceId,
      referenceNumber,
      notes,
    }: {
      rawMaterialId: string;
      quantityToDeduct: number;
      referenceId: string;
      referenceNumber: string;
      notes?: string;
    }) => {
      console.log(`🔄 ENHANCED: Processing inventory deduction for material ${rawMaterialId}`);
      console.log(`   - Quantity to deduct: ${quantityToDeduct}`);
      console.log(`   - Reference: ${referenceNumber}`);
      
      // STEP 1: Get current inventory with proper error handling
      const { data: currentInventory, error: invError } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("raw_material_id", rawMaterialId)
        .single();

      if (invError) {
        console.error("❌ CRITICAL: Error fetching current inventory:", invError);
        throw new Error(`Failed to fetch inventory: ${invError.message}`);
      }

      const currentStock = currentInventory.quantity;
      console.log(`📊 Current stock for material ${rawMaterialId}: ${currentStock}`);
      
      if (currentStock < quantityToDeduct) {
        const errorMsg = `Insufficient stock: Available ${currentStock}, Required ${quantityToDeduct}`;
        console.error("❌ INSUFFICIENT STOCK:", errorMsg);
        throw new Error(errorMsg);
      }

      const newStock = currentStock - quantityToDeduct;
      console.log(`🔄 Planned stock reduction: ${currentStock} → ${newStock}`);

      // STEP 2: CRITICAL - Update inventory (this will trigger the logging automatically via database trigger)
      const { data: updatedInventory, error: updateError } = await supabase
        .from("inventory")
        .update({
          quantity: newStock,
          last_updated: new Date().toISOString()
        })
        .eq("raw_material_id", rawMaterialId)
        .select("quantity")
        .single();

      if (updateError) {
        console.error("❌ CRITICAL: Inventory update failed:", updateError);
        throw new Error(`Failed to update inventory: ${updateError.message}`);
      }

      console.log("✅ INVENTORY UPDATE SUCCESSFUL:", {
        material: rawMaterialId,
        previous: currentStock,
        new: updatedInventory.quantity,
        deducted: quantityToDeduct
      });

      // STEP 3: Additional manual logging for production voucher context
      const { error: movementError } = await supabase
        .rpc('log_material_movement', {
          p_raw_material_id: rawMaterialId,
          p_movement_type: "ISSUED_TO_PRODUCTION",
          p_quantity: quantityToDeduct,
          p_reference_id: referenceId,
          p_reference_type: "PRODUCTION_ORDER",
          p_reference_number: referenceNumber,
          p_notes: notes || `Material dispatched to production via voucher. Stock: ${currentStock} → ${newStock}`
        });

      if (movementError) {
        console.error("❌ Error logging production movement:", movementError);
        // Don't fail the transaction for logging errors, but log it
        console.warn("⚠️ Production movement logging failed, but inventory deduction successful");
      } else {
        console.log("✅ PRODUCTION MOVEMENT LOGGED SUCCESSFULLY");
      }

      console.log(`✅ ENHANCED INVENTORY DEDUCTION COMPLETE: ${currentStock} → ${newStock}`);
      return {
        previousStock: currentStock,
        newStock,
        quantityDeducted: quantityToDeduct
      };
    },
    onSuccess: () => {
      // CRITICAL: Invalidate all inventory-related queries for real-time updates
      console.log("🔄 INVALIDATING ALL INVENTORY QUERIES FOR REAL-TIME SYNC...");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
    },
  });
};

// ENHANCED: Manual sync that respects store physical quantities
export const useManualInventorySync = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      console.log("🔧 Starting enhanced manual inventory sync with store physical quantities...");
      
      // Get all store confirmed GRN items with their physical quantities
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
        .eq("store_confirmed", true);

      if (error) {
        console.error("❌ Error fetching confirmed items:", error);
        throw error;
      }

      console.log("📋 Store confirmed items to sync:", confirmedItems);

      // Get current inventory to check for existing records
      const { data: currentInventory, error: invError } = await supabase
        .from("inventory")
        .select("raw_material_id, quantity");

      if (invError) {
        console.error("❌ Error fetching current inventory:", invError);
        throw invError;
      }

      console.log("📦 Current inventory records:", currentInventory);

      // Create a map of current inventory quantities
      const inventoryMap = new Map();
      currentInventory?.forEach(item => {
        inventoryMap.set(item.raw_material_id, item.quantity);
      });

      // Calculate what the correct quantities should be based on STORE PHYSICAL QUANTITIES
      const correctQuantities = new Map();
      confirmedItems?.forEach(item => {
        const current = correctQuantities.get(item.raw_material_id) || 0;
        // Use store_physical_quantity if available, otherwise fall back to accepted_quantity
        const quantityToAdd = item.store_physical_quantity || item.accepted_quantity;
        const newTotal = current + quantityToAdd;
        correctQuantities.set(item.raw_material_id, newTotal);
        
        console.log(`🧮 Material ${item.raw_materials?.material_code}: Adding ${quantityToAdd} (Store Physical: ${item.store_physical_quantity}, IQC: ${item.accepted_quantity}), Total should be: ${newTotal}`);
        console.log(`   - GRN: ${item.grn?.grn_number}, Confirmed at: ${item.store_confirmed_at}`);
      });

      // Compare and fix any discrepancies
      let correctedCount = 0;
      for (const [materialId, correctQuantity] of correctQuantities) {
        const currentQuantity = inventoryMap.get(materialId) || 0;
        
        if (currentQuantity !== correctQuantity) {
          console.log(`🔧 FIXING DISCREPANCY for material ${materialId}:`);
          console.log(`   - Current in inventory: ${currentQuantity}`);
          console.log(`   - Should be (from Store Physical): ${correctQuantity}`);
          console.log(`   - Difference: ${correctQuantity - currentQuantity}`);
          
          // Update to correct quantity
          const { error: upsertError } = await supabase
            .from("inventory")
            .upsert({
              raw_material_id: materialId,
              quantity: correctQuantity,
              location: 'Main Store',
              last_updated: new Date().toISOString()
            }, {
              onConflict: 'raw_material_id'
            });

          if (upsertError) {
            console.error(`❌ Error fixing inventory for material ${materialId}:`, upsertError);
          } else {
            console.log(`✅ FIXED: Material ${materialId} quantity corrected to ${correctQuantity}`);
            correctedCount++;
          }
        } else {
          console.log(`✅ Material ${materialId} quantity is correct: ${correctQuantity}`);
        }
      }

      console.log("🎉 Enhanced manual inventory sync completed with store physical quantities");
      return { success: true, correctedItems: correctedCount };
    },
    onSuccess: (result) => {
      // CRITICAL: Invalidate all inventory queries for immediate refresh
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      console.log(`✅ Enhanced sync completed. Corrected ${result.correctedItems} materials.`);
    },
  });
};

// Enhanced function to check for specific material issues
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

// ENHANCED: Real-time inventory monitoring with auto-refresh
export const useRealTimeInventory = () => {
  return useQuery({
    queryKey: ["inventory-real-time"],
    queryFn: async () => {
      console.log("🔍 Fetching ENHANCED real-time inventory data...");
      
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          raw_materials!raw_material_id (
            id,
            material_code,
            name,
            category
          )
        `)
        .order("last_updated", { ascending: false });
      
      if (error) {
        console.error("❌ Error fetching real-time inventory:", error);
        throw error;
      }

      console.log("📦 ENHANCED real-time inventory data:", data?.length, "items");
      return data || [];
    },
    refetchInterval: 2000, // Refresh every 2 seconds for real-time sync
  });
};
