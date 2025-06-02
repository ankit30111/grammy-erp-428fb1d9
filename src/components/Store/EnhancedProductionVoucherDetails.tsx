
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Package, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useInventory } from "@/hooks/useInventory";
import { useBOM } from "@/hooks/useBOM";
import { useQueryClient } from "@tanstack/react-query";

interface EnhancedProductionVoucherDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  productionOrder: any;
}

interface MaterialItem {
  id: string;
  materialCode: string;
  materialName: string;
  requiredQuantity: number;
  availableStock: number;
  issuedQuantity: number;
  pendingQuantity: number;
  bomType: string;
  rawMaterialId: string;
}

export default function EnhancedProductionVoucherDetails({
  isOpen,
  onClose,
  productionOrder
}: EnhancedProductionVoucherDetailsProps) {
  const { toast } = useToast();
  const { data: inventory } = useInventory();
  const { data: bomData } = useBOM();
  const queryClient = useQueryClient();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [sendQuantities, setSendQuantities] = useState<Record<string, number>>({});
  const [issuedQuantities, setIssuedQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (productionOrder && bomData && inventory) {
      loadMaterialData();
      loadIssuedQuantities();
    }
  }, [productionOrder, bomData, inventory]);

  const loadMaterialData = () => {
    if (!productionOrder || !bomData || !inventory) return;

    const productBOM = bomData.filter(bom => 
      bom.product_id === productionOrder.product_id
    );

    const materialsList = productBOM.map(bomItem => {
      const inventoryItem = inventory.find(inv => 
        inv.raw_material_id === bomItem.raw_material_id
      );
      
      const requiredQty = bomItem.quantity * productionOrder.quantity;
      const availableStock = inventoryItem?.quantity || 0;
      const issuedQty = issuedQuantities[bomItem.raw_material_id] || 0;
      
      return {
        id: bomItem.id,
        materialCode: bomItem.raw_materials?.material_code || '',
        materialName: bomItem.raw_materials?.name || '',
        requiredQuantity: requiredQty,
        availableStock,
        issuedQuantity: issuedQty,
        pendingQuantity: requiredQty - issuedQty,
        bomType: bomItem.bom_type,
        rawMaterialId: bomItem.raw_material_id
      };
    });

    setMaterials(materialsList);
  };

  const loadIssuedQuantities = async () => {
    if (!productionOrder) return;

    try {
      const { data: kitItems, error } = await supabase
        .from('kit_items')
        .select(`
          raw_material_id,
          actual_quantity,
          kit_preparation!inner(production_order_id)
        `)
        .eq('kit_preparation.production_order_id', productionOrder.id);

      if (error) throw error;

      const quantities: Record<string, number> = {};
      kitItems?.forEach(item => {
        quantities[item.raw_material_id] = (quantities[item.raw_material_id] || 0) + item.actual_quantity;
      });

      setIssuedQuantities(quantities);
    } catch (error) {
      console.error('Error loading issued quantities:', error);
    }
  };

  const handleSendQuantityChange = (rawMaterialId: string, quantity: string) => {
    const numQuantity = parseInt(quantity) || 0;
    setSendQuantities(prev => ({
      ...prev,
      [rawMaterialId]: numQuantity
    }));
  };

  const handleSendMaterial = async (material: MaterialItem) => {
    const quantityToSend = sendQuantities[material.rawMaterialId] || 0;
    
    if (quantityToSend <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity to send",
        variant: "destructive",
      });
      return;
    }

    if (quantityToSend > material.availableStock) {
      toast({
        title: "Insufficient Stock",
        description: "Quantity to send exceeds available stock",
        variant: "destructive",
      });
      return;
    }

    if (quantityToSend > material.pendingQuantity) {
      toast({
        title: "Excess Quantity",
        description: "Quantity to send exceeds pending requirement",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if kit preparation exists, create if not
      let { data: kitPrep, error: kitError } = await supabase
        .from('kit_preparation')
        .select('id')
        .eq('production_order_id', productionOrder.id)
        .maybeSingle();

      if (kitError && kitError.code !== 'PGRST116') throw kitError;

      if (!kitPrep) {
        const { data: newKitPrep, error: createError } = await supabase
          .from('kit_preparation')
          .insert({
            production_order_id: productionOrder.id,
            kit_number: '', // Will be auto-generated by trigger
            status: 'PREPARING'
          })
          .select()
          .single();

        if (createError) throw createError;
        kitPrep = newKitPrep;
      }

      // Add kit item
      const { error: itemError } = await supabase
        .from('kit_items')
        .insert({
          kit_preparation_id: kitPrep.id,
          raw_material_id: material.rawMaterialId,
          required_quantity: material.requiredQuantity,
          actual_quantity: quantityToSend
        });

      if (itemError) throw itemError;

      // Update inventory
      const { error: inventoryError } = await supabase
        .from('inventory')
        .update({
          quantity: material.availableStock - quantityToSend,
          last_updated: new Date().toISOString()
        })
        .eq('raw_material_id', material.rawMaterialId);

      if (inventoryError) throw inventoryError;

      // Update local state
      setIssuedQuantities(prev => ({
        ...prev,
        [material.rawMaterialId]: (prev[material.rawMaterialId] || 0) + quantityToSend
      }));

      setSendQuantities(prev => ({
        ...prev,
        [material.rawMaterialId]: 0
      }));

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      loadMaterialData();

      toast({
        title: "Material Sent",
        description: `${quantityToSend} units of ${material.materialName} sent to production`,
      });

    } catch (error) {
      console.error('Error sending material:', error);
      toast({
        title: "Error",
        description: "Failed to send material",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (material: MaterialItem) => {
    if (material.pendingQuantity === 0) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (material.availableStock < material.pendingQuantity) {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    return <Package className="h-4 w-4 text-blue-600" />;
  };

  const renderMaterialSection = (title: string, bomType: string) => {
    const sectionMaterials = materials.filter(m => m.bomType === bomType);
    
    if (sectionMaterials.length === 0) return null;

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Material Code</TableHead>
                <TableHead>Component Name</TableHead>
                <TableHead>Required Qty</TableHead>
                <TableHead>Available Stock</TableHead>
                <TableHead>Issued Qty</TableHead>
                <TableHead>Pending Qty</TableHead>
                <TableHead>Qty to Send</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectionMaterials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell>{getStatusIcon(material)}</TableCell>
                  <TableCell className="font-mono">{material.materialCode}</TableCell>
                  <TableCell>{material.materialName}</TableCell>
                  <TableCell>{material.requiredQuantity}</TableCell>
                  <TableCell className={material.availableStock < material.pendingQuantity ? "text-red-600" : "text-green-600"}>
                    {material.availableStock}
                  </TableCell>
                  <TableCell>{material.issuedQuantity}</TableCell>
                  <TableCell className={material.pendingQuantity > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                    {material.pendingQuantity}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      max={Math.min(material.availableStock, material.pendingQuantity)}
                      value={sendQuantities[material.rawMaterialId] || ''}
                      onChange={(e) => handleSendQuantityChange(material.rawMaterialId, e.target.value)}
                      className="w-20"
                      disabled={material.pendingQuantity === 0}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleSendMaterial(material)}
                      disabled={material.pendingQuantity === 0 || !sendQuantities[material.rawMaterialId]}
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  if (!productionOrder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Production Voucher: {productionOrder.voucher_number}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Product: {productionOrder.production_schedules?.projections?.products?.name} | 
            Quantity: {productionOrder.quantity}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {renderMaterialSection("Sub Assembly Components", "sub_assembly")}
          {renderMaterialSection("Main Assembly Components", "main_assembly")}
          {renderMaterialSection("Accessory Components", "accessory")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
