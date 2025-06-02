
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type BomType = "main_assembly" | "sub_assembly" | "accessory";

interface ProductionVoucherDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  productionOrder: any;
  onComponentSent: (component: string, materials: any[]) => void;
  sentComponents: string[];
}

interface MaterialDispatch {
  rawMaterialId: string;
  quantityToIssue: number;
}

const ProductionVoucherDetails = ({ 
  isOpen, 
  onClose, 
  productionOrder, 
  onComponentSent,
  sentComponents 
}: ProductionVoucherDetailsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [materialDispatchQuantities, setMaterialDispatchQuantities] = useState<Record<string, number>>({});

  // Fetch BOM data with inventory information
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

  // Fetch existing kit items to get previously issued quantities
  const { data: kitItems = [] } = useQuery({
    queryKey: ["kit-items", productionOrder?.id],
    queryFn: async () => {
      if (!productionOrder) return [];
      
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          *,
          kit_preparation!inner(production_order_id),
          raw_materials(material_code, name)
        `)
        .eq("kit_preparation.production_order_id", productionOrder.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionOrder && isOpen,
  });

  // Mutation to send materials
  const sendMaterialsMutation = useMutation({
    mutationFn: async ({ componentType, materials }: { componentType: string, materials: MaterialDispatch[] }) => {
      // First, ensure kit preparation record exists
      let { data: kitPrep, error: kitError } = await supabase
        .from("kit_preparation")
        .select("*")
        .eq("production_order_id", productionOrder.id)
        .maybeSingle();

      if (kitError) throw kitError;

      // Create kit preparation if it doesn't exist
      if (!kitPrep) {
        const { data: newKitPrep, error: createError } = await supabase
          .from("kit_preparation")
          .insert({
            production_order_id: productionOrder.id,
            status: "PREPARING",
          })
          .select()
          .single();

        if (createError) throw createError;
        kitPrep = newKitPrep;
      }

      // Process each material dispatch
      for (const material of materials) {
        if (material.quantityToIssue <= 0) continue;

        // Check if kit item already exists
        const { data: existingKitItem } = await supabase
          .from("kit_items")
          .select("*")
          .eq("kit_preparation_id", kitPrep.id)
          .eq("raw_material_id", material.rawMaterialId)
          .maybeSingle();

        if (existingKitItem) {
          // Update existing kit item
          await supabase
            .from("kit_items")
            .update({
              issued_quantity: (existingKitItem.issued_quantity || 0) + material.quantityToIssue,
              actual_quantity: (existingKitItem.actual_quantity || 0) + material.quantityToIssue,
            })
            .eq("id", existingKitItem.id);
        } else {
          // Create new kit item
          const bomItem = bomData.find(bom => bom.raw_material_id === material.rawMaterialId);
          const requiredQty = bomItem ? bomItem.quantity * productionOrder.quantity : 0;

          await supabase
            .from("kit_items")
            .insert({
              kit_preparation_id: kitPrep.id,
              raw_material_id: material.rawMaterialId,
              required_quantity: requiredQty,
              issued_quantity: material.quantityToIssue,
              actual_quantity: material.quantityToIssue,
            });
        }

        // Update inventory
        const { data: inventoryItem } = await supabase
          .from("inventory")
          .select("*")
          .eq("raw_material_id", material.rawMaterialId)
          .maybeSingle();

        if (inventoryItem) {
          await supabase
            .from("inventory")
            .update({
              quantity: Math.max(0, inventoryItem.quantity - material.quantityToIssue),
              last_updated: new Date().toISOString()
            })
            .eq("id", inventoryItem.id);
        }

        // Create material movement record
        await supabase
          .from("material_movements")
          .insert({
            raw_material_id: material.rawMaterialId,
            quantity: material.quantityToIssue,
            movement_type: "ISSUE",
            reference_type: "PRODUCTION_VOUCHER",
            reference_id: productionOrder.id,
            reference_number: productionOrder.voucher_number,
            issued_to: "Production",
            notes: `Issued for ${componentType} - ${productionOrder.voucher_number}`,
          });
      }

      // Update kit preparation status
      const componentToBomType: Record<string, BomType> = {
        "Sub Assembly": "sub_assembly",
        "Accessories": "accessory",
        "Main Assembly": "main_assembly"
      };

      const bomType = componentToBomType[componentType];
      const statusMap = {
        "Sub Assembly": "SUB ASSEMBLY COMPONENTS SENT",
        "Accessories": "ACCESSORY COMPONENTS SENT", 
        "Main Assembly": "MAIN ASSEMBLY COMPONENTS SENT"
      };

      await supabase
        .from("kit_preparation")
        .update({ 
          status: statusMap[componentType as keyof typeof statusMap] || "PARTIAL KIT SENT"
        })
        .eq("id", kitPrep.id);

      return { componentType, materials };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kit-items", productionOrder?.id] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["kits-to-verify"] });
      
      onComponentSent(data.componentType, data.materials);
      setMaterialDispatchQuantities({});
      
      toast({
        title: "Materials Sent",
        description: `${data.componentType} materials have been sent to production`,
      });
    },
    onError: (error) => {
      console.error("Error sending materials:", error);
      toast({
        title: "Error",
        description: "Failed to send materials to production",
        variant: "destructive",
      });
    },
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

  const handleQuantityChange = (rawMaterialId: string, quantity: string) => {
    const numQuantity = parseInt(quantity) || 0;
    setMaterialDispatchQuantities(prev => ({
      ...prev,
      [rawMaterialId]: numQuantity
    }));
  };

  const handleSendComponents = (componentType: string, materials: any[]) => {
    const materialsToSend: MaterialDispatch[] = materials
      .map(material => ({
        rawMaterialId: material.raw_material_id,
        quantityToIssue: materialDispatchQuantities[material.raw_material_id] || 0
      }))
      .filter(m => m.quantityToIssue > 0);

    if (materialsToSend.length === 0) {
      toast({
        title: "No Quantities Specified",
        description: "Please enter quantities to issue for at least one material",
        variant: "destructive",
      });
      return;
    }

    sendMaterialsMutation.mutate({ componentType, materials: materialsToSend });
  };

  const getIssuedQuantity = (rawMaterialId: string) => {
    const kitItem = kitItems.find(item => item.raw_material_id === rawMaterialId);
    return kitItem?.issued_quantity || 0;
  };

  const getStatusColor = (componentType: string) => {
    return sentComponents.includes(componentType) ? "default" : "secondary";
  };

  const renderBOMTable = (type: string, items: any[], displayName: string) => (
    <div key={type} className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-lg">{displayName}</h4>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusColor(displayName) as any}>
            {sentComponents.includes(displayName) ? "Sent" : "Pending"}
          </Badge>
          <Button
            size="sm"
            onClick={() => handleSendComponents(displayName, items)}
            disabled={sendMaterialsMutation.isPending || sentComponents.includes(displayName)}
            className="gap-2"
          >
            <Package className="h-4 w-4" />
            {sendMaterialsMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material Code</TableHead>
            <TableHead>Component Name</TableHead>
            <TableHead>Required Qty</TableHead>
            <TableHead>Available Qty</TableHead>
            <TableHead>Qty to Issue</TableHead>
            <TableHead>Qty Issued</TableHead>
            <TableHead>Pending Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const requiredQty = item.quantity * (productionOrder?.quantity || 1);
            const availableQty = item.raw_materials.inventory?.[0]?.quantity || 0;
            const issuedQty = getIssuedQuantity(item.raw_material_id);
            const pendingQty = Math.max(0, requiredQty - issuedQty);
            const quantityToIssue = materialDispatchQuantities[item.raw_material_id] || 0;
            
            return (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                <TableCell>{item.raw_materials.name}</TableCell>
                <TableCell>{requiredQty}</TableCell>
                <TableCell>
                  <span className={availableQty >= requiredQty ? "text-green-600" : "text-red-600"}>
                    {availableQty}
                  </span>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    max={Math.min(availableQty, pendingQty)}
                    value={quantityToIssue}
                    onChange={(e) => handleQuantityChange(item.raw_material_id, e.target.value)}
                    className="w-20"
                    disabled={sentComponents.includes(displayName)}
                  />
                </TableCell>
                <TableCell>{issuedQty}</TableCell>
                <TableCell>
                  <span className={pendingQty > 0 ? "text-orange-600" : "text-green-600"}>
                    {pendingQty}
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
