
export type KitStatus = "KIT SCHEDULED" | "KIT VERIFIED" | "KIT SENT" | "KIT SHORTAGE";

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

// Mock data for scheduled production with auto-generated vouchers
export const mockScheduledProductions: ScheduledProduction[] = [
  {
    id: "1",
    voucherNumber: generateVoucherNumber(new Date('2025-05-21'), 1),
    modelName: "Speaker A300",
    scheduledDate: "2025-05-21",
    quantity: 100,
    kitStatus: "KIT SENT",
    materialStatus: "AVAILABLE",
    kitReceived: true,
    shortageReported: false
  },
  {
    id: "2",
    voucherNumber: generateVoucherNumber(new Date('2025-05-22'), 2),
    modelName: "Subwoofer S200",
    scheduledDate: "2025-05-22",
    quantity: 50,
    kitStatus: "KIT VERIFIED",
    materialStatus: "AVAILABLE"
  },
  {
    id: "3",
    voucherNumber: generateVoucherNumber(new Date('2025-05-23'), 3),
    modelName: "Speaker A100",
    scheduledDate: "2025-05-23",
    quantity: 75,
    kitStatus: "KIT SCHEDULED",
    materialStatus: "SHORTAGE"
  },
  {
    id: "4",
    voucherNumber: generateVoucherNumber(new Date('2025-05-24'), 4),
    modelName: "Tweeter T100",
    scheduledDate: "2025-05-24",
    quantity: 200,
    kitStatus: "KIT SCHEDULED",
    materialStatus: "PARTIAL"
  }
];

// Mock data for GRNs with PO numbers
export const mockGRNs: GRNItem[] = [
  {
    id: "1",
    grnNumber: "GRN-1001",
    partCode: "PCB-123",
    description: "Main PCB",
    vendor: "Tech Circuits Ltd",
    expectedQuantity: 500,
    date: "2025-05-19",
    status: "PENDING",
    hasDiscrepancy: false,
    poNumber: "PO-2025-001"
  },
  {
    id: "2",
    grnNumber: "GRN-1002",
    partCode: "SPK-A44",
    description: "Speaker Driver",
    vendor: "Audio Parts Inc",
    expectedQuantity: 300,
    receivedQuantity: 280,
    date: "2025-05-20",
    status: "DISCREPANCY",
    hasDiscrepancy: true,
    poNumber: "PO-2025-002"
  },
  {
    id: "3",
    grnNumber: "GRN-1003",
    partCode: "CAP-333",
    description: "Capacitor 10μF",
    vendor: "Components Supply",
    expectedQuantity: 1000,
    receivedQuantity: 1000,
    date: "2025-05-20",
    status: "RECEIVED",
    hasDiscrepancy: false,
    poNumber: "PO-2025-003"
  }
];

// Mock data for material requests
export const mockMaterialRequests: MaterialRequest[] = [
  {
    id: "1",
    voucherNumber: "05-01",
    partCode: "PCB-123",
    description: "Main PCB",
    originalQuantity: 100,
    additionalQuantity: 5,
    reason: "Line rejection due to quality",
    status: "PENDING",
    date: "2025-05-21",
    requestType: "DAMAGED_MATERIAL"
  },
  {
    id: "2",
    voucherNumber: "05-01",
    partCode: "SPK-A44",
    description: "Speaker Driver",
    originalQuantity: 200,
    additionalQuantity: 10,
    reason: "User mishandling",
    status: "APPROVED",
    date: "2025-05-21",
    requestType: "SHORT_MATERIAL"
  }
];

// Mock inventory data
export const mockInventory: InventoryItem[] = [
  {
    partCode: "PCB-123",
    description: "Main PCB",
    quantity: 450,
    location: "A1",
    bin: "BIN-001",
    lastUpdated: "2025-05-21",
    minimumStock: 100,
    status: "IN_STOCK"
  },
  {
    partCode: "SPK-A44",
    description: "Speaker Driver",
    quantity: 25,
    location: "B2",
    bin: "BIN-025",
    lastUpdated: "2025-05-20",
    minimumStock: 50,
    status: "LOW_STOCK"
  },
  {
    partCode: "CAP-333",
    description: "Capacitor 10μF",
    quantity: 1500,
    location: "C3",
    bin: "BIN-033",
    lastUpdated: "2025-05-20",
    minimumStock: 200,
    status: "IN_STOCK"
  }
];
