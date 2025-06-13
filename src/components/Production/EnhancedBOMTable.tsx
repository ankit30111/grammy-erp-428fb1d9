
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Package, AlertTriangle, History } from "lucide-react";
import MaterialDispatchHistoryDialog from "./MaterialDispatchHistoryDialog";

interface EnhancedBOMTableProps {
  productionOrderId: string;
  productId: string;
  productionQuantity: number;
}

const EnhancedBOMTable = ({ productionOrderId, productId, productionQuantity }: EnhancedBOMTableProps) => {
  const [selectedMaterial, setSelectedMaterial] = useState<{
    id: string;
    code: string;
    name: string;
    requiredQty: number;
  } | null>(null);

  // Fetch BOM data with bom_type included
  const { data: bomData = [] } = useQuery({
    queryKey: ["enhanced-bom", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials!inner(
            id,
            material_code,
            name,
            category
          )
        `)
        .eq("product_id", productId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productId,
  });

  // Fetch cumulative dispatch data
  const { data: dispatchData = [] } = useQuery({
    queryKey: ["production-bom-status", productionOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          raw_material_id,
          actual_quantity,
          verified_by_production,
          kit_preparation!inner(
            production_order_id
          )
        `)
        .eq("kit_preparation.production_order_id", productionOrderId);

      if (error) throw error;

      // Group by material and calculate cumulative quantities
      const materialStats = new Map();
      
      data?.forEach(item => {
        const materialId = item.raw_material_id;
        const existing = materialStats.get(materialId) || { totalSent: 0, totalReceived: 0 };
        
        existing.totalSent += item.actual_quantity;
        if (item.verified_by_production) {
          existing.totalReceived += item.actual_quantity;
        }
        
        materialStats.set(materialId, existing);
      });

      return Array.from(materialStats.entries()).map(([materialId, stats]) => ({
        raw_material_id: materialId,
        total_sent: stats.totalSent,
        total_received: stats.totalReceived
      }));
    },
    enabled: !!productionOrderId,
    refetchInterval: 3000, // Real-time updates
  });

  const getDispatchStats = (materialId: string) => {
    const stats = dispatchData.find(item => item.raw_material_id === materialId);
    return {
      totalSent: stats?.total_sent || 0,
      totalReceived: stats?.total_received || 0
    };
  };

  const getCompletionStatus = (required: number, received: number) => {
    if (received >= required) return 'complete';
    if (received > 0) return 'partial';
    return 'pending';
  };

  // Group materials by BOM type
  const groupedBomData = bomData.reduce((acc, bomItem) => {
    const bomType = bomItem.bom_type || 'main_assembly';
    if (!acc[bomType]) {
      acc[bomType] = [];
    }
    acc[bomType].push(bomItem);
    return acc;
  }, {} as Record<string, typeof bomData>);

  const renderMaterialSection = (sectionTitle: string, materials: typeof bomData) => {
    if (!materials || materials.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Package className="h-5 w-5" />
          {sectionTitle}
          <Badge variant="outline">{materials.length} materials</Badge>
        </h3>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Code</TableHead>
                <TableHead>Raw Material Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Required Qty</TableHead>
                <TableHead>Qty Sent (Cumulative)</TableHead>
                <TableHead>Qty Received (Cumulative)</TableHead>
                <TableHead>Remaining Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entry Log</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((bomItem) => {
                const requiredQty = bomItem.quantity * productionQuantity;
                const { totalSent, totalReceived } = getDispatchStats(bomItem.raw_materials.id);
                const remainingQty = Math.max(0, requiredQty - totalReceived);
                const status = getCompletionStatus(requiredQty, totalReceived);

                return (
                  <TableRow key={bomItem.id} className={status === 'complete' ? 'bg-green-50' : ''}>
                    <TableCell className="font-mono font-medium">
                      {bomItem.raw_materials.material_code}
                    </TableCell>
                    <TableCell>{bomItem.raw_materials.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{bomItem.raw_materials.category}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{requiredQty}</TableCell>
                    <TableCell className="font-medium text-blue-600">
                      {totalSent}
                      {totalSent > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {((totalSent / requiredQty) * 100).toFixed(0)}% sent
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {totalReceived}
                      {totalReceived > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {((totalReceived / requiredQty) * 100).toFixed(0)}% received
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={`font-medium ${remainingQty === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {remainingQty}
                    </TableCell>
                    <TableCell>
                      {status === 'complete' ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Complete
                        </Badge>
                      ) : status === 'partial' ? (
                        <Badge variant="secondary" className="gap-1">
                          <Package className="h-3 w-3" />
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedMaterial({
                          id: bomItem.raw_materials.id,
                          code: bomItem.raw_materials.material_code,
                          name: bomItem.raw_materials.name,
                          requiredQty
                        })}
                        className="gap-1"
                      >
                        <History className="h-3 w-3" />
                        View Log
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {renderMaterialSection("Sub Assembly", groupedBomData.sub_assembly)}
        {renderMaterialSection("Main Assembly", groupedBomData.main_assembly)}
        {renderMaterialSection("Accessories", groupedBomData.accessory)}
      </div>

      {selectedMaterial && (
        <MaterialDispatchHistoryDialog
          isOpen={!!selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
          productionOrderId={productionOrderId}
          rawMaterialId={selectedMaterial.id}
          materialCode={selectedMaterial.code}
          materialName={selectedMaterial.name}
          requiredQuantity={selectedMaterial.requiredQty}
        />
      )}
    </>
  );
};

export default EnhancedBOMTable;
