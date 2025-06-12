
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProductionMaterialReceipts } from "@/hooks/useProductionMaterialReceipts";
import ProductionMaterialReceiptInput from "./ProductionMaterialReceiptInput";

interface EnhancedBOMTableProps {
  bomData: any[];
  productionQuantity: number;
  productionOrderId: string;
}

export default function EnhancedBOMTable({ bomData, productionQuantity, productionOrderId }: EnhancedBOMTableProps) {
  // Fetch materials sent by store from material_movements table
  const { data: materialDispatchData = [] } = useQuery({
    queryKey: ["material-dispatch-data", productionOrderId],
    queryFn: async () => {
      if (!bomData || bomData.length === 0) return [];
      
      const materialIds = bomData.map((item: any) => item.raw_materials?.id || item.raw_material_id).filter(Boolean);
      
      console.log("🔍 Fetching material dispatch data for production:", productionOrderId);
      
      const { data, error } = await supabase
        .from("material_movements")
        .select(`
          raw_material_id,
          quantity,
          created_at,
          movement_type,
          reference_number,
          notes
        `)
        .eq("movement_type", "ISSUED_TO_PRODUCTION")
        .eq("reference_type", "PRODUCTION_VOUCHER")
        .in("raw_material_id", materialIds)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("❌ Error fetching material dispatch data:", error);
        throw error;
      }

      console.log("📦 Material dispatch data fetched:", data);
      
      // Group by material and sum quantities (fix for F-040 duplicate issue)
      const groupedDispatch = data?.reduce((acc, item) => {
        if (!acc[item.raw_material_id]) {
          acc[item.raw_material_id] = {
            totalSent: 0,
            dispatches: []
          };
        }
        acc[item.raw_material_id].totalSent += item.quantity;
        acc[item.raw_material_id].dispatches.push(item);
        return acc;
      }, {} as Record<string, { totalSent: number; dispatches: any[] }>) || {};

      return groupedDispatch;
    },
    enabled: bomData.length > 0,
    refetchInterval: 3000, // Real-time updates
  });

  // Use the production material receipts hook
  const { 
    getReceivedQuantity, 
    logProductionReceipt, 
    isLoggingReceipt 
  } = useProductionMaterialReceipts(productionOrderId);

  const getRequiredQuantity = (bomItem: any) => {
    return bomItem.quantity * productionQuantity;
  };

  const getSentQuantity = (materialId: string) => {
    return materialDispatchData[materialId]?.totalSent || 0;
  };

  const getBalanceQuantity = (bomItem: any) => {
    const required = getRequiredQuantity(bomItem);
    const sent = getSentQuantity(bomItem.raw_materials?.id || bomItem.raw_material_id);
    return Math.max(0, required - sent);
  };

  const getDispatchStatus = (bomItem: any) => {
    const required = getRequiredQuantity(bomItem);
    const sent = getSentQuantity(bomItem.raw_materials?.id || bomItem.raw_material_id);
    const received = getReceivedQuantity(bomItem.raw_materials?.id || bomItem.raw_material_id);
    const balance = getBalanceQuantity(bomItem);
    
    if (received >= sent && sent > 0) {
      return <Badge className="bg-green-100 text-green-800">Fully Received</Badge>;
    } else if (received > 0) {
      return <Badge variant="secondary">Partially Received</Badge>;
    } else if (balance === 0 && sent > 0) {
      return <Badge className="bg-blue-100 text-blue-800">Sent - Awaiting Receipt</Badge>;
    } else if (sent > 0) {
      return <Badge variant="secondary">Partially Sent</Badge>;
    } else {
      return <Badge variant="outline">Awaiting Store</Badge>;
    }
  };

  const handleMaterialReceipt = (materialId: string, quantity: number, notes?: string) => {
    logProductionReceipt({
      rawMaterialId: materialId,
      quantity,
      notes
    });
  };

  if (!bomData || bomData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No BOM data available for this production order
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Material Requirements & Production Receipt Tracking</h3>
      
      {/* Summary Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material Code</TableHead>
            <TableHead>Material Name</TableHead>
            <TableHead>BOM Type</TableHead>
            <TableHead>Required Qty</TableHead>
            <TableHead>Sent by Store</TableHead>
            <TableHead>Received by Production</TableHead>
            <TableHead>Balance Qty</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Critical</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bomData.map((bomItem: any) => {
            const materialId = bomItem.raw_materials?.id || bomItem.raw_material_id;
            const requiredQty = getRequiredQuantity(bomItem);
            const sentQty = getSentQuantity(materialId);
            const receivedQty = getReceivedQuantity(materialId);
            const balanceQty = getBalanceQuantity(bomItem);
            
            return (
              <TableRow key={bomItem.id}>
                <TableCell className="font-mono font-medium">
                  {bomItem.raw_materials?.material_code || bomItem.material_code}
                </TableCell>
                <TableCell>{bomItem.raw_materials?.name || bomItem.material_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {bomItem.bom_type?.replace('_', ' ') || 'Main Assembly'}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{requiredQty}</TableCell>
                <TableCell className={`font-medium ${
                  sentQty > 0 ? "text-blue-600" : "text-gray-500"
                }`}>
                  {sentQty}
                </TableCell>
                <TableCell className={`font-medium ${
                  receivedQty > sentQty ? "text-red-600" : receivedQty > 0 ? "text-green-600" : "text-gray-500"
                }`}>
                  {receivedQty}
                </TableCell>
                <TableCell className={`font-medium ${
                  balanceQty === 0 ? "text-green-600" : "text-orange-600"
                }`}>
                  {balanceQty}
                </TableCell>
                <TableCell>
                  {getDispatchStatus(bomItem)}
                </TableCell>
                <TableCell>
                  {bomItem.is_critical && (
                    <Badge variant="destructive" className="text-xs">Critical</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      
      {/* Production Material Receipt Inputs */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold">Production Material Receipt Entry</h4>
        <div className="grid gap-4">
          {bomData.map((bomItem: any) => {
            const materialId = bomItem.raw_materials?.id || bomItem.raw_material_id;
            const sentQty = getSentQuantity(materialId);
            const receivedQty = getReceivedQuantity(materialId);
            
            // Only show input if materials have been sent by store
            if (sentQty === 0) return null;
            
            return (
              <ProductionMaterialReceiptInput
                key={materialId}
                materialCode={bomItem.raw_materials?.material_code || bomItem.material_code}
                materialName={bomItem.raw_materials?.name || bomItem.material_name}
                requiredQuantity={getRequiredQuantity(bomItem)}
                sentQuantity={sentQty}
                receivedQuantity={receivedQty}
                onReceiptLog={(quantity, notes) => handleMaterialReceipt(materialId, quantity, notes)}
                isLogging={isLoggingReceipt}
              />
            );
          })}
        </div>
      </div>

      {/* Material Dispatch Details */}
      {Object.keys(materialDispatchData).length > 0 && (
        <div className="mt-6">
          <h4 className="text-md font-semibold mb-3">Recent Material Dispatches from Store</h4>
          <div className="grid gap-2 max-h-60 overflow-y-auto">
            {Object.entries(materialDispatchData).map(([materialId, data]) => {
              const material = bomData.find(b => (b.raw_materials?.id || b.raw_material_id) === materialId);
              const receivedQty = getReceivedQuantity(materialId);
              
              return (
                <div key={materialId} className="p-3 border rounded-lg bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm">
                        {material?.raw_materials?.material_code || material?.material_code}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Sent: {data.totalSent} | Received: {receivedQty} | Pending: {Math.max(0, data.totalSent - receivedQty)}
                      </div>
                    </div>
                    <Badge variant={receivedQty >= data.totalSent ? "default" : "secondary"} className="text-xs">
                      {data.dispatches.length} dispatch(es)
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
