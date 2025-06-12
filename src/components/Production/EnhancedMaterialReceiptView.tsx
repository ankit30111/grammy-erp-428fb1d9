
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { useMaterialDispatchTracking } from "@/hooks/useMaterialDispatchTracking";
import { useProductionMaterialReceipts } from "@/hooks/useProductionMaterialReceipts";
import { useProductionLineAssignments } from "@/hooks/useProductionLineAssignments";
import BOMCategorySection from "./BOMCategorySection";
import { BOM_CATEGORIES, type BOMType, type BOMItem } from "@/types/bom";

interface EnhancedMaterialReceiptViewProps {
  productionOrderId: string;
  bomData: BOMItem[];
  requiredQuantities: Record<string, number>;
}

export default function EnhancedMaterialReceiptView({
  productionOrderId,
  bomData,
  requiredQuantities
}: EnhancedMaterialReceiptViewProps) {
  const materialIds = bomData.map(item => item.raw_material_id);
  
  const { data: dispatchData = {} } = useMaterialDispatchTracking(productionOrderId, materialIds);
  const { logProductionReceipt, isLoggingReceipt, getReceivedQuantity } = useProductionMaterialReceipts(productionOrderId);
  const { assignLine, isAssigning, getAssignmentForCategory } = useProductionLineAssignments(productionOrderId);

  // Group materials by BOM category
  const materialsByCategory = bomData.reduce((acc, item) => {
    const category = item.bom_type as BOMType;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<BOMType, BOMItem[]>);

  // Create sent quantities lookup
  const sentQuantities = materialIds.reduce((acc, materialId) => {
    acc[materialId] = dispatchData[materialId]?.totalSent || 0;
    return acc;
  }, {} as Record<string, number>);

  // Create received quantities lookup
  const receivedQuantities = materialIds.reduce((acc, materialId) => {
    acc[materialId] = getReceivedQuantity(materialId);
    return acc;
  }, {} as Record<string, number>);

  const handleReceiptLog = (materialId: string, quantity: number, notes?: string) => {
    logProductionReceipt({ 
      rawMaterialId: materialId, 
      quantity, 
      notes 
    });
  };

  const handleLineAssignment = (category: BOMType, line: string) => {
    assignLine({ bomCategory: category, productionLine: line });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material Receipt Verification - By BOM Category
            <Badge variant="outline">Production Side</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-6">
            Materials are organized by BOM categories. Assign production lines to each category 
            and verify material receipts accordingly.
          </div>
        </CardContent>
      </Card>

      {/* Render each BOM category */}
      {(Object.keys(BOM_CATEGORIES) as BOMType[]).map((category) => {
        const materials = materialsByCategory[category] || [];
        
        return (
          <BOMCategorySection
            key={category}
            category={category}
            materials={materials}
            productionOrderId={productionOrderId}
            requiredQuantities={requiredQuantities}
            sentQuantities={sentQuantities}
            receivedQuantities={receivedQuantities}
            onReceiptLog={handleReceiptLog}
            isLoggingReceipt={isLoggingReceipt}
            assignedLine={getAssignmentForCategory(category)}
            onLineAssignment={handleLineAssignment}
            isAssigning={isAssigning}
          />
        );
      })}

      {bomData.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4" />
              <p>No BOM data found for this production order</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
