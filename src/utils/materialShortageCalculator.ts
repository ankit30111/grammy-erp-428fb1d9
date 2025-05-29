
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
  projectionIds: string[]
): Promise<MaterialShortage[]> => {
  try {
    console.log('Calculating material shortages for projections:', projectionIds);

    if (!projectionIds.length) {
      console.log('No projection IDs provided');
      return [];
    }

    // Get projections with their products
    const { data: projections, error: projectionsError } = await supabase
      .from("projections")
      .select(`
        id,
        quantity,
        product_id,
        products!inner(
          id,
          name
        )
      `)
      .in("id", projectionIds);

    if (projectionsError) {
      console.error("Error fetching projections:", projectionsError);
      throw projectionsError;
    }

    console.log('Fetched projections:', projections);

    if (!projections?.length) {
      console.log('No projections found');
      return [];
    }

    // Get product IDs from projections
    const productIds = projections.map(p => p.product_id);
    console.log('Product IDs:', productIds);

    // Get BOM items for these products with raw material details
    const { data: bomItems, error: bomError } = await supabase
      .from("bom")
      .select(`
        product_id,
        raw_material_id,
        quantity,
        raw_materials!inner(
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

    console.log('Fetched BOM items:', bomItems);

    // Get current inventory levels
    const { data: inventory, error: inventoryError } = await supabase
      .from("inventory")
      .select("raw_material_id, quantity");

    if (inventoryError) {
      console.error("Error fetching inventory:", inventoryError);
      throw inventoryError;
    }

    console.log('Fetched inventory:', inventory);

    // Calculate total requirements by material
    const materialRequirements = new Map<string, {
      totalRequired: number;
      material: any;
    }>();

    projections.forEach(projection => {
      const projectBomItems = bomItems?.filter(item => item.product_id === projection.product_id) || [];
      console.log(`BOM items for product ${projection.product_id}:`, projectBomItems);
      
      projectBomItems.forEach(bomItem => {
        const materialId = bomItem.raw_material_id;
        const requiredQty = bomItem.quantity * projection.quantity;
        
        const existing = materialRequirements.get(materialId);
        materialRequirements.set(materialId, {
          totalRequired: (existing?.totalRequired || 0) + requiredQty,
          material: bomItem.raw_materials
        });
      });
    });

    console.log('Material requirements calculated:', Array.from(materialRequirements.entries()));

    // Calculate shortages
    const shortages: MaterialShortage[] = [];

    materialRequirements.forEach(({ totalRequired, material }, materialId) => {
      const inventoryItem = inventory?.find(inv => inv.raw_material_id === materialId);
      const availableQuantity = inventoryItem?.quantity || 0;
      const shortageQuantity = Math.max(0, totalRequired - availableQuantity);

      console.log(`Material ${materialId}: Required=${totalRequired}, Available=${availableQuantity}, Shortage=${shortageQuantity}`);

      if (shortageQuantity > 0) {
        // Get primary vendor info
        const primaryVendor = material.raw_material_vendors?.find((rv: any) => rv.is_primary);
        
        shortages.push({
          raw_material_id: materialId,
          material_code: material.material_code,
          material_name: material.name,
          required_quantity: totalRequired,
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

    console.log('Calculated shortages:', shortages);
    return shortages;
  } catch (error) {
    console.error("Error calculating material shortages:", error);
    return [];
  }
};
