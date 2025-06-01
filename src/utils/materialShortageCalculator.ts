
import { supabase } from "@/integrations/supabase/client";

export interface MaterialShortage {
  raw_material_id: string;
  material_code: string;
  material_name: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  vendor_info?: {
    vendor_id: string;
    vendor_name: string;
    vendor_code: string;
  };
}

export interface VendorGroup {
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  items: MaterialShortage[];
}

export const calculateMaterialShortages = async (projectionIds: string[]): Promise<MaterialShortage[]> => {
  if (!projectionIds.length) return [];

  try {
    // Get material requirements from the view, excluding those with active POs
    const { data: requirements, error } = await supabase
      .from('material_requirements_view')
      .select('*')
      .in('projection_id', projectionIds);

    if (error) throw error;

    // Get materials that have active purchase orders (not yet fully received)
    const { data: activePOs, error: poError } = await supabase
      .from('purchase_order_items')
      .select(`
        raw_material_id,
        quantity,
        received_quantity,
        purchase_orders!inner(status)
      `)
      .in('purchase_orders.status', ['PENDING', 'SENT', 'PARTIAL']);

    if (poError) throw poError;

    // Create a set of materials with active POs
    const materialsWithActivePOs = new Set(
      activePOs
        ?.filter(po => (po.received_quantity || 0) < po.quantity)
        .map(po => po.raw_material_id) || []
    );

    // Group requirements by material and calculate shortages
    const materialMap = new Map<string, {
      material_code: string;
      material_name: string;
      total_required: number;
      available_quantity: number;
      vendor_info?: any;
    }>();

    requirements?.forEach((req) => {
      if (!req.raw_material_id) return;
      
      const key = req.raw_material_id;
      const existing = materialMap.get(key);
      
      if (existing) {
        existing.total_required += req.total_required || 0;
      } else {
        materialMap.set(key, {
          material_code: req.material_code || '',
          material_name: req.material_name || '',
          total_required: req.total_required || 0,
          available_quantity: req.available_quantity || 0,
        });
      }
    });

    // Get vendor information for materials
    const { data: vendorData, error: vendorError } = await supabase
      .from('raw_material_vendors')
      .select(`
        raw_material_id,
        vendors!inner(id, name, vendor_code)
      `)
      .eq('is_primary', true);

    if (vendorError) throw vendorError;

    const vendorMap = new Map();
    vendorData?.forEach(v => {
      vendorMap.set(v.raw_material_id, {
        vendor_id: v.vendors.id,
        vendor_name: v.vendors.name,
        vendor_code: v.vendors.vendor_code,
      });
    });

    // Calculate shortages, excluding materials with active POs
    const shortages: MaterialShortage[] = [];
    
    materialMap.forEach((data, materialId) => {
      // Skip materials that have active purchase orders
      if (materialsWithActivePOs.has(materialId)) {
        return;
      }

      const shortage = data.total_required - data.available_quantity;
      
      if (shortage > 0) {
        shortages.push({
          raw_material_id: materialId,
          material_code: data.material_code,
          material_name: data.material_name,
          required_quantity: data.total_required,
          available_quantity: data.available_quantity,
          shortage_quantity: shortage,
          vendor_info: vendorMap.get(materialId),
        });
      }
    });

    return shortages;
  } catch (error) {
    console.error('Error calculating material shortages:', error);
    return [];
  }
};

export const groupShortagesByVendor = (shortages: MaterialShortage[]): VendorGroup[] => {
  const vendorMap = new Map<string, VendorGroup>();

  shortages.forEach((shortage) => {
    if (!shortage.vendor_info) return;

    const vendorId = shortage.vendor_info.vendor_id;
    
    if (!vendorMap.has(vendorId)) {
      vendorMap.set(vendorId, {
        vendor_id: vendorId,
        vendor_name: shortage.vendor_info.vendor_name,
        vendor_code: shortage.vendor_info.vendor_code,
        items: [],
      });
    }

    vendorMap.get(vendorId)!.items.push(shortage);
  });

  return Array.from(vendorMap.values());
};
