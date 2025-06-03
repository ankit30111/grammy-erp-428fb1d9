
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

  // Fetch real-time inventory data
  const { data: inventoryData = [], refetch: refetchInventory } = useQuery({
    queryKey: ["inventory-for-voucher", voucherId],
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

      console.log("📦 Current inventory data:", data);
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Fetch kit items that were actually dispatched for this voucher
  const { data: dispatchedItems = [] } = useQuery({
    queryKey: ["dispatched-items", voucherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          raw_material_id,
          actual_quantity,
          kit_preparation!inner(production_order_id)
        `)
        .eq("kit_preparation.production_order_id", voucherId);

      if (error) throw error;
      return data || [];
    },
  });

  // Create inventory map
  const inventoryMap = new Map();
  inventoryData.forEach(item => {
    inventoryMap.set(item.raw_material_id, item.quantity);
  });

  // Calculate total dispatched quantities by material
  const getDispatchedQuantity = (materialId: string) => {
    return dispatchedItems
      .filter(item => item.raw_material_id === materialId)
      .reduce((sum, item) => sum + item.actual_quantity, 0);
  };

  // Get current stock from real-time inventory
  const getCurrentStock = (materialId: string) => {
    return inventoryMap.get(materialId) || 0;
  };

  // Enhanced material dispatch mutation with better validation
  const sendMaterialsMutation = useMutation({
    mutationFn: async (materialsToSend: any[]) => {
      console.log("🚀 Starting enhanced material dispatch process...");
      
      // Pre-validation: Check if any materials have insufficient stock
      const validationErrors: string[] = [];
      
      for (const material of materialsToSend) {
        const currentStock = getCurrentStock(material.raw_materials.id);
        const quantityToSend = quantities[material.raw_materials.id] || 0;
        
        if (quantityToSend <= 0) {
          validationErrors.push(`Invalid quantity for ${material.raw_materials.material_code}`);
        }
        
        if (quantityToSend > currentStock) {
          validationErrors.push(`Insufficient stock for ${material.raw_materials.material_code}: Required ${quantityToSend}, Available ${currentStock}`);
        }
      }

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('; '));
      }

      // Begin transaction-like operations
      const dispatchResults = [];

      try {
        // 1. Create kit preparation record
        const { data: kitPrep, error: kitError } = await supabase
          .from("kit_preparation")
          .insert({
            production_order_id: voucherId,
            status: "MATERIALS_SENT"
          })
          .select()
          .single();

        if (kitError) {
          console.error("❌ Error creating kit preparation:", kitError);
          throw kitError;
        }

        console.log("✅ Kit preparation created:", kitPrep);

        // 2. Process each material dispatch
        for (const material of materialsToSend) {
          const quantityToSend = quantities[material.raw_materials.id] || 0;
          const currentStock = getCurrentStock(material.raw_materials.id);
          
          console.log(`📦 Processing ${material.raw_materials.material_code}: Sending ${quantityToSend} from stock of ${currentStock}`);
          
          // Create kit item record
          const { error: itemError } = await supabase
            .from("kit_items")
            .insert({
              kit_preparation_id: kitPrep.id,
              raw_material_id: material.raw_materials.id,
              required_quantity: material.quantity * productionOrder.quantity,
              actual_quantity: quantityToSend
            });

          if (itemError) {
            console.error("❌ Error creating kit item:", itemError);
            throw itemError;
          }

          // Update inventory - subtract the dispatched quantity
          const newStock = currentStock - quantityToSend;

          const { error: invError } = await supabase
            .from("inventory")
            .update({
              quantity: newStock,
              last_updated: new Date().toISOString()
            })
            .eq("raw_material_id", material.raw_materials.id);

          if (invError) {
            console.error("❌ Error updating inventory:", invError);
            throw invError;
          }

          // Log material movement
          const { error: movementError } = await supabase
            .from("material_movements")
            .insert({
              raw_material_id: material.raw_materials.id,
              movement_type: "ISSUED_TO_PRODUCTION",
              quantity: quantityToSend,
              reference_id: voucherId,
              reference_type: "PRODUCTION_ORDER",
              reference_number: productionOrder.voucher_number,
              notes: `Dispatched from Store to Production for voucher ${productionOrder.voucher_number}`
            });

          if (movementError) {
            console.error("❌ Error logging material movement:", movementError);
            throw movementError;
          }

          dispatchResults.push({
            material_code: material.raw_materials.material_code,
            quantity_sent: quantityToSend,
            new_stock: newStock
          });

          console.log(`✅ Successfully dispatched ${material.raw_materials.material_code}: ${quantityToSend} units`);
        }

        return { success: true, kitPrepId: kitPrep.id, results: dispatchResults };

      } catch (error) {
        console.error("❌ Transaction failed:", error);
        throw error;
      }
    },
    onSuccess: (result) => {
      toast({
        title: "Materials Dispatched Successfully",
        description: `${result.results.length} materials dispatched to production. Inventory updated.`,
      });
      
      // Clear quantities and refresh all data
      setQuantities({});
      queryClient.invalidateQueries({ queryKey: ["production-order-details", voucherId] });
      queryClient.invalidateQueries({ queryKey: ["dispatched-items", voucherId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-for-voucher", voucherId] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      
      refetchInventory();
    },
    onError: (error: Error) => {
      console.error("❌ Failed to dispatch materials:", error);
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

    sendMaterialsMutation.mutate(materialsWithQuantities);
  };

  // Auto-refresh inventory when component mounts or voucher changes
  useEffect(() => {
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
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleTimeString()}
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
          <div className="grid grid-cols-2 gap-4 mb-6">
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
            <h3 className="text-lg font-semibold">Material Dispatch - Real Time Inventory</h3>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Required Qty</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Already Dispatched</TableHead>
                  <TableHead>Qty to Dispatch</TableHead>
                  <TableHead>Remaining Need</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bom.map((item) => {
                  const requiredQty = item.quantity * orderQuantity;
                  const currentStock = getCurrentStock(item.raw_materials.id);
                  const alreadyDispatched = getDispatchedQuantity(item.raw_materials.id);
                  const qtyToDispatch = quantities[item.raw_materials.id] || 0;
                  const remainingNeed = Math.max(0, requiredQty - alreadyDispatched - qtyToDispatch);
                  const hasError = qtyToDispatch > currentStock;
                  const isFullyDispatched = alreadyDispatched >= requiredQty;

                  return (
                    <TableRow key={item.raw_materials.id}>
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
                      <TableCell className="text-blue-600 font-medium">{alreadyDispatched}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={Math.min(currentStock, remainingNeed)}
                          value={quantities[item.raw_materials.id] || ""}
                          onChange={(e) => handleQuantityChange(item.raw_materials.id, e.target.value)}
                          className={`w-24 ${hasError ? 'border-red-500' : ''}`}
                          placeholder="0"
                          disabled={isFullyDispatched}
                        />
                        {hasError && (
                          <p className="text-xs text-red-500 mt-1">
                            Exceeds stock ({currentStock})
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={`font-medium ${remainingNeed > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {remainingNeed}
                      </TableCell>
                      <TableCell>
                        {isFullyDispatched ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Complete
                          </Badge>
                        ) : currentStock === 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            No Stock
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Package className="h-3 w-3" />
                            Pending
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
              >
                {sendMaterialsMutation.isPending ? "Dispatching..." : "Dispatch Materials to Production"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionVoucherDetails;
