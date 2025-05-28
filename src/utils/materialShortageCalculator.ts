
import { supabase } from "@/integrations/supabase/client";

export interface MaterialShortage {
  raw_material_id: string;
  material_code: string;
  material_name: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  vendor_id: string;
  vendor_name: string;
}

export const calculateMaterialShortages = async (projectionIds: string[]): Promise<MaterialShortage[]> => {
  console.log('Calculating material shortages for projections:', projectionIds);

  // Get projections with product details
  const { data: projections, error: projError } = await supabase
    .from('projections')
    .select(`
      id,
      quantity,
      product_id,
      products (
        id,
        name
      )
    `)
    .in('id', projectionIds);

  if (projError) throw projError;
  if (!projections?.length) return [];

  // Get BOM for all products
  const productIds = projections.map(p => p.product_id);
  const { data: bomData, error: bomError } = await supabase
    .from('bom')
    .select(`
      product_id,
      raw_material_id,
      quantity,
      raw_materials (
        id,
        name,
        material_code,
        vendor_id,
        vendors (
          id,
          name
        )
      )
    `)
    .in('product_id', productIds);

  if (bomError) throw bomError;
  if (!bomData?.length) return [];

  // Get current inventory
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('raw_material_id, quantity');

  if (invError) throw invError;

  // Calculate material requirements
  const materialRequirements = new Map<string, {
    required: number;
    material_code: string;
    material_name: string;
    vendor_id: string;
    vendor_name: string;
  }>();

  projections.forEach(projection => {
    const productBOM = bomData.filter(bom => bom.product_id === projection.product_id);
    
    productBOM.forEach(bomItem => {
      const materialId = bomItem.raw_material_id;
      const requiredQty = bomItem.quantity * projection.quantity;
      
      if (materialRequirements.has(materialId)) {
        materialRequirements.get(materialId)!.required += requiredQty;
      } else {
        materialRequirements.set(materialId, {
          required: requiredQty,
          material_code: bomItem.raw_materials?.material_code || '',
          material_name: bomItem.raw_materials?.name || '',
          vendor_id: bomItem.raw_materials?.vendor_id || '',
          vendor_name: bomItem.raw_materials?.vendors?.name || '',
        });
      }
    });
  });

  // Calculate shortages
  const shortages: MaterialShortage[] = [];

  materialRequirements.forEach((requirement, materialId) => {
    const inventoryItem = inventory?.find(inv => inv.raw_material_id === materialId);
    const availableQty = inventoryItem?.quantity || 0;
    const shortageQty = Math.max(0, requirement.required - availableQty);

    if (shortageQty > 0) {
      shortages.push({
        raw_material_id: materialId,
        material_code: requirement.material_code,
        material_name: requirement.material_name,
        required_quantity: requirement.required,
        available_quantity: availableQty,
        shortage_quantity: shortageQty,
        vendor_id: requirement.vendor_id,
        vendor_name: requirement.vendor_name,
      });
    }
  });

  console.log('Calculated shortages:', shortages);
  return shortages;
};

export const groupShortagesByVendor = (shortages: MaterialShortage[]) => {
  const grouped = new Map<string, {
    vendor_id: string;
    vendor_name: string;
    items: MaterialShortage[];
    total_items: number;
  }>();

  shortages.forEach(shortage => {
    if (!grouped.has(shortage.vendor_id)) {
      grouped.set(shortage.vendor_id, {
        vendor_id: shortage.vendor_id,
        vendor_name: shortage.vendor_name,
        items: [],
        total_items: 0,
      });
    }
    
    const vendor = grouped.get(shortage.vendor_id)!;
    vendor.items.push(shortage);
    vendor.total_items++;
  });

  return Array.from(grouped.values());
};
