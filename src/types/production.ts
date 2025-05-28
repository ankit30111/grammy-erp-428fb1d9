
export interface ProductionLine {
  id: string;
  name: string;
  status: "IDLE" | "RUNNING" | "MAINTENANCE" | "SETUP";
  currentVoucher?: string;
  currentProduct?: string;
  progress?: number;
  operator?: string;
  startTime?: string;
  estimatedCompletion?: string;
}

export interface ReceivedKit {
  voucherNumber: string;
  modelName: string;
  receivedDate: string;
  bomItems: BOMReceivedItem[];
  verificationStatus: "PENDING" | "VERIFIED" | "DISCREPANCY";
  assignedLine?: string;
}

export interface BOMReceivedItem {
  partCode: string;
  description: string;
  expectedQuantity: number;
  receivedQuantity?: number;
  verified: boolean;
  hasDiscrepancy: boolean;
}

export interface MaterialShortageRequest {
  id: string;
  voucherNumber: string;
  partCode: string;
  description: string;
  requiredQuantity: number;
  reason: "SHORT_MATERIAL" | "DAMAGED_MATERIAL";
  requestDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes?: string;
}

export interface OQCRejection {
  id: string;
  voucherNumber: string;
  lotNumber: string;
  rejectionDate: string;
  rejectionReason: string;
  rejectedQuantity: number;
  status: "PENDING_REWORK" | "REWORK_IN_PROGRESS" | "CAPA_UPLOADED" | "RESOLVED";
  capaDocument?: string;
  reworkNotes?: string;
}

// Mock data for production lines
export const mockProductionLines: ProductionLine[] = [
  {
    id: "PL1",
    name: "Production Line 1",
    status: "RUNNING",
    currentVoucher: "05-01",
    currentProduct: "Speaker A300",
    progress: 65,
    operator: "John Doe",
    startTime: "08:00",
    estimatedCompletion: "16:30"
  },
  {
    id: "PL2",
    name: "Production Line 2",
    status: "SETUP",
    currentVoucher: "05-02",
    currentProduct: "Subwoofer S200",
    progress: 0,
    operator: "Jane Smith",
    startTime: "09:00",
    estimatedCompletion: "17:00"
  },
  {
    id: "SA1",
    name: "Sub Assembly 1",
    status: "RUNNING",
    currentVoucher: "05-03",
    currentProduct: "Tweeter T100",
    progress: 45,
    operator: "Mike Johnson",
    startTime: "07:30",
    estimatedCompletion: "15:30"
  },
  {
    id: "SA2",
    name: "Sub Assembly 2",
    status: "IDLE",
    operator: "Sarah Wilson"
  }
];

// Mock data for received kits
export const mockReceivedKits: ReceivedKit[] = [
  {
    voucherNumber: "05-01",
    modelName: "Speaker A300",
    receivedDate: "2025-05-21",
    verificationStatus: "VERIFIED",
    assignedLine: "Production Line 1",
    bomItems: [
      {
        partCode: "PCB-123",
        description: "Main PCB",
        expectedQuantity: 100,
        receivedQuantity: 100,
        verified: true,
        hasDiscrepancy: false
      },
      {
        partCode: "SPK-A44",
        description: "Speaker Driver",
        expectedQuantity: 200,
        receivedQuantity: 195,
        verified: true,
        hasDiscrepancy: true
      }
    ]
  },
  {
    voucherNumber: "05-02",
    modelName: "Subwoofer S200",
    receivedDate: "2025-05-22",
    verificationStatus: "PENDING",
    bomItems: [
      {
        partCode: "PCB-234",
        description: "Amplifier PCB",
        expectedQuantity: 50,
        verified: false,
        hasDiscrepancy: false
      },
      {
        partCode: "SPK-B66",
        description: "Woofer Driver",
        expectedQuantity: 50,
        verified: false,
        hasDiscrepancy: false
      }
    ]
  }
];

// Mock data for material shortage requests
export const mockMaterialRequests: MaterialShortageRequest[] = [
  {
    id: "MSR-001",
    voucherNumber: "05-01",
    partCode: "SPK-A44",
    description: "Speaker Driver",
    requiredQuantity: 5,
    reason: "SHORT_MATERIAL",
    requestDate: "2025-05-21",
    status: "APPROVED",
    notes: "5 units short from kit verification"
  },
  {
    id: "MSR-002",
    voucherNumber: "05-01",
    partCode: "PCB-123",
    description: "Main PCB",
    requiredQuantity: 3,
    reason: "DAMAGED_MATERIAL",
    requestDate: "2025-05-22",
    status: "PENDING",
    notes: "3 units damaged during assembly"
  }
];

// Mock data for OQC rejections
export const mockOQCRejections: OQCRejection[] = [
  {
    id: "OQC-REJ-001",
    voucherNumber: "05-01",
    lotNumber: "LOT-A300-001",
    rejectionDate: "2025-05-21",
    rejectionReason: "Frequency response out of specification",
    rejectedQuantity: 15,
    status: "CAPA_UPLOADED",
    capaDocument: "CAPA-A300-001.pdf",
    reworkNotes: "Adjusted crossover frequency, retested OK"
  },
  {
    id: "OQC-REJ-002",
    voucherNumber: "05-02",
    lotNumber: "LOT-S200-001",
    rejectionDate: "2025-05-22",
    rejectionReason: "Visual defects on housing",
    rejectedQuantity: 8,
    status: "PENDING_REWORK"
  }
];
