
export interface Production {
  id: string;
  customer: string;
  product: string;
  quantity: number;
  line: string;
}

export interface RawMaterialShortage {
  partCode: string;
  description: string;
  required: number;
  available: number;
  shortage: number;
}

export interface PlannedDate {
  overbooked?: boolean;
  productions?: Production[];
  materialStatus?: {
    available: boolean;
    shortages: RawMaterialShortage[];
  };
}

export interface PlannedDates {
  [date: string]: PlannedDate;
}

// Empty data arrays - will be populated from database
export const projections: any[] = [];
export const productionLines: any[] = [];
export const bom: any = {};
export const inventory: any = {};
