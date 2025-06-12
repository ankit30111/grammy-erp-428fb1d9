
export type BOMType = 'main_assembly' | 'sub_assembly' | 'accessory';

export interface BOMItem {
  id: string;
  product_id: string;
  raw_material_id: string;
  quantity: number;
  bom_type: BOMType;
  is_critical: boolean;
  raw_materials: {
    id: string;
    material_code: string;
    name: string;
    category: string;
  };
}

export interface ProductionLineAssignment {
  id: string;
  production_order_id: string;
  bom_category: BOMType;
  production_line: string;
  assigned_at: string;
  assigned_by?: string;
}

export const BOM_CATEGORIES = {
  main_assembly: 'Main Assembly',
  sub_assembly: 'Sub Assembly', 
  accessory: 'Accessory'
} as const;

export const PRODUCTION_LINES = [
  'Line 1',
  'Line 2', 
  'Sub Assembly 1',
  'Sub Assembly 2'
] as const;
