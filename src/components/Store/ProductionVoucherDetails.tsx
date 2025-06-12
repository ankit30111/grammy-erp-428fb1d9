import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Package, AlertTriangle, CheckCircle, Truck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ProductionVoucherDetailsProps {
  voucherId: string;
  onBack: () => void;
}

export default function ProductionVoucherDetails({ voucherId, onBack }: ProductionVoucherDetailsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({});

  // Fetch production order details
  const { data: productionOrder, isLoading } = useQuery({
    queryKey: ["production-order-details", voucherId],
    queryFn: async () => {
      console.log("🔍 Fetching production order details for:", voucherId);
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products (
            id,
            name,
            product_code
          )
        `)
        .eq("id", voucherId)
        .single();

      if (error) {
        console.error("❌ Error fetching production order:", error);
        throw error;
      }

      console.log("📋 Production order fetched:", data);
      return data;
    },
  });

  // Fetch BOM data separately to avoid relation issues
  const { data: bomData = [] } = useQuery({
    queryKey: ["production-bom", productionOrder?.product_id],
    queryFn: async () => {
      if (!productionOrder?.product_id) return [];
      
      console.log("🔍 Fetching BOM for product:", productionOrder.product_id);
      
      const { data, error } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials (
            id,
            material_code,
            name,
            category
          )
        `)
        .eq("product_id", productionOrder.product_id);

      if (error) {
        console.error("❌ Error fetching BOM:", error);
        throw error;
      }

      console.log("📋 BOM data fetched:", data);
      return data || [];
    },
    enabled: !!productionOrder?.product_id,
  });

  // Fetch current inventory levels
  const { data: inventoryLevels = [] } = useQuery({
    queryKey: ["inventory-levels", voucherId],
    queryFn: async () => {
      if (!bomData || bomData.length === 0) return [];
      
      const materialIds = bomData.map((item: any) => item.raw_materials.id);
      
      const { data, error } = await supabase
        .from("inventory")
        .select("raw_material_id, quantity")
        .in("raw_material_id", materialIds);

      if (error) {
        console.error("❌ Error fetching inventory:", error);
        throw error;
      }

      return data || [];
    },
    enabled: bomData.length > 0,
  });

  // Enhanced material dispatch mutation with improved error handling
  const dispatchMutation = useMutation({
    mutationFn: async ({ materialId, dispatchQty }: { materialId: string; dispatchQty: number }) => {
      console.log("🚀 Starting material dispatch:", { materialId, dispatchQty, voucherId });
      
      try {
        // STEP 1: Get current inventory with validation
        const { data: currentInventory, error: inventoryError } = await supabase
          .from("inventory")
          .select("id, quantity, raw_material_id")
          .eq("raw_material_id", materialId)
          .single();

        if (inventoryError) {
          console.error("❌ Error fetching inventory:", inventoryError);
          throw new Error(`Failed to fetch inventory: ${inventoryError.message}`);
        }

        if (!currentInventory) {
          throw new Error("No inventory record found for this material");
        }

        const currentStock = currentInventory.quantity;
        console.log(`📊 Current stock for material ${materialId}: ${currentStock}`);
        
        if (currentStock < dispatchQty) {
          const errorMsg = `Insufficient stock: Available ${currentStock}, Required ${dispatchQty}`;
          console.error("❌ INSUFFICIENT STOCK:", errorMsg);
          throw new Error(errorMsg);
        }

        const newStock = currentStock - dispatchQty;
        console.log(`🔄 Planned stock reduction: ${currentStock} → ${newStock}`);

        // STEP 2: Get material details for logging
        const { data: materialData, error: materialError } = await supabase
          .from("raw_materials")
          .select("material_code, name")
          .eq("id", materialId)
          .single();

        if (materialError) {
          console.error("❌ Error fetching material data:", materialError);
          throw new Error(`Failed to fetch material details: ${materialError.message}`);
        }

        // STEP 3: Update inventory (this will trigger the database logging function)
        const { data: updatedInventory, error: updateError } = await supabase
          .from("inventory")
          .update({
            quantity: newStock,
            last_updated: new Date().toISOString()
          })
          .eq("raw_material_id", materialId)
          .select("quantity")
          .single();

        if (updateError) {
          console.error("❌ Inventory update failed:", updateError);
          throw new Error(`Failed to update inventory: ${updateError.message}`);
        }

        console.log("✅ INVENTORY UPDATE SUCCESSFUL:", {
          material: materialData.material_code,
          previous: currentStock,
          new: updatedInventory.quantity,
          deducted: dispatchQty
        });

        // STEP 4: Additional manual logging for production voucher context
        const { error: movementError } = await supabase
          .from("material_movements")
          .insert({
            raw_material_id: materialId,
            movement_type: "ISSUED_TO_PRODUCTION",
            quantity: dispatchQty,
            reference_id: voucherId,
            reference_type: "PRODUCTION_VOUCHER",
            reference_number: productionOrder?.voucher_number || `PV-${voucherId.substring(0, 8)}`,
            notes: `Material dispatched to production via voucher ${productionOrder?.voucher_number}. Material: ${materialData.material_code} - ${materialData.name}. Stock: ${currentStock} → ${newStock}`,
            created_at: new Date().toISOString()
          });

        if (movementError) {
          console.error("❌ Error logging production movement:", movementError);
          // Don't throw here as the inventory was already updated successfully
          console.warn("⚠️ Material dispatched but movement logging failed - will be logged by trigger");
        } else {
          console.log("✅ PRODUCTION MOVEMENT LOGGED SUCCESSFULLY");
        }

        console.log(`✅ MATERIAL DISPATCH COMPLETE: ${currentStock} → ${newStock}`);
        return {
          materialCode: materialData.material_code,
          materialName: materialData.name,
          previousStock: currentStock,
          newStock,
          quantityDeducted: dispatchQty
        };

      } catch (error: any) {
        console.error("❌ DISPATCH ERROR:", error);
        throw error;
      }
    },
    onSuccess: (result) => {
      toast({
        title: "Material Dispatched Successfully",
        description: `${result.quantityDeducted} units of ${result.materialCode} dispatched. New inventory: ${result.newStock}`,
      });
      
      // Clear the dispatch quantity for this material
      setDispatchQuantities(prev => ({
        ...prev,
        [result.materialCode]: 0
      }));
      
      // Refresh all relevant data
      queryClient.invalidateQueries({ queryKey: ["inventory-levels"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      
      // Trigger storage event for real-time updates across tabs
      localStorage.setItem('material_dispatched', Date.now().toString());
      
      // Trigger custom event for LogBook refresh
      window.dispatchEvent(new CustomEvent('refreshLogBook'));
      
      console.log("🔄 ALL DATA REFRESHED AFTER SUCCESSFUL DISPATCH");
    },
    onError: (error: any) => {
      console.error("❌ MATERIAL DISPATCH FAILED:", error);
      toast({
        title: "Material Dispatch Failed",
        description: error.message || "Failed to dispatch material to production",
        variant: "destructive",
      });
    },
  });

  const handleDispatchQuantityChange = (materialId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setDispatchQuantities(prev => ({
      ...prev,
      [materialId]: qty
    }));
  };

  const handleDispatchMaterial = (materialId: string) => {
    const dispatchQty = dispatchQuantities[materialId];
    
    if (!dispatchQty || dispatchQty <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid dispatch quantity",
        variant: "destructive",
      });
      return;
    }

    dispatchMutation.mutate({ materialId, dispatchQty });
  };

  const getInventoryQuantity = (materialId: string) => {
    const inventory = inventoryLevels.find(inv => inv.raw_material_id === materialId);
    return inventory?.quantity || 0;
  };

  const getRequiredQuantity = (bomItem: any) => {
    return bomItem.quantity * (productionOrder?.quantity || 1);
  };

  const getStatusBadge = (requiredQty: number, availableQty: number) => {
    if (availableQty >= requiredQty) {
      return <Badge className="bg-green-100 text-green-800">Sufficient Stock</Badge>;
    } else if (availableQty > 0) {
      return <Badge variant="secondary">Partial Stock</Badge>;
    } else {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
          <p className="text-muted-foreground">Loading production order details...</p>
        </div>
      </div>
    );
  }

  if (!productionOrder) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-medium mb-2">Production Order Not Found</h3>
        <p className="text-muted-foreground mb-4">The requested production order could not be found.</p>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Production Vouchers
        </Button>
        <Badge variant="outline">
          {productionOrder.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Production Order Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Production Voucher: {productionOrder.voucher_number}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-muted-foreground">Product:</span>
              <p className="font-medium">{productionOrder.products?.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Product Code:</span>
              <p className="font-medium">{productionOrder.products?.product_code}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Quantity:</span>
              <p className="font-medium">{productionOrder.quantity}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Scheduled Date:</span>
              <p className="font-medium">{format(new Date(productionOrder.scheduled_date), 'MMM dd, yyyy')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BOM Materials Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Material Requirements & Dispatch
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bomData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Required Qty</TableHead>
                  <TableHead>Available Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dispatch Qty</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bomData.map((bomItem: any) => {
                  const requiredQty = getRequiredQuantity(bomItem);
                  const availableQty = getInventoryQuantity(bomItem.raw_materials.id);
                  const dispatchQty = dispatchQuantities[bomItem.raw_materials.id] || 0;
                  
                  return (
                    <TableRow key={bomItem.id}>
                      <TableCell className="font-mono font-medium">
                        {bomItem.raw_materials.material_code}
                        {bomItem.is_critical && (
                          <Badge variant="destructive" className="ml-2 text-xs">Critical</Badge>
                        )}
                      </TableCell>
                      <TableCell>{bomItem.raw_materials.name}</TableCell>
                      <TableCell className="font-medium">{requiredQty}</TableCell>
                      <TableCell className={`font-medium ${
                        availableQty >= requiredQty ? "text-green-600" : "text-red-600"
                      }`}>
                        {availableQty}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(requiredQty, availableQty)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={Math.min(availableQty, requiredQty)}
                          value={dispatchQty}
                          onChange={(e) => handleDispatchQuantityChange(bomItem.raw_materials.id, e.target.value)}
                          className="w-24"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleDispatchMaterial(bomItem.raw_materials.id)}
                          disabled={
                            dispatchMutation.isPending || 
                            !dispatchQty || 
                            dispatchQty <= 0 || 
                            dispatchQty > availableQty
                          }
                          className="gap-1"
                        >
                          {dispatchMutation.isPending ? (
                            "Dispatching..."
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              Dispatch
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4" />
              <p>No BOM materials found for this product</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
