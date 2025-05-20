
export type KitStatus = "KIT SENT" | "KIT READY" | "KIT SHORTAGE" | "YET TO PLANNED";

export interface ScheduledProduction {
  id: string;
  voucherNumber: string;
  modelName: string;
  scheduledDate: string;
  quantity: number;
  kitStatus: KitStatus;
  kitReceived?: boolean;
  shortageReported?: boolean;
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
}

// Mock data for scheduled production
export const mockScheduledProductions: ScheduledProduction[] = [
  {
    id: "1",
    voucherNumber: "PRO-0401",
    modelName: "Speaker A300",
    scheduledDate: "2025-05-21",
    quantity: 100,
    kitStatus: "KIT SENT",
    kitReceived: true,
    shortageReported: false
  },
  {
    id: "2",
    voucherNumber: "PRO-0402",
    modelName: "Subwoofer S200",
    scheduledDate: "2025-05-22",
    quantity: 50,
    kitStatus: "KIT READY"
  },
  {
    id: "3",
    voucherNumber: "PRO-0403",
    modelName: "Speaker A100",
    scheduledDate: "2025-05-23",
    quantity: 75,
    kitStatus: "KIT SHORTAGE"
  },
  {
    id: "4",
    voucherNumber: "PRO-0404",
    modelName: "Tweeter T100",
    scheduledDate: "2025-05-24",
    quantity: 200,
    kitStatus: "YET TO PLANNED"
  }
];

// Mock data for GRNs
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
    hasDiscrepancy: false
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
    hasDiscrepancy: true
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
    hasDiscrepancy: false
  }
];

// Mock data for material requests
export const mockMaterialRequests: MaterialRequest[] = [
  {
    id: "1",
    voucherNumber: "PRO-0401",
    partCode: "PCB-123",
    description: "Main PCB",
    originalQuantity: 100,
    additionalQuantity: 5,
    reason: "Line rejection due to quality",
    status: "PENDING",
    date: "2025-05-21"
  },
  {
    id: "2",
    voucherNumber: "PRO-0401",
    partCode: "SPK-A44",
    description: "Speaker Driver",
    originalQuantity: 200,
    additionalQuantity: 10,
    reason: "User mishandling",
    status: "APPROVED",
    date: "2025-05-21"
  }
];
