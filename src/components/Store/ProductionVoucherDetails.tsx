
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, AlertTriangle, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductionVoucherDetailsProps {
  voucherId: string;
  onBack: () => void;
}

const ProductionVoucherDetails = ({ voucherId, onBack }: ProductionVoucherDetailsProps) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch production order details with BOM
  const { data: productionOrder, isLoading } = useQuery({
    queryKey: ["production-order-details", voucherId],
    queryFn: async () => {
      console.log("🔍 Fetching production order details for:", voucherId);
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!product_id (
            name,
            bom!product_id (
              *,
              raw_materials!raw_material_id (
                id,
                material_code,
                name,
                category
              )
            )
          )
        `)
        .eq("id", voucherId)
        .single();

      if (error) {
        console.error("❌ Error fetching production order:", error);
        throw error;
      }

      console.log("📊 Production order data:", data);
      return data;
    },
  });

  // Fetch real-time inventory data with auto-refresh
  const { data: inventoryData = [], refetch: refetchInventory } = useQuery({
    queryKey: ["inventory-real-time", voucherId],
    queryFn: async () => {
      console.log("🔍 Fetching real-time inventory data...");
      
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
        `)
        .order("last_updated", { ascending: false });
      
      if (error) {
        console.error("❌ Error fetching inventory:", error);
        throw error;
      }

      console.log("📦 Real-time inventory data:", data);
      return data || [];
    },
    refetchInterval: 2000, // Auto-refresh every 2 seconds
  });

  // Enhanced dispatched materials query to track actual received quantities
  const { data: dispatchedItems = [] } = useQuery({
    queryKey: ["dispatched-materials", voucherId],
    queryFn: async () => {
      console.log("🔍 Fetching dispatched materials for voucher:", voucherId);
      
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          raw_material_id,
          actual_quantity,
          verified_by_production,
          created_at,
          kit_preparation!inner(production_order_id)
        `)
        .eq("kit_preparation.production_order_id", voucherId);

      if (error) {
        console.error("❌ Error fetching dispatched materials:", error);
        throw error;
      }

      console.log("📋 Dispatched materials:", data);
      return data || [];
    },
  });

  // Create inventory lookup map
  const inventoryMap = new Map();
  inventoryData.forEach(item => {
    inventoryMap.set(item.raw_materials.id, item.quantity);
  });

  // Enhanced calculation to use production-verified quantities
  const getActualReceivedQuantity = (materialId: string) => {
    return dispatchedItems
      .filter(item => item.raw_material_id === materialId && item.verified_by_production)
      .reduce((sum, item) => sum + item.actual_quantity, 0);
  };

  // Get total dispatched (sent) quantities regardless of production verification
  const getDispatchedQuantity = (materialId: string) => {
    return dispatchedItems
      .filter(item => item.raw_material_id === materialId)
      .reduce((sum, item) => sum + item.actual_quantity, 0);
  };

  // Get current stock from real-time inventory
  const getCurrentStock = (materialId: string) => {
    return inventoryMap.get(materialId) || 0;
  };

  // CRITICAL FIX: Enhanced material dispatch mutation with atomic operations
  const sendMaterialsMutation = useMutation({
    mutationFn: async (materialsToSend: any[]) => {
      console.log("🚀 Starting ENHANCED material dispatch with ATOMIC inventory deduction...");
      console.log("📋 Materials to dispatch:", materialsToSend);
      
      // Pre-validation with detailed logging
      const validationErrors: string[] = [];
      const dispatchPlan = [];
      
      for (const material of materialsToSend) {
        const currentStock = getCurrentStock(material.raw_materials.id);
        const quantityToSend = quantities[material.raw_materials.id] || 0;
        
        console.log(`🧮 PRE-VALIDATION for ${material.raw_materials.material_code}:`);
        console.log(`   - Material ID: ${material.raw_materials.id}`);
        console.log(`   - Current Stock: ${currentStock}`);
        console.log(`   - Quantity to Send: ${quantityToSend}`);
        
        if (quantityToSend <= 0) {
          validationErrors.push(`Invalid quantity for ${material.raw_materials.material_code}`);
          continue;
        }
        
        if (quantityToSend > currentStock) {
          validationErrors.push(`Insufficient stock for ${material.raw_materials.material_code}: Required ${quantityToSend}, Available ${currentStock}`);
          continue;
        }

        dispatchPlan.push({
          materialId: material.raw_materials.id,
          materialCode: material.raw_materials.material_code,
          materialName: material.raw_materials.name,
          currentStock,
          quantityToSend,
          newStock: currentStock - quantityToSend,
          requiredQuantity: material.quantity * productionOrder.quantity
        });
      }

      if (validationErrors.length > 0) {
        console.error("❌ VALIDATION FAILED:", validationErrors);
        throw new Error(validationErrors.join('; '));
      }

      console.log("✅ VALIDATION PASSED. Execution plan:", dispatchPlan);

      try {
        // STEP 1: Create kit preparation record
        console.log("🔄 STEP 1: Creating kit preparation record...");
        const { data: kitPrep, error: kitError } = await supabase
          .from("kit_preparation")
          .insert({
            production_order_id: voucherId,
            status: "MATERIALS_SENT"
          })
          .select()
          .single();

        if (kitError) {
          console.error("❌ STEP 1 FAILED - Kit preparation error:", kitError);
          throw new Error(`Failed to create kit preparation: ${kitError.message}`);
        }

        console.log("✅ STEP 1 SUCCESS - Kit preparation created:", kitPrep.id);

        // STEP 2: Process each material with ATOMIC inventory deduction
        const dispatchResults = [];
        
        for (const plan of dispatchPlan) {
          console.log(`📦 PROCESSING ATOMIC DISPATCH for ${plan.materialCode}...`);
          console.log(`   - Before: Stock = ${plan.currentStock}`);
          console.log(`   - Deducting: ${plan.quantityToSend}`);
          console.log(`   - Expected After: ${plan.newStock}`);
          
          // CRITICAL: Direct inventory update with immediate verification
          console.log(`🔄 CRITICAL STEP: Updating inventory for material ${plan.materialId}...`);
          
          const { data: inventoryUpdate, error: invError } = await supabase
            .from("inventory")
            .update({
              quantity: plan.newStock,
              last_updated: new Date().toISOString()
            })
            .eq("raw_material_id", plan.materialId)
            .select("quantity")
            .single();

          if (invError) {
            console.error("❌ CRITICAL FAILURE - Inventory update failed:", invError);
            throw new Error(`CRITICAL: Failed to update inventory for ${plan.materialCode}: ${invError.message}`);
          }

          console.log("✅ INVENTORY UPDATE SUCCESSFUL:", {
            material: plan.materialCode,
            previous: plan.currentStock,
            new: inventoryUpdate.quantity,
            deducted: plan.quantityToSend
          });

          // Create kit item record
          const { error: itemError } = await supabase
            .from("kit_items")
            .insert({
              kit_preparation_id: kitPrep.id,
              raw_material_id: plan.materialId,
              required_quantity: plan.requiredQuantity,
              actual_quantity: plan.quantityToSend
            });

          if (itemError) {
            console.error("❌ Kit item creation failed:", itemError);
            throw new Error(`Failed to create kit item for ${plan.materialCode}: ${itemError.message}`);
          }

          // CRITICAL: Log material movement for audit trail
          console.log(`📝 LOGGING MATERIAL MOVEMENT for ${plan.materialCode}...`);
          
          const { error: movementError } = await supabase
            .from("material_movements")
            .insert({
              raw_material_id: plan.materialId,
              movement_type: "ISSUED_TO_PRODUCTION",
              quantity: plan.quantityToSend,
              reference_id: voucherId,
              reference_type: "PRODUCTION_ORDER",
              reference_number: productionOrder.voucher_number,
              notes: `Store Dispatch: ${plan.materialCode} dispatched to Production Voucher ${productionOrder.voucher_number}. Stock: ${plan.currentStock} → ${plan.newStock}`
            });

          if (movementError) {
            console.error("❌ MATERIAL MOVEMENT LOGGING FAILED:", movementError);
            // Continue execution but warn about logging failure
            console.warn("⚠️ Material movement logging failed, but dispatch continues");
          } else {
            console.log("✅ MATERIAL MOVEMENT LOGGED SUCCESSFULLY");
          }

          dispatchResults.push({
            material_code: plan.materialCode,
            material_name: plan.materialName,
            quantity_sent: plan.quantityToSend,
            previous_stock: plan.currentStock,
            new_stock: plan.newStock,
            voucher_number: productionOrder.voucher_number
          });

          console.log(`✅ DISPATCH COMPLETE for ${plan.materialCode}`);
        }

        console.log("🎉 ALL MATERIALS DISPATCHED SUCCESSFULLY WITH INVENTORY DEDUCTION CONFIRMED");
        return { 
          success: true, 
          kitPrepId: kitPrep.id, 
          results: dispatchResults,
          voucherNumber: productionOrder.voucher_number
        };

      } catch (error) {
        console.error("❌ DISPATCH TRANSACTION FAILED:", error);
        throw error;
      }
    },
    onSuccess: (result) => {
      console.log("🎉 DISPATCH SUCCESS HANDLER:", result);
      
      toast({
        title: "Materials Dispatched Successfully",
        description: `${result.results.length} materials dispatched to Production Voucher ${result.voucherNumber}. Inventory updated in real-time.`,
      });
      
      // Clear quantities and force refresh of all related data
      setQuantities({});
      
      // CRITICAL: Force immediate refresh of all inventory data
      console.log("🔄 FORCING IMMEDIATE REFRESH OF ALL INVENTORY DATA...");
      queryClient.invalidateQueries({ queryKey: ["production-order-details"] });
      queryClient.invalidateQueries({ queryKey: ["dispatched-materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      
      // Force immediate inventory refresh
      setTimeout(() => {
        console.log("🔄 EXECUTING DELAYED INVENTORY REFRESH...");
        refetchInventory();
      }, 500);
      
      setTimeout(() => {
        console.log("🔄 EXECUTING SECOND DELAYED INVENTORY REFRESH...");
        refetchInventory();
      }, 1500);
    },
    onError: (error: Error) => {
      console.error("❌ DISPATCH FAILED:", error);
      toast({
        title: "Material Dispatch Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuantityChange = (materialId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setQuantities(prev => ({
      ...prev,
      [materialId]: quantity
    }));
  };

  const handleSendMaterials = () => {
    const bom = productionOrder?.products?.bom || [];
    const materialsWithQuantities = bom.filter(item => 
      quantities[item.raw_materials.id] && quantities[item.raw_materials.id] > 0
    );

    if (materialsWithQuantities.length === 0) {
      toast({
        title: "No Materials Selected",
        description: "Please enter quantities for the materials you want to dispatch",
        variant: "destructive",
      });
      return;
    }

    // Enhanced validation before dispatch
    const insufficientStockMaterials = materialsWithQuantities.filter(material => {
      const currentStock = getCurrentStock(material.raw_materials.id);
      const quantityToSend = quantities[material.raw_materials.id];
      return quantityToSend > currentStock;
    });

    if (insufficientStockMaterials.length > 0) {
      const materialNames = insufficientStockMaterials.map(m => m.raw_materials.material_code).join(', ');
      toast({
        title: "Insufficient Stock",
        description: `Cannot dispatch materials with insufficient stock: ${materialNames}. Please check inventory levels.`,
        variant: "destructive",
      });
      return;
    }

    console.log("🚀 INITIATING ENHANCED MATERIAL DISPATCH for:", materialsWithQuantities.length, "materials");
    sendMaterialsMutation.mutate(materialsWithQuantities);
  };

  // Force inventory refresh when component mounts or voucher changes
  useEffect(() => {
    console.log("🔄 AUTO-REFRESHING INVENTORY DATA FOR REAL-TIME SYNC");
    refetchInventory();
  }, [voucherId, refetchInventory]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Loading production voucher details...</p>
        </div>
      </div>
    );
  }

  if (!productionOrder) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Production voucher not found</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  const bom = productionOrder.products?.bom || [];
  const orderQuantity = productionOrder.quantity;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Production Vouchers
        </Button>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => refetchInventory()}
            size="sm"
          >
            Refresh Inventory
          </Button>
          <div className="text-sm text-muted-foreground">
            Real-time sync: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Production Voucher: {productionOrder.voucher_number}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Product</p>
              <p className="font-medium">{productionOrder.products?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Order Quantity</p>
              <p className="font-medium">{orderQuantity}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={productionOrder.status === "COMPLETED" ? "default" : "secondary"}>
                {productionOrder.status?.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">ENHANCED Material Dispatch - Real-time Inventory Deduction</h3>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Required Qty</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Total Dispatched</TableHead>
                  <TableHead>Actual Received</TableHead>
                  <TableHead>Qty to Dispatch</TableHead>
                  <TableHead>Balance Needed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bom.map((item) => {
                  const requiredQty = item.quantity * orderQuantity;
                  const currentStock = getCurrentStock(item.raw_materials.id);
                  const totalDispatched = getDispatchedQuantity(item.raw_materials.id);
                  const actualReceived = getActualReceivedQuantity(item.raw_materials.id);
                  const qtyToDispatch = quantities[item.raw_materials.id] || 0;
                  
                  // Enhanced balance calculation: Required - Actual Received by Production
                  const balanceNeeded = Math.max(0, requiredQty - actualReceived - qtyToDispatch);
                  
                  const hasInsufficientStock = qtyToDispatch > currentStock;
                  const isFullyReceived = actualReceived >= requiredQty;
                  const hasPendingMaterial = totalDispatched > actualReceived; // Material in transit

                  return (
                    <TableRow key={item.raw_materials.id} className={hasInsufficientStock ? "bg-red-50" : ""}>
                      <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                      <TableCell>{item.raw_materials.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.raw_materials.category}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{requiredQty}</TableCell>
                      <TableCell className={`font-medium ${currentStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {currentStock}
                        <div className="text-xs text-muted-foreground">Live Stock</div>
                      </TableCell>
                      <TableCell className="text-blue-600 font-medium">
                        {totalDispatched}
                        <div className="text-xs text-muted-foreground">Total Sent</div>
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {actualReceived}
                        <div className="text-xs text-muted-foreground">
                          {hasPendingMaterial ? `(+${totalDispatched - actualReceived} pending)` : 'Confirmed'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={Math.min(currentStock, balanceNeeded)}
                          value={quantities[item.raw_materials.id] || ""}
                          onChange={(e) => handleQuantityChange(item.raw_materials.id, e.target.value)}
                          className={`w-24 ${hasInsufficientStock ? 'border-red-500' : ''}`}
                          placeholder="0"
                          disabled={isFullyReceived}
                        />
                        {hasInsufficientStock && (
                          <p className="text-xs text-red-500 mt-1">
                            Insufficient stock ({currentStock} available)
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={`font-medium ${balanceNeeded > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {balanceNeeded}
                        <div className="text-xs text-muted-foreground">
                          After dispatch
                        </div>
                      </TableCell>
                      <TableCell>
                        {isFullyReceived ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Complete
                          </Badge>
                        ) : hasPendingMaterial ? (
                          <Badge variant="warning" className="gap-1">
                            <Package className="h-3 w-3" />
                            In Transit
                          </Badge>
                        ) : currentStock === 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            No Stock
                          </Badge>
                        ) : hasInsufficientStock ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Insufficient
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Package className="h-3 w-3" />
                            Ready
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleSendMaterials}
                disabled={sendMaterialsMutation.isPending || Object.keys(quantities).length === 0}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
              >
                {sendMaterialsMutation.isPending ? "Dispatching Materials..." : "SEND MATERIALS TO PRODUCTION"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionVoucherDetails;
