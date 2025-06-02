
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Eye, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useKitPreparation, useCreateKitPreparation, useUpdateKitItem } from "@/hooks/useKitPreparation";
import { useLogMaterialMovement } from "@/hooks/useMaterialMovements";
import { useUpdateInventory } from "@/hooks/useInventory";

interface EnhancedProductionVoucherDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  productionOrder: any;
}

const EnhancedProductionVoucherDetails = ({ 
  isOpen, 
  onClose, 
  productionOrder 
}: EnhancedProductionVoucherDetailsProps) => {
  const { toast } = useToast();
  const [quantitiesToSend, setQuantitiesToSend] = useState<Record<string, number>>({});
  
  const { data: kitPreparation } = useKitPreparation(productionOrder?.id);
  const createKitPreparation = useCreateKitPreparation();
  const updateKitItem = useUpdateKitItem();
  const logMaterialMovement = useLogMaterialMovement();
  const updateInventory = useUpdateInventory();

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
            inventory(id, quantity)
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

  const handleQuantityChange = (bomItemId: string, quantity: string) => {
    const numQuantity = parseInt(quantity) || 0;
    setQuantitiesToSend(prev => ({
      ...prev,
      [bomItemId]: numQuantity
    }));
  };

  const handleSendMaterial = async (bomItem: any) => {
    if (!productionOrder || !bomItem) return;

    const quantityToSend = quantitiesToSend[bomItem.id] || 0;
    if (quantityToSend <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity to send",
        variant: "destructive",
      });
      return;
    }

    const availableStock = bomItem.raw_materials.inventory?.[0]?.quantity || 0;
    if (quantityToSend > availableStock) {
      toast({
        title: "Insufficient Stock",
        description: "Cannot send more than available stock",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create kit preparation if it doesn't exist
      let kitPrepId = kitPreparation?.id;
      if (!kitPrepId) {
        const newKit = await createKitPreparation.mutateAsync(productionOrder.id);
        kitPrepId = newKit.id;
      }

      // Check if kit item exists for this material
      let kitItem = kitPreparation?.kit_items?.find(
        (item: any) => item.raw_material_id === bomItem.raw_material_id
      );

      if (!kitItem) {
        // Create new kit item
        const { data: newKitItem, error } = await supabase
          .from("kit_items")
          .insert({
            kit_preparation_id: kitPrepId,
            raw_material_id: bomItem.raw_material_id,
            required_quantity: bomItem.quantity * productionOrder.quantity,
            issued_quantity: quantityToSend,
          })
          .select()
          .single();

        if (error) throw error;
        kitItem = newKitItem;
      } else {
        // Update existing kit item
        await updateKitItem.mutateAsync({
          kitItemId: kitItem.id,
          issuedQuantity: kitItem.issued_quantity + quantityToSend,
        });
      }

      // Update inventory
      const inventoryId = bomItem.raw_materials.inventory?.[0]?.id;
      if (inventoryId) {
        await updateInventory.mutateAsync({
          id: inventoryId,
          quantity: availableStock - quantityToSend,
        });
      }

      // Log material movement
      await logMaterialMovement.mutateAsync({
        rawMaterialId: bomItem.raw_material_id,
        quantity: quantityToSend,
        movementType: "ISSUED",
        referenceType: "PRODUCTION_VOUCHER",
        referenceId: productionOrder.id,
        referenceNumber: productionOrder.voucher_number,
        issuedTo: "Production",
        notes: `Issued for ${bomItem.bom_type} section`,
      });

      // Clear the quantity input
      setQuantitiesToSend(prev => ({
        ...prev,
        [bomItem.id]: 0
      }));

      toast({
        title: "Material Sent",
        description: `${quantityToSend} units of ${bomItem.raw_materials.name} sent to production`,
      });

    } catch (error) {
      console.error("Error sending material:", error);
      toast({
        title: "Error",
        description: "Failed to send material to production",
        variant: "destructive",
      });
    }
  };

  const getIssuedQuantity = (rawMaterialId: string) => {
    const kitItem = kitPreparation?.kit_items?.find(
      (item: any) => item.raw_material_id === rawMaterialId
    );
    return kitItem?.issued_quantity || 0;
  };

  const renderBOMTable = (type: string, items: any[], displayName: string) => (
    <div key={type} className="space-y-4">
      <h4 className="font-medium text-lg">{displayName}</h4>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material Code</TableHead>
            <TableHead>Component Name</TableHead>
            <TableHead>Required Qty</TableHead>
            <TableHead>Available Stock</TableHead>
            <TableHead>Quantity Issued</TableHead>
            <TableHead>Pending Qty</TableHead>
            <TableHead>Qty to Send</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const requiredQty = item.quantity * (productionOrder?.quantity || 1);
            const stockQty = item.raw_materials.inventory?.[0]?.quantity || 0;
            const issuedQty = getIssuedQuantity(item.raw_material_id);
            const pendingQty = requiredQty - issuedQty;
            const quantityToSend = quantitiesToSend[item.id] || 0;
            const canSend = pendingQty > 0 && stockQty > 0;
            
            return (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                <TableCell>{item.raw_materials.name}</TableCell>
                <TableCell>{requiredQty}</TableCell>
                <TableCell>
                  <span className={stockQty >= requiredQty ? "text-green-600" : "text-red-600"}>
                    {stockQty}
                  </span>
                </TableCell>
                <TableCell>{issuedQty}</TableCell>
                <TableCell>
                  <span className={pendingQty > 0 ? "text-orange-600" : "text-green-600"}>
                    {pendingQty}
                  </span>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    max={Math.min(stockQty, pendingQty)}
                    value={quantityToSend}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    disabled={!canSend}
                    className="w-20"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => handleSendMaterial(item)}
                    disabled={!canSend || quantityToSend <= 0}
                    className="gap-2"
                  >
                    {pendingQty === 0 ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : stockQty === 0 ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Package className="h-4 w-4" />
                    )}
                    {pendingQty === 0 ? "Complete" : stockQty === 0 ? "No Stock" : "Send"}
                  </Button>
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
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
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
              "accessory": "Accessory",
              "main_assembly": "Main Assembly"
            };
            
            return renderBOMTable(type, items, displayNames[type] || type);
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedProductionVoucherDetails;
