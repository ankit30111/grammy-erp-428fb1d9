
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, CheckCircle, Clock } from "lucide-react";
import { useMaterialDispatchTracking } from "@/hooks/useMaterialDispatchTracking";
import { useProductionMaterialReceipts } from "@/hooks/useProductionMaterialReceipts";
import { useProductionDiscrepancies } from "@/hooks/useProductionDiscrepancies";
import ProductionMaterialReceiptInput from "./ProductionMaterialReceiptInput";

interface EnhancedMaterialReceiptViewProps {
  productionOrderId: string;
  bomData: any[];
  requiredQuantities: Record<string, number>;
}

export default function EnhancedMaterialReceiptView({
  productionOrderId,
  bomData,
  requiredQuantities
}: EnhancedMaterialReceiptViewProps) {
  const materialIds = bomData.map(item => item.raw_materials.id);
  
  const { data: dispatchData = {} } = useMaterialDispatchTracking(productionOrderId, materialIds);
  const { logProductionReceipt, isLoggingReceipt, getReceivedQuantity } = useProductionMaterialReceipts(productionOrderId);
  const { discrepancies } = useProductionDiscrepancies(productionOrderId);

  const getDiscrepancyForMaterial = (materialId: string) => {
    return discrepancies.find(d => d.raw_material_id === materialId && d.status === 'PENDING');
  };

  const getMaterialStatus = (materialId: string) => {
    const sentQty = dispatchData[materialId]?.totalSent || 0;
    const receivedQty = getReceivedQuantity(materialId);
    const discrepancy = getDiscrepancyForMaterial(materialId);

    if (discrepancy) {
      return {
        status: 'discrepancy',
        badge: <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Discrepancy Detected
        </Badge>
      };
    }

    if (receivedQty >= sentQty && sentQty > 0) {
      return {
        status: 'complete',
        badge: <Badge className="bg-green-100 text-green-800 gap-1">
          <CheckCircle className="h-3 w-3" />
          Fully Received
        </Badge>
      };
    }

    if (receivedQty > 0) {
      return {
        status: 'partial',
        badge: <Badge variant="secondary" className="gap-1">
          <Package className="h-3 w-3" />
          Partially Received
        </Badge>
      };
    }

    if (sentQty > 0) {
      return {
        status: 'pending',
        badge: <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Awaiting Receipt
        </Badge>
      };
    }

    return {
      status: 'not-sent',
      badge: <Badge variant="outline">Not Dispatched</Badge>
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Material Receipt Verification
          <Badge variant="outline">Production Side</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bomData.map((bomItem: any) => {
            const materialId = bomItem.raw_materials.id;
            const sentQty = dispatchData[materialId]?.totalSent || 0;
            const receivedQty = getReceivedQuantity(materialId);
            const requiredQty = requiredQuantities[materialId] || 0;
            const materialStatus = getMaterialStatus(materialId);
            
            return (
              <div key={materialId} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{bomItem.raw_materials.material_code}</div>
                    <div className="text-sm text-muted-foreground">{bomItem.raw_materials.name}</div>
                  </div>
                  {materialStatus.badge}
                </div>

                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Required:</span>
                    <div className="font-medium">{requiredQty}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sent by Store:</span>
                    <div className="font-medium text-blue-600">{sentQty}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Received:</span>
                    <div className="font-medium text-green-600">{receivedQty}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Balance:</span>
                    <div className="font-medium text-orange-600">{Math.max(0, sentQty - receivedQty)}</div>
                  </div>
                </div>

                {sentQty > 0 && (
                  <ProductionMaterialReceiptInput
                    materialCode={bomItem.raw_materials.material_code}
                    materialName={bomItem.raw_materials.name}
                    requiredQuantity={requiredQty}
                    sentQuantity={sentQty}
                    receivedQuantity={receivedQty}
                    onReceiptLog={(quantity, notes) => 
                      logProductionReceipt({ 
                        rawMaterialId: materialId, 
                        quantity, 
                        notes 
                      })
                    }
                    isLogging={isLoggingReceipt}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
