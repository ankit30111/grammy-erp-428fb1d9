
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProductionOrders } from "./useProductionOrders";

export const useKitManagement = () => {
  const { data: productionOrders } = useProductionOrders();
  const [kitStatuses, setKitStatuses] = useState<Record<string, string>>({});
  const [sentComponents, setSentComponents] = useState<Record<string, string[]>>({});
  const [voucherStatuses, setVoucherStatuses] = useState<Record<string, string>>({});

  // Load existing kit data on mount
  useEffect(() => {
    if (productionOrders) {
      loadExistingKitData();
      loadVoucherStatuses();
    }
  }, [productionOrders]);

  const loadVoucherStatuses = async () => {
    if (!productionOrders) return;

    const statusMap: Record<string, string> = {};
    
    for (const order of productionOrders) {
      try {
        const { data: bomItems, error } = await supabase
          .from("bom")
          .select(`
            *,
            raw_materials!inner(
              id,
              material_code,
              inventory(quantity)
            )
          `)
          .eq("product_id", order.product_id);

        if (error) throw error;

        const isReady = bomItems?.every(item => {
          const requiredQty = item.quantity * order.quantity;
          const availableQty = item.raw_materials.inventory?.[0]?.quantity || 0;
          return availableQty >= requiredQty;
        });

        statusMap[order.voucher_number] = isReady ? "Ready" : "Not Ready";
      } catch (error) {
        console.error("Error checking voucher status:", error);
        statusMap[order.voucher_number] = "Unknown";
      }
    }
    
    setVoucherStatuses(statusMap);
  };

  const loadExistingKitData = async () => {
    try {
      const { data: existingKits, error } = await supabase
        .from("kit_preparation")
        .select(`
          *,
          kit_items(
            *,
            raw_materials!inner(*)
          ),
          production_orders!inner(voucher_number)
        `);

      if (error) throw error;

      const newSentComponents: Record<string, string[]> = {};
      const newKitStatuses: Record<string, string> = {};

      existingKits?.forEach(kit => {
        const voucherNumber = kit.production_orders?.voucher_number;
        if (voucherNumber && kit.kit_items) {
          // Parse status to determine sent components
          if (kit.status?.includes("ACCESSORY")) {
            newSentComponents[voucherNumber] = [...(newSentComponents[voucherNumber] || []), "Accessories"];
          }
          if (kit.status?.includes("SUB ASSEMBLY")) {
            newSentComponents[voucherNumber] = [...(newSentComponents[voucherNumber] || []), "Sub Assembly"];
          }
          if (kit.status?.includes("MAIN ASSEMBLY")) {
            newSentComponents[voucherNumber] = [...(newSentComponents[voucherNumber] || []), "Main Assembly"];
          }
          if (kit.status?.includes("COMPLETE KIT")) {
            newSentComponents[voucherNumber] = ["Main Assembly", "Sub Assembly", "Accessories"];
          }

          newKitStatuses[voucherNumber] = kit.status || "KIT NOT READY";
        }
      });

      setSentComponents(newSentComponents);
      setKitStatuses(newKitStatuses);
    } catch (error) {
      console.error("Error loading existing kit data:", error);
    }
  };

  return {
    kitStatuses,
    setKitStatuses,
    sentComponents,
    setSentComponents,
    voucherStatuses,
    loadExistingKitData,
    loadVoucherStatuses
  };
};
