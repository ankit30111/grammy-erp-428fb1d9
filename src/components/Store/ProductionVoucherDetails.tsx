
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Package, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { useBOMByProduct } from "@/hooks/useBOM";

interface ProductionVoucherDetailsProps {
  voucherId: string;
  onBack: () => void;
}

interface MaterialDispatch {
  materialId: string;
  quantity: number;
}

const ProductionVoucherDetails = ({ voucherId, onBack }: ProductionVoucherDetailsProps) => {
  const [materialQuantities, setMaterialQuantities] = useState<Record<string, number>>({});
  const [isDispatching, setIsDispatching] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch production order details
  const { data: productionOrder, isLoading: isLoadingOrder } = useQuery({
    queryKey: ["production-order", voucherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!product_id (
            id,
            name,
            product_code
          ),
          production_schedules!production_schedule_id (
            projections!projection_id (
              customers!customer_id (name)
            )
          )
        `)
        .eq("id", voucherId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch BOM data grouped by category
  const { data: bomData = [] } = useBOMByProduct(productionOrder?.product_id || "");

  // Fetch inventory data
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory-real-time"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          raw_materials!raw_material_id (
            id,
            material_code,
            name,
            category
          )
        `);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000,
  });

  // Fetch existing production material receipts for over-issuance prevention
  const { data: materialReceipts = [] } = useQuery({
    queryKey: ["production-material-receipts", voucherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_material_receipts")
        .select("*")
        .eq("production_order_id", voucherId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!voucherId,
    refetchInterval: 3000,
  });

  // Fetch kit preparation data for tracking sent quantities
  const { data: kitData = [] } = useQuery({
    queryKey: ["kit-preparation", voucherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_preparation")
        .select(`
          *,
          kit_items!kit_preparation_id (
            *,
            raw_materials!raw_material_id (
              id,
              material_code,
              name,
              category
            )
          )
        `)
        .eq("production_order_id", voucherId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!voucherId,
    refetchInterval: 3000,
  });

  // Material dispatch mutation with enhanced validation
  const dispatchMutation = useMutation({
    mutationFn: async (materials: MaterialDispatch[]) => {
      if (!productionOrder) throw new Error("Production order not found");

      console.log("🚀 DISPATCHING MATERIALS:", materials);
      
      // Enhanced validation: Check for over-issuance prevention
      for (const material of materials) {
        const bomItem = bomData.find(b => b.raw_material_id === material.materialId);
        const requiredQty = bomItem ? bomItem.quantity * productionOrder.quantity : 0;
        
        // Get total received quantity for this material
        const receipt = materialReceipts.find(r => r.raw_material_id === material.materialId);
        const actualReceived = receipt?.quantity_received || 0;
        
        if (actualReceived >= requiredQty) {
          throw new Error(`Cannot dispatch more material for ${bomItem?.raw_materials?.material_code}. Required quantity already received.`);
        }
        
        // Check if dispatch would exceed required quantity
        const totalAfterDispatch = actualReceived + material.quantity;
        if (totalAfterDispatch > requiredQty) {
          throw new Error(`Dispatch quantity for ${bomItem?.raw_materials?.material_code} would exceed required quantity. Max allowed: ${requiredQty - actualReceived}`);
        }
      }

      // Create kit preparation record
      const { data: kitPrep, error: kitError } = await supabase
        .from("kit_preparation")
        .insert({
          production_order_id: voucherId,
          status: 'SENT'
        })
        .select()
        .single();

      if (kitError) throw kitError;

      // Create kit items and update inventory
      for (const material of materials) {
        // Insert kit item
        const { error: kitItemError } = await supabase
          .from("kit_items")
          .insert({
            kit_preparation_id: kitPrep.id,
            raw_material_id: material.materialId,
            required_quantity: bomData.find(b => b.raw_material_id === material.materialId)?.quantity * productionOrder.quantity || 0,
            actual_quantity: material.quantity
          });

        if (kitItemError) throw kitItemError;

        // Update inventory
        const currentInventory = inventory.find(inv => inv.raw_material_id === material.materialId);
        if (!currentInventory || currentInventory.quantity < material.quantity) {
          throw new Error(`Insufficient inventory for material: ${currentInventory?.raw_materials?.material_code}`);
        }

        const { error: invError } = await supabase
          .from("inventory")
          .update({
            quantity: currentInventory.quantity - material.quantity,
            last_updated: new Date().toISOString()
          })
          .eq("raw_material_id", material.materialId);

        if (invError) throw invError;
      }

      // Update production order kit status
      await supabase
        .from("production_orders")
        .update({ kit_status: 'MATERIALS_SENT' })
        .eq("id", voucherId);
    },
    onSuccess: () => {
      toast({
        title: "Materials Dispatched Successfully",
        description: "All materials have been sent to production with strict controls applied",
      });
      
      setMaterialQuantities({});
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["kit-preparation", voucherId] });
      queryClient.invalidateQueries({ queryKey: ["production-material-receipts", voucherId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Dispatch Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDispatch = () => {
    const materials = Object.entries(materialQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([materialId, quantity]) => ({ materialId, quantity }));

    if (materials.length === 0) {
      toast({
        title: "No Materials Selected",
        description: "Please enter quantities for materials to dispatch",
        variant: "destructive",
      });
      return;
    }

    setIsDispatching(true);
    dispatchMutation.mutate(materials);
    setTimeout(() => setIsDispatching(false), 1000);
  };

  // Group BOM data by category
  const groupedBOMData = bomData.reduce((acc, bomItem) => {
    const category = bomItem.bom_type || 'main_assembly';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(bomItem);
    return acc;
  }, {} as Record<string, typeof bomData>);

  // Helper function to get material status and validation
  const getMaterialStatus = (materialId: string, requiredQty: number) => {
    const receipt = materialReceipts.find(r => r.raw_material_id === materialId);
    const actualReceived = receipt?.quantity_received || 0;
    const inventoryItem = inventory.find(inv => inv.raw_material_id === materialId);
    const availableStock = inventoryItem?.quantity || 0;
    
    const isComplete = actualReceived >= requiredQty;
    const maxDispatchAllowed = Math.max(0, requiredQty - actualReceived);
    const canDispatch = !isComplete && availableStock > 0;
    
    return {
      actualReceived,
      isComplete,
      maxDispatchAllowed,
      canDispatch,
      availableStock,
      status: isComplete ? 'COMPLETE' : actualReceived > 0 ? 'PARTIAL' : 'PENDING'
    };
  };

  const renderMaterialSection = (sectionName: string, materials: typeof bomData, categoryKey: string) => {
    if (!materials || materials.length === 0) {
      return (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {sectionName}
              <Badge variant="outline">0 materials</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-4">No materials in this category</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {sectionName}
            <Badge variant="outline">{materials.length} materials</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Code</TableHead>
                <TableHead>Raw Material Name</TableHead>
                <TableHead>Required Qty</TableHead>
                <TableHead>Available Stock</TableHead>
                <TableHead>Received by Production</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quantity to Dispatch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((bomItem) => {
                const requiredQty = bomItem.quantity * (productionOrder?.quantity || 0);
                const materialStatus = getMaterialStatus(bomItem.raw_material_id, requiredQty);
                
                return (
                  <TableRow key={bomItem.id} className={materialStatus.isComplete ? 'bg-green-50' : ''}>
                    <TableCell className="font-mono font-medium">
                      {bomItem.raw_materials?.material_code}
                    </TableCell>
                    <TableCell>{bomItem.raw_materials?.name}</TableCell>
                    <TableCell className="font-semibold">{requiredQty}</TableCell>
                    <TableCell className="font-medium">
                      {materialStatus.availableStock}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {materialStatus.actualReceived}
                      {materialStatus.actualReceived > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {((materialStatus.actualReceived / requiredQty) * 100).toFixed(0)}% received
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {materialStatus.status === 'COMPLETE' ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Complete - No More Material Needed
                        </Badge>
                      ) : materialStatus.status === 'PARTIAL' ? (
                        <Badge variant="secondary" className="gap-1">
                          <Package className="h-3 w-3" />
                          Partially Received
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {materialStatus.isComplete ? (
                        <div className="text-sm text-muted-foreground font-medium">
                          Material Complete
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          max={Math.min(materialStatus.maxDispatchAllowed, materialStatus.availableStock)}
                          value={materialQuantities[bomItem.raw_material_id] || ''}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            const maxAllowed = Math.min(materialStatus.maxDispatchAllowed, materialStatus.availableStock);
                            
                            if (value > maxAllowed) {
                              toast({
                                title: "Invalid Quantity",
                                description: `Maximum allowed: ${maxAllowed} units`,
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            setMaterialQuantities(prev => ({
                              ...prev,
                              [bomItem.raw_material_id]: value
                            }));
                          }}
                          disabled={!materialStatus.canDispatch || isDispatching}
                          className="w-24"
                          placeholder="0"
                        />
                      )}
                      {!materialStatus.isComplete && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Max: {Math.min(materialStatus.maxDispatchAllowed, materialStatus.availableStock)}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  if (isLoadingOrder) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
          <p className="text-muted-foreground">Loading production voucher details...</p>
        </div>
      </div>
    );
  }

  if (!productionOrder) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Production Voucher Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">The requested production voucher could not be found.</p>
          <Button variant="outline" onClick={onBack} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Production Vouchers
        </Button>
        <Button
          onClick={() => queryClient.invalidateQueries()}
          variant="outline"
          size="sm"
          className="gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh Data
        </Button>
      </div>

      {/* Voucher Information */}
      <Card>
        <CardHeader>
          <CardTitle>Production Voucher: {productionOrder.voucher_number}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Product:</span>
              <p className="font-medium">{productionOrder.products?.name}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Product Code:</span>
              <p className="font-medium">{productionOrder.products?.product_code}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Production Quantity:</span>
              <p className="font-medium">{productionOrder.quantity}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Kit Status:</span>
              <Badge variant={productionOrder.kit_status === 'MATERIALS_SENT' ? 'default' : 'secondary'}>
                {productionOrder.kit_status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BOM Grouped by Category with Enhanced Controls */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Material Dispatch with Over-Issuance Prevention</h3>
        
        {renderMaterialSection("Sub Assembly Materials", groupedBOMData.sub_assembly, "sub_assembly")}
        {renderMaterialSection("Main Assembly Materials", groupedBOMData.main_assembly, "main_assembly")}
        {renderMaterialSection("Accessory Materials", groupedBOMData.accessory, "accessory")}
      </div>

      {/* Dispatch Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleDispatch}
          disabled={isDispatching || Object.values(materialQuantities).every(qty => qty <= 0)}
          className="gap-2"
        >
          {isDispatching ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Dispatching...
            </>
          ) : (
            <>
              <Package className="h-4 w-4" />
              Dispatch Selected Materials
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ProductionVoucherDetails;
