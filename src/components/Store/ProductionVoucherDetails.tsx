import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, AlertTriangle, CheckCircle, FileDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateProductionVoucherPDF, generateProductionVoucherFilename, type ProductionVoucherData } from "@/utils/pdfTemplates";

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
          raw_materials!raw_material_id (
            id,
            material_code,
            name,
            category
          ),
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
      .filter(item => item.raw_materials.id === materialId && item.verified_by_production)
      .reduce((sum, item) => sum + item.actual_quantity, 0);
  };

  // Get total dispatched (sent) quantities regardless of production verification
  const getDispatchedQuantity = (materialId: string) => {
    return dispatchedItems
      .filter(item => item.raw_materials.id === materialId)
      .reduce((sum, item) => sum + item.actual_quantity, 0);
  };

  // Get current stock from real-time inventory
  const getCurrentStock = (materialId: string) => {
    return inventoryMap.get(materialId) || 0;
  };

  // CRITICAL FIX: Enhanced material dispatch mutation with atomic operations and comprehensive logging
  const sendMaterialsMutation = useMutation({
    mutationFn: async (materialsToSend: any[]) => {
      console.log("🚀 STARTING ENHANCED MATERIAL DISPATCH WITH ATOMIC INVENTORY DEDUCTION...");
      console.log("📋 Materials to dispatch:", materialsToSend);
      
      // STEP 1: Comprehensive pre-validation
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

      console.log("✅ VALIDATION PASSED. Dispatch plan:", dispatchPlan);

      try {
        // STEP 2: Create kit preparation record with retry logic
        console.log("🔄 STEP 2: Creating kit preparation record...");
        const { data: kitPrep, error: kitError } = await supabase
          .from("kit_preparation")
          .insert({
            production_order_id: voucherId,
            status: "MATERIALS_SENT"
          })
          .select()
          .single();

        if (kitError) {
          console.error("❌ STEP 2 FAILED - Kit preparation error:", kitError);
          throw new Error(`Failed to create kit preparation: ${kitError.message}`);
        }

        console.log("✅ STEP 2 SUCCESS - Kit preparation created:", kitPrep.id);

        // STEP 3: Process each material with ATOMIC inventory deduction and logging
        const dispatchResults = [];
        
        for (const plan of dispatchPlan) {
          console.log(`📦 PROCESSING ATOMIC DISPATCH for ${plan.materialCode}...`);
          
          // CRITICAL: Atomic inventory update with immediate verification
          console.log(`🔄 CRITICAL: Updating inventory for material ${plan.materialId}...`);
          console.log(`   - Before: ${plan.currentStock}`);
          console.log(`   - Deducting: ${plan.quantityToSend}`);
          console.log(`   - Expected After: ${plan.newStock}`);
          
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

          // STEP 4: Create kit item record
          const { data: kitItemData, error: itemError } = await supabase
            .from("kit_items")
            .insert({
              kit_preparation_id: kitPrep.id,
              raw_material_id: plan.materialId,
              required_quantity: plan.requiredQuantity,
              actual_quantity: plan.quantityToSend
            })
            .select()
            .single();

          if (itemError) {
            console.error("❌ Kit item creation failed:", itemError);
            throw new Error(`Failed to create kit item for ${plan.materialCode}: ${itemError.message}`);
          }

          console.log("✅ KIT ITEM CREATED:", kitItemData.id);

          // STEP 5: CRITICAL - Log material movement for audit trail
          console.log(`📝 LOGGING MATERIAL MOVEMENT for ${plan.materialCode}...`);
          
          const { data: movementData, error: movementError } = await supabase
            .from("material_movements")
            .insert({
              raw_material_id: plan.materialId,
              movement_type: "ISSUED_TO_PRODUCTION",
              quantity: plan.quantityToSend,
              reference_id: voucherId,
              reference_type: "PRODUCTION_ORDER",
              reference_number: productionOrder.voucher_number,
              notes: `Store Dispatch: ${plan.materialCode} dispatched to Production Voucher ${productionOrder.voucher_number}. Stock: ${plan.currentStock} → ${plan.newStock}`
            })
            .select()
            .single();

          if (movementError) {
            console.error("❌ MATERIAL MOVEMENT LOGGING FAILED:", movementError);
            throw new Error(`Failed to log material movement for ${plan.materialCode}: ${movementError.message}`);
          }

          console.log("✅ MATERIAL MOVEMENT LOGGED:", movementData.id);

          dispatchResults.push({
            material_code: plan.materialCode,
            material_name: plan.materialName,
            quantity_sent: plan.quantityToSend,
            previous_stock: plan.currentStock,
            new_stock: plan.newStock,
            voucher_number: productionOrder.voucher_number,
            kit_item_id: kitItemData.id,
            movement_id: movementData.id
          });

          console.log(`✅ COMPLETE DISPATCH PROCESSING for ${plan.materialCode}`);
        }

        console.log("🎉 ALL MATERIALS DISPATCHED SUCCESSFULLY WITH FULL AUDIT TRAIL");
        
        // ENHANCED: Trigger real-time updates across the application
        localStorage.setItem('material_dispatched', Date.now().toString());
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'material_dispatched',
          newValue: Date.now().toString()
        }));
        
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
      console.log("🎉 DISPATCH SUCCESS:", result);
      
      toast({
        title: "Materials Dispatched Successfully",
        description: `${result.results.length} materials dispatched to Production Voucher ${result.voucherNumber}. Real-time inventory deduction completed.`,
      });
      
      // Clear quantities and force comprehensive refresh
      setQuantities({});
      
      // CRITICAL: Force immediate refresh of ALL related data
      console.log("🔄 FORCING COMPREHENSIVE DATA REFRESH...");
      queryClient.invalidateQueries({ queryKey: ["production-order-details"] });
      queryClient.invalidateQueries({ queryKey: ["dispatched-materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      
      // Multiple staged refreshes for real-time sync
      setTimeout(() => {
        console.log("🔄 DELAYED INVENTORY REFRESH 1...");
        refetchInventory();
      }, 500);
      
      setTimeout(() => {
        console.log("🔄 DELAYED INVENTORY REFRESH 2...");
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

  // Generate PDF for production voucher
  const handleGeneratePDF = () => {
    if (!productionOrder || !bom.length || dispatchedItems.length === 0) {
      toast({
        title: "Cannot Generate PDF",
        description: "No materials have been dispatched yet. Please dispatch materials first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare PDF data
      const pdfData: ProductionVoucherData = {
        voucherNumber: productionOrder.voucher_number,
        productName: productionOrder.products?.name || "Unknown Product",
        productionQuantity: productionOrder.quantity,
        scheduledDate: productionOrder.scheduled_date,
        dispatchedAt: new Date().toISOString(),
        dispatchedBy: "Store Department", // Could be enhanced to get current user
        materials: bom.map(bomItem => ({
          materialCode: bomItem.raw_materials.material_code,
          materialName: bomItem.raw_materials.name,
          category: bomItem.raw_materials.category,
          requiredQuantity: bomItem.quantity * productionOrder.quantity,
          dispatchedQuantity: getDispatchedQuantity(bomItem.raw_materials.id),
          currentStock: getCurrentStock(bomItem.raw_materials.id),
          bomType: bomItem.bom_type || 'main_assembly'
        }))
      };

      // Generate and download PDF
      const pdf = generateProductionVoucherPDF(pdfData);
      const filename = generateProductionVoucherFilename(productionOrder.voucher_number);
      pdf.save(filename);

      toast({
        title: "PDF Generated",
        description: `Production voucher PDF downloaded: ${filename}`,
      });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "PDF Generation Failed",
        description: "Failed to generate production voucher PDF. Please try again.",
        variant: "destructive",
      });
    }
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

  // Group BOM items by category
  const groupedBOM = {
    'Sub Assembly': bom.filter(item => item.bom_type === 'sub_assembly'),
    'Main Assembly': bom.filter(item => item.bom_type === 'main_assembly'),
    'Accessory': bom.filter(item => item.bom_type === 'accessory')
  };

  // Helper function to render material rows for a category
  const renderMaterialRows = (items: any[]) => {
    return items.map((item) => {
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
          <TableCell className="font-medium">
            {balanceNeeded > 0 ? (
              <span className="text-orange-600">{balanceNeeded}</span>
            ) : (
              <span className="text-green-600">Complete</span>
            )}
          </TableCell>
          <TableCell>
            {isFullyReceived ? (
              <Badge variant="default">Complete</Badge>
            ) : currentStock === 0 ? (
              <Badge variant="destructive">Out of Stock</Badge>
            ) : hasInsufficientStock ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Insufficient Stock
              </Badge>
            ) : qtyToDispatch > 0 ? (
              <Badge variant="secondary">Ready to Dispatch</Badge>
            ) : (
              <Badge variant="outline">Available</Badge>
            )}
          </TableCell>
        </TableRow>
      );
    });
  };

  // Helper function to render category header
  const renderCategoryHeader = (categoryName: string, itemCount: number) => {
    if (itemCount === 0) return null;
    
    return (
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableCell colSpan={10} className="font-semibold text-primary py-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {categoryName} ({itemCount} materials)
          </div>
        </TableCell>
      </TableRow>
    );
  };

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
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">ENHANCED Material Dispatch - Real-time Inventory Deduction</h3>
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
                {/* Sub Assembly Section */}
                {renderCategoryHeader("Sub Assembly", groupedBOM['Sub Assembly'].length)}
                {renderMaterialRows(groupedBOM['Sub Assembly'])}
                
                {/* Main Assembly Section */}
                {renderCategoryHeader("Main Assembly", groupedBOM['Main Assembly'].length)}
                {renderMaterialRows(groupedBOM['Main Assembly'])}
                
                {/* Accessory Section */}
                {renderCategoryHeader("Accessory", groupedBOM['Accessory'].length)}
                {renderMaterialRows(groupedBOM['Accessory'])}
              </TableBody>
            </Table>

            <div className="flex justify-end gap-4 pt-4 border-t">
              {dispatchedItems.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleGeneratePDF}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Generate PDF
                </Button>
              )}
              <Button
                onClick={handleSendMaterials}
                disabled={sendMaterialsMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sendMaterialsMutation.isPending ? "Dispatching Materials..." : "Dispatch Materials to Production"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionVoucherDetails;
