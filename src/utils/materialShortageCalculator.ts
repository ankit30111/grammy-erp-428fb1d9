
import { supabase } from "@/integrations/supabase/client";

export interface MaterialShortage {
  raw_material_id: string;
  material_code: string;
  material_name: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  vendor_info?: {
    id: string;
    name: string;
    vendor_code: string;
    is_primary: boolean;
  };
}

export interface VendorGroup {
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  total_items: number;
  items: MaterialShortage[];
}

export const groupShortagesByVendor = (shortages: MaterialShortage[]): VendorGroup[] => {
  const vendorMap = new Map<string, VendorGroup>();

  shortages.forEach(shortage => {
    if (!shortage.vendor_info) return;

    const vendorId = shortage.vendor_info.id;
    
    if (!vendorMap.has(vendorId)) {
      vendorMap.set(vendorId, {
        vendor_id: vendorId,
        vendor_name: shortage.vendor_info.name,
        vendor_code: shortage.vendor_info.vendor_code,
        total_items: 0,
        items: []
      });
    }

    const vendorGroup = vendorMap.get(vendorId)!;
    vendorGroup.items.push(shortage);
    vendorGroup.total_items = vendorGroup.items.length;
  });

  return Array.from(vendorMap.values());
};

export const calculateMaterialShortages = async (
  productionOrders: any[]
): Promise<MaterialShortage[]> => {
  try {
    // Get all raw materials with their vendor relationships
    const { data: rawMaterials, error: materialsError } = await supabase
      .from("raw_materials")
      .select(`
        *,
        raw_material_vendors(
          is_primary,
          vendors(
            id,
            name,
            vendor_code
          )
        )
      `)
      .eq("is_active", true);

    if (materialsError) {
      console.error("Error fetching raw materials:", materialsError);
      throw materialsError;
    }

    // Get all BOMs for the products in production orders
    const productIds = productionOrders.map(order => order.product_id);
    const { data: bomItems, error: bomError } = await supabase
      .from("bom")
      .select(`
        *,
        raw_materials(
          id,
          material_code,
          name,
          raw_material_vendors(
            is_primary,
            vendors(
              id,
              name,
              vendor_code
            )
          )
        )
      `)
      .in("product_id", productIds);

    if (bomError) {
      console.error("Error fetching BOM items:", bomError);
      throw bomError;
    }

    // Get current inventory levels
    const { data: inventory, error: inventoryError } = await supabase
      .from("inventory")
      .select("*");

    if (inventoryError) {
      console.error("Error fetching inventory:", inventoryError);
      throw inventoryError;
    }

    // Calculate total requirements by material
    const materialRequirements = new Map<string, number>();

    productionOrders.forEach(order => {
      const orderBomItems = bomItems?.filter(item => item.product_id === order.product_id) || [];
      
      orderBomItems.forEach(bomItem => {
        const materialId = bomItem.raw_material_id;
        const requiredQty = bomItem.quantity * order.quantity;
        
        materialRequirements.set(
          materialId,
          (materialRequirements.get(materialId) || 0) + requiredQty
        );
      });
    });

    // Calculate shortages
    const shortages: MaterialShortage[] = [];

    materialRequirements.forEach((requiredQuantity, materialId) => {
      const material = rawMaterials?.find(m => m.id === materialId);
      if (!material) return;

      const inventoryItem = inventory?.find(inv => inv.raw_material_id === materialId);
      const availableQuantity = inventoryItem?.quantity || 0;
      const shortageQuantity = Math.max(0, requiredQuantity - availableQuantity);

      if (shortageQuantity > 0) {
        // Get primary vendor info
        const primaryVendor = material.raw_material_vendors?.find((rv: any) => rv.is_primary);
        
        shortages.push({
          raw_material_id: materialId,
          material_code: material.material_code,
          material_name: material.name,
          required_quantity: requiredQuantity,
          available_quantity: availableQuantity,
          shortage_quantity: shortageQuantity,
          vendor_info: primaryVendor ? {
            id: primaryVendor.vendors.id,
            name: primaryVendor.vendors.name,
            vendor_code: primaryVendor.vendors.vendor_code,
            is_primary: true
          } : undefined
        });
      }
    });

    return shortages;
  } catch (error) {
    console.error("Error calculating material shortages:", error);
    return [];
  }
};
