
export type KitStatus = "KIT SCHEDULED" | "KIT VERIFIED" | "KIT SENT" | "KIT SHORTAGE" | "KIT READY" | "YET TO PLANNED";

export interface ScheduledProduction {
  id: string;
  voucherNumber: string;
  modelName: string;
  scheduledDate: string;
  quantity: number;
  kitStatus: KitStatus;
  materialStatus: "AVAILABLE" | "PARTIAL" | "SHORTAGE";
  kitReceived?: boolean;
  shortageReported?: boolean;
}

export interface BOMItem {
  partCode: string;
  description: string;
  quantity: number;
  required: number;
  available: number;
  shortage: number;
  status: "AVAILABLE" | "SHORTAGE";
}

export interface ProductionVoucherDetail {
  voucherNumber: string;
  modelName: string;
  productionQuantity: number;
  bomItems: BOMItem[];
  overallStatus: "AVAILABLE" | "PARTIAL" | "SHORTAGE";
}

export interface GRNItem {
  id: string;
  grnNumber: string;
  partCode: string;
  description: string;
  vendor: string;
  expectedQuantity: number;
  receivedQuantity?: number;
  hasDiscrepancy: boolean;
  date: string;
  status: "PENDING" | "RECEIVED" | "DISCREPANCY";
  poNumber: string;
}

export interface MaterialRequest {
  id: string;
  voucherNumber: string;
  partCode: string;
  description: string;
  originalQuantity: number;
  additionalQuantity: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  date: string;
  requestType: "SHORT_MATERIAL" | "DAMAGED_MATERIAL";
}

export interface InventoryItem {
  partCode: string;
  description: string;
  quantity: number;
  location: string;
  bin: string;
  lastUpdated: string;
  minimumStock: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}

// Helper function to generate voucher numbers
export const generateVoucherNumber = (date: Date, sequence: number): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(2, '0');
  return `${month}-${seq}`;
};

// Empty data arrays - will be populated from database
export const mockScheduledProductions: ScheduledProduction[] = [];
export const mockGRNs: GRNItem[] = [];
export const mockMaterialRequests: MaterialRequest[] = [];
export const mockInventory: InventoryItem[] = [];
