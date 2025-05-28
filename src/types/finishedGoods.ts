
export interface FinishedGoodsInventory {
  id: string;
  modelName: string;
  lotNumber: string;
  quantity: number;
  manufactureDate: string;
  oqcApprovedDate: string;
  expiryDate?: string;
  status: "AVAILABLE" | "RESERVED" | "EXPIRED" | "QUARANTINE";
  location: string;
  bin: string;
  batchId: string;
  qualityGrade: "A" | "B" | "C";
  inventoryAge: number; // days in inventory
}

export interface FinishedGoodsMovement {
  id: string;
  type: "INBOUND" | "OUTBOUND";
  modelName: string;
  lotNumber: string;
  quantity: number;
  date: string;
  reference: string; // OQC approval or dispatch order
  notes?: string;
}

export interface ModelStock {
  modelName: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  oldestLotDate: string;
  averageAge: number;
  lots: FinishedGoodsInventory[];
}

// Mock data for finished goods inventory
export const mockFinishedGoodsInventory: FinishedGoodsInventory[] = [
  {
    id: "FG-001",
    modelName: "Speaker A300",
    lotNumber: "LOT-A300-001",
    quantity: 85,
    manufactureDate: "2025-05-15",
    oqcApprovedDate: "2025-05-16",
    status: "AVAILABLE",
    location: "FG-ZONE-A",
    bin: "A-01-01",
    batchId: "PB-001",
    qualityGrade: "A",
    inventoryAge: 12
  },
  {
    id: "FG-002",
    modelName: "Speaker A300",
    lotNumber: "LOT-A300-002",
    quantity: 50,
    manufactureDate: "2025-05-20",
    oqcApprovedDate: "2025-05-21",
    status: "AVAILABLE",
    location: "FG-ZONE-A",
    bin: "A-01-02",
    batchId: "PB-002",
    qualityGrade: "A",
    inventoryAge: 7
  },
  {
    id: "FG-003",
    modelName: "Subwoofer S200",
    lotNumber: "LOT-S200-001",
    quantity: 30,
    manufactureDate: "2025-05-18",
    oqcApprovedDate: "2025-05-19",
    status: "AVAILABLE",
    location: "FG-ZONE-B",
    bin: "B-01-01",
    batchId: "PB-003",
    qualityGrade: "A",
    inventoryAge: 9
  },
  {
    id: "FG-004",
    modelName: "Tweeter T100",
    lotNumber: "LOT-T100-001",
    quantity: 180,
    manufactureDate: "2025-05-10",
    oqcApprovedDate: "2025-05-11",
    status: "AVAILABLE",
    location: "FG-ZONE-C",
    bin: "C-01-01",
    batchId: "PB-004",
    qualityGrade: "A",
    inventoryAge: 17
  },
  {
    id: "FG-005",
    modelName: "Speaker A300",
    lotNumber: "LOT-A300-003",
    quantity: 25,
    manufactureDate: "2025-05-08",
    oqcApprovedDate: "2025-05-09",
    status: "AVAILABLE",
    location: "FG-ZONE-A",
    bin: "A-02-01",
    batchId: "PB-005",
    qualityGrade: "B",
    inventoryAge: 19
  }
];

// Mock data for recent movements
export const mockFinishedGoodsMovements: FinishedGoodsMovement[] = [
  {
    id: "MOV-001",
    type: "INBOUND",
    modelName: "Speaker A300",
    lotNumber: "LOT-A300-002",
    quantity: 50,
    date: "2025-05-21",
    reference: "OQC-APPROVAL-002",
    notes: "OQC approved - Grade A"
  },
  {
    id: "MOV-002",
    type: "OUTBOUND",
    modelName: "Tweeter T100",
    lotNumber: "LOT-T100-001",
    quantity: 20,
    date: "2025-05-22",
    reference: "DISPATCH-ORD-001",
    notes: "Dispatched to customer XYZ"
  },
  {
    id: "MOV-003",
    type: "INBOUND",
    modelName: "Subwoofer S200",
    lotNumber: "LOT-S200-001",
    quantity: 30,
    date: "2025-05-19",
    reference: "OQC-APPROVAL-001",
    notes: "OQC approved - Grade A"
  }
];

// Helper function to group inventory by model
export const groupInventoryByModel = (inventory: FinishedGoodsInventory[]): ModelStock[] => {
  const grouped = inventory.reduce((acc, item) => {
    if (!acc[item.modelName]) {
      acc[item.modelName] = [];
    }
    acc[item.modelName].push(item);
    return acc;
  }, {} as Record<string, FinishedGoodsInventory[]>);

  return Object.entries(grouped).map(([modelName, lots]) => {
    const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    const availableQuantity = lots
      .filter(lot => lot.status === "AVAILABLE")
      .reduce((sum, lot) => sum + lot.quantity, 0);
    const reservedQuantity = lots
      .filter(lot => lot.status === "RESERVED")
      .reduce((sum, lot) => sum + lot.quantity, 0);
    
    const sortedLots = lots.sort((a, b) => new Date(a.oqcApprovedDate).getTime() - new Date(b.oqcApprovedDate).getTime());
    const oldestLotDate = sortedLots[0]?.oqcApprovedDate || "";
    const averageAge = lots.reduce((sum, lot) => sum + lot.inventoryAge, 0) / lots.length;

    return {
      modelName,
      totalQuantity,
      availableQuantity,
      reservedQuantity,
      oldestLotDate,
      averageAge: Math.round(averageAge),
      lots: sortedLots
    };
  });
};
