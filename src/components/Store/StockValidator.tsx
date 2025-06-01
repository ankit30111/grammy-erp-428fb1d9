
import { supabase } from "@/integrations/supabase/client";

export interface StockValidationResult {
  isValid: boolean;
  shortageItems: Array<{
    material_code: string;
    material_name: string;
    required: number;
    available: number;
    shortage: number;
  }>;
}

type BomType = "main_assembly" | "sub_assembly" | "accessory";

export const validateStockForComponent = async (
  productId: string, 
  quantity: number, 
  bomType: BomType
): Promise<StockValidationResult> => {
  try {
    // Get BOM items for the specific component type
    const { data: bomItems, error: bomError } = await supabase
      .from("bom")
      .select(`
        *,
        raw_materials!inner(
          id,
          material_code,
          name,
          inventory(quantity)
        )
      `)
      .eq("product_id", productId)
      .eq("bom_type", bomType);

    if (bomError) throw bomError;

    const shortageItems: any[] = [];
    let isValid = true;

    bomItems?.forEach(bomItem => {
      const requiredQty = bomItem.quantity * quantity;
      const availableQty = bomItem.raw_materials.inventory?.[0]?.quantity || 0;
      
      if (availableQty < requiredQty) {
        isValid = false;
        shortageItems.push({
          material_code: bomItem.raw_materials.material_code,
          material_name: bomItem.raw_materials.name,
          required: requiredQty,
          available: availableQty,
          shortage: requiredQty - availableQty
        });
      }
    });

    return { isValid, shortageItems };
  } catch (error) {
    console.error("Error validating stock:", error);
    return { isValid: false, shortageItems: [] };
  }
};
