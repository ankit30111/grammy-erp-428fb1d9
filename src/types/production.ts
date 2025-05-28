
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

export interface ScheduledProductionForProduction {
  id: string;
  voucherNumber: string;
  modelName: string;
  scheduledDate: string;
  quantity: number;
  kitStatus: "PREPARED" | "VERIFIED" | "SENT" | "SHORTAGE" | "READY" | "NOT_PREPARED";
  materialStatus: "AVAILABLE" | "PARTIAL" | "SHORTAGE";
  assignedLine?: string;
  productionStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
}
