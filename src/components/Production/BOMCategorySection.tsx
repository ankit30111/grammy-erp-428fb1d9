
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Factory, Save } from "lucide-react";
import ProductionMaterialReceiptInput from "./ProductionMaterialReceiptInput";
import { BOM_CATEGORIES, PRODUCTION_LINES, type BOMType, type BOMItem } from "@/types/bom";

interface BOMCategorySectionProps {
  category: BOMType;
  materials: BOMItem[];
  productionOrderId: string;
  requiredQuantities: Record<string, number>;
  sentQuantities: Record<string, number>;
  receivedQuantities: Record<string, number>;
  onReceiptLog: (materialId: string, quantity: number, notes?: string) => void;
  isLoggingReceipt: boolean;
  assignedLine?: string;
  onLineAssignment: (category: BOMType, line: string) => void;
  isAssigning: boolean;
}

export default function BOMCategorySection({
  category,
  materials,
  productionOrderId,
  requiredQuantities,
  sentQuantities,
  receivedQuantities,
  onReceiptLog,
  isLoggingReceipt,
  assignedLine,
  onLineAssignment,
  isAssigning
}: BOMCategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedLine, setSelectedLine] = useState<string>(assignedLine || "");

  const categoryTitle = BOM_CATEGORIES[category];
  const materialCount = materials.length;
  
  const handleSaveAssignment = () => {
    if (selectedLine && selectedLine !== assignedLine) {
      onLineAssignment(category, selectedLine);
    }
  };

  const getLineStatus = () => {
    if (assignedLine) {
      return (
        <Badge className="bg-blue-100 text-blue-800 gap-1">
          <Factory className="h-3 w-3" />
          {assignedLine}
        </Badge>
      );
    }
    return <Badge variant="outline">No Line Assigned</Badge>;
  };

  if (materialCount === 0) {
    return null;
  }

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-lg font-semibold">{categoryTitle}</span>
                <Badge variant="secondary">{materialCount} materials</Badge>
              </div>
              <div className="flex items-center gap-2">
                {getLineStatus()}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Production Line Assignment Section */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Factory className="h-4 w-4" />
                Production Line Assignment
              </h4>
              <div className="flex items-center gap-3">
                <Select
                  value={selectedLine}
                  onValueChange={setSelectedLine}
                  disabled={isAssigning}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select production line" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_LINES.map((line) => (
                      <SelectItem key={line} value={line}>
                        {line}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  onClick={handleSaveAssignment}
                  disabled={!selectedLine || selectedLine === assignedLine || isAssigning}
                  size="sm"
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isAssigning ? "Assigning..." : "Save Assignment"}
                </Button>
              </div>
              
              {assignedLine && (
                <div className="mt-2 text-sm text-blue-600">
                  Currently assigned to: <strong>{assignedLine}</strong>
                </div>
              )}
            </div>

            {/* Materials List */}
            <div className="space-y-4">
              {materials.map((bomItem) => {
                const materialId = bomItem.raw_material_id;
                const sentQty = sentQuantities[materialId] || 0;
                const receivedQty = receivedQuantities[materialId] || 0;
                const requiredQty = requiredQuantities[materialId] || 0;
                
                return (
                  <div key={materialId} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium">{bomItem.raw_materials.material_code}</div>
                        <div className="text-sm text-muted-foreground">{bomItem.raw_materials.name}</div>
                        {bomItem.is_critical && (
                          <Badge variant="destructive" className="mt-1 text-xs">Critical</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm mb-4">
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
                          onReceiptLog(materialId, quantity, notes)
                        }
                        isLogging={isLoggingReceipt}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
