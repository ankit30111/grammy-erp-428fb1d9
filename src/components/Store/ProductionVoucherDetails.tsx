
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { validateStockForComponent } from "./StockValidator";

type BomType = "main_assembly" | "sub_assembly" | "accessory";

interface ProductionVoucherDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  productionOrder: any;
  onComponentSent: (component: string) => void;
  sentComponents: string[];
}

const ProductionVoucherDetails = ({ 
  isOpen, 
  onClose, 
  productionOrder, 
  onComponentSent,
  sentComponents 
}: ProductionVoucherDetailsProps) => {
  const { toast } = useToast();
  const [validationResults, setValidationResults] = useState<Record<string, any>>({});

  const { data: bomData = [] } = useQuery({
    queryKey: ["production-voucher-bom", productionOrder?.id],
    queryFn: async () => {
      if (!productionOrder) return [];
      
      const { data, error } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials!inner(
            id,
            material_code,
            name,
            inventory(quantity)
          )
        `)
        .eq("product_id", productionOrder.product_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionOrder && isOpen,
  });

  // Group BOM items by type
  const groupedBOM = bomData.reduce((acc, item) => {
    const type = item.bom_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const validateAndSendComponent = async (componentType: string) => {
    if (!productionOrder) return;

    const bomTypeMap: Record<string, BomType> = {
      "Sub Assembly": "sub_assembly",
      "Accessories": "accessory", 
      "Main Assembly": "main_assembly"
    };

    const bomType = bomTypeMap[componentType];
    if (!bomType) return;

    const validation = await validateStockForComponent(
      productionOrder.product_id, 
      productionOrder.quantity, 
      bomType
    );

    if (!validation.isValid) {
      toast({
        title: "Insufficient Stock",
        description: `Cannot send ${componentType}. Some components are short in stock.`,
        variant: "destructive",
      });
      return;
    }

    onComponentSent(componentType);
  };

  const getComponentStatus = (componentType: string) => {
    return sentComponents.includes(componentType) ? "Sent" : "Pending";
  };

  const getStatusColor = (status: string) => {
    return status === "Sent" ? "default" : "secondary";
  };

  const renderBOMTable = (type: string, items: any[], displayName: string) => (
    <div key={type} className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{displayName}</h4>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusColor(getComponentStatus(displayName)) as any}>
            {getComponentStatus(displayName)}
          </Badge>
          <Button
            size="sm"
            onClick={() => validateAndSendComponent(displayName)}
            disabled={sentComponents.includes(displayName)}
            className="gap-2"
          >
            <Package className="h-4 w-4" />
            {sentComponents.includes(displayName) ? "Already Sent" : "Send Components"}
          </Button>
        </div>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material Code</TableHead>
            <TableHead>Component Name</TableHead>
            <TableHead>Required Qty</TableHead>
            <TableHead>Qty Issued by Store</TableHead>
            <TableHead>Qty Pending</TableHead>
            <TableHead>Stock Available</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const requiredQty = item.quantity * (productionOrder?.quantity || 1);
            const issuedQty = sentComponents.includes(displayName) ? requiredQty : 0;
            const pendingQty = requiredQty - issuedQty;
            const stockQty = item.raw_materials.inventory?.[0]?.quantity || 0;
            
            return (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                <TableCell>{item.raw_materials.name}</TableCell>
                <TableCell>{requiredQty}</TableCell>
                <TableCell>{issuedQty}</TableCell>
                <TableCell>{pendingQty}</TableCell>
                <TableCell>
                  <span className={stockQty >= requiredQty ? "text-green-600" : "text-red-600"}>
                    {stockQty}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  if (!productionOrder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Production Voucher Details - {productionOrder.voucher_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <span className="text-sm text-muted-foreground">Product:</span>
              <p className="font-medium">{productionOrder.production_schedules?.projections?.products?.name}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Production Quantity:</span>
              <p className="font-medium">{productionOrder.quantity}</p>
            </div>
          </div>

          {Object.entries(groupedBOM).map(([type, items]) => {
            const displayNames: Record<string, string> = {
              "sub_assembly": "Sub Assembly",
              "accessory": "Accessories",
              "main_assembly": "Main Assembly"
            };
            
            return renderBOMTable(type, items, displayNames[type] || type);
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionVoucherDetails;
