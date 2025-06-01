
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
