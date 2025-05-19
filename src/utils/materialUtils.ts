
import { bom, inventory, PlannedDates, RawMaterialShortage } from "@/types/ppc";

// Check material availability for a specific product and quantity
export const checkMaterialAvailability = (
  product: string, 
  qty: number
) => {
  const shortages: RawMaterialShortage[] = [];
  let allAvailable = true;
  
  const productBom = bom[product as keyof typeof bom] || [];
  
  productBom.forEach(part => {
    const requiredQty = part.quantity * qty;
    const availableQty = inventory[part.partCode as keyof typeof inventory] || 0;
    
    if (availableQty < requiredQty) {
      shortages.push({
        partCode: part.partCode,
        description: part.description,
        required: requiredQty,
        available: availableQty,
        shortage: requiredQty - availableQty
      });
      allAvailable = false;
    }
  });
  
  return { available: allAvailable, shortages };
};

// Check if materials are available for scheduled productions on a specific date
export const checkMaterialAvailabilityForDate = (
  formattedDate: string,
  plannedDates: PlannedDates
) => {
  const dateProductions = plannedDates[formattedDate]?.productions || [];
  const shortages: RawMaterialShortage[] = [];
  let allAvailable = true;
  
  // Create a copy of inventory to track remaining quantities after allocation
  const remainingInventory = { ...inventory };
  
  // Calculate total requirements for each part based on scheduled productions
  dateProductions.forEach(production => {
    const productBom = bom[production.product as keyof typeof bom] || [];
    
    productBom.forEach(part => {
      const requiredQty = part.quantity * production.quantity;
      const availableQty = remainingInventory[part.partCode as keyof typeof remainingInventory] || 0;
      
      if (availableQty < requiredQty) {
        const shortageQty = requiredQty - availableQty;
        const existingShortageIndex = shortages.findIndex(s => s.partCode === part.partCode);
        
        if (existingShortageIndex >= 0) {
          shortages[existingShortageIndex].required += requiredQty;
          shortages[existingShortageIndex].shortage += shortageQty;
        } else {
          shortages.push({
            partCode: part.partCode,
            description: part.description,
            required: requiredQty,
            available: availableQty,
            shortage: shortageQty
          });
        }
        
        allAvailable = false;
        remainingInventory[part.partCode as keyof typeof remainingInventory] = 0;
      } else {
        remainingInventory[part.partCode as keyof typeof remainingInventory] -= requiredQty;
      }
    });
  });
  
  return { available: allAvailable, shortages };
};
