
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
          production_schedules!production_schedule_id (
            *,
            projections!projection_id (
              customers!customer_id (name),
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

  // Fetch real-time inventory data separately
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
    refetchInterval: 5000, // Refetch every 5 seconds for real-time data
  });

  // Fetch previously issued quantities for this voucher
  const { data: issuedQuantities = [] } = useQuery({
    queryKey: ["issued-quantities", voucherId],
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

  // Create a map of current inventory quantities by material ID
  const inventoryMap = new Map();
  inventoryData.forEach(item => {
    inventoryMap.set(item.raw_material_id, item.quantity);
  });

  // Calculate total issued quantities by material
  const getIssuedQuantity = (materialId: string) => {
    return issuedQuantities
      .filter(item => item.raw_material_id === materialId)
      .reduce((sum, item) => sum + item.actual_quantity, 0);
  };

  // Get current stock from real-time inventory
  const getCurrentStock = (materialId: string) => {
    return inventoryMap.get(materialId) || 0;
  };

  // Send materials mutation with validation and inventory update
  const sendMaterialsMutation = useMutation({
    mutationFn: async (materialsToSend: any[]) => {
      console.log("🚀 Starting material dispatch process...");
      
      // Validate quantities before proceeding
      for (const material of materialsToSend) {
        const currentStock = getCurrentStock(material.raw_materials.id);
        const quantityToSend = quantities[material.raw_materials.id] || 0;
        
        if (quantityToSend > currentStock) {
          throw new Error(`Cannot issue ${quantityToSend} units of ${material.raw_materials.material_code}. Only ${currentStock} units available in stock.`);
        }
        
        if (quantityToSend <= 0) {
          throw new Error(`Please enter a valid quantity for ${material.raw_materials.material_code}`);
        }
      }

      // Create kit preparation record
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

      // Create kit items and update inventory
      for (const material of materialsToSend) {
        const quantityToSend = quantities[material.raw_materials.id] || 0;
        
        // Create kit item
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

        // Update inventory - subtract the issued quantity
        const currentStock = getCurrentStock(material.raw_materials.id);
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

        // Log material movement with reference_number
        const { error: movementError } = await supabase
          .from("material_movements")
          .insert({
            raw_material_id: material.raw_materials.id,
            movement_type: "ISSUED_TO_PRODUCTION",
            quantity: quantityToSend,
            reference_id: voucherId,
            reference_type: "PRODUCTION_ORDER",
            reference_number: productionOrder.voucher_number,
            notes: `Issued for production voucher ${productionOrder.voucher_number}`
          });

        if (movementError) {
          console.error("❌ Error logging material movement:", movementError);
          throw movementError;
        }

        console.log(`✅ Processed ${material.raw_materials.material_code}: ${quantityToSend} units`);
      }

      return { success: true, kitPrepId: kitPrep.id };
    },
    onSuccess: () => {
      toast({
        title: "Materials Sent Successfully",
        description: "Materials have been dispatched to production and inventory has been updated",
      });
      
      // Clear quantities and refresh data
      setQuantities({});
      queryClient.invalidateQueries({ queryKey: ["production-order-details", voucherId] });
      queryClient.invalidateQueries({ queryKey: ["issued-quantities", voucherId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-for-voucher", voucherId] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      
      // Force immediate inventory refresh
      refetchInventory();
    },
    onError: (error: Error) => {
      console.error("❌ Failed to send materials:", error);
      toast({
        title: "Failed to Send Materials",
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
    const bom = productionOrder?.production_schedules?.projections?.products?.bom || [];
    const materialsWithQuantities = bom.filter(item => 
      quantities[item.raw_materials.id] && quantities[item.raw_materials.id] > 0
    );

    if (materialsWithQuantities.length === 0) {
      toast({
        title: "No Materials Selected",
        description: "Please enter quantities for the materials you want to send",
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

  const bom = productionOrder.production_schedules?.projections?.products?.bom || [];
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
              <p className="font-medium">{productionOrder.production_schedules?.projections?.products?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Order Quantity</p>
              <p className="font-medium">{orderQuantity}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{productionOrder.production_schedules?.projections?.customers?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={productionOrder.status === "COMPLETED" ? "default" : "secondary"}>
                {productionOrder.status?.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Bill of Materials - Real Time Inventory</h3>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Required Qty</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Already Issued</TableHead>
                  <TableHead>Qty to Issue</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bom.map((item) => {
                  const requiredQty = item.quantity * orderQuantity;
                  const currentStock = getCurrentStock(item.raw_materials.id);
                  const alreadyIssued = getIssuedQuantity(item.raw_materials.id);
                  const qtyToIssue = quantities[item.raw_materials.id] || 0;
                  const pending = requiredQty - alreadyIssued - qtyToIssue;
                  const hasError = qtyToIssue > currentStock;

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
                      <TableCell className="text-muted-foreground">{alreadyIssued}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={currentStock}
                          value={quantities[item.raw_materials.id] || ""}
                          onChange={(e) => handleQuantityChange(item.raw_materials.id, e.target.value)}
                          className={`w-24 ${hasError ? 'border-red-500' : ''}`}
                          placeholder="0"
                        />
                        {hasError && (
                          <p className="text-xs text-red-500 mt-1">
                            Exceeds stock ({currentStock})
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={`font-medium ${pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {pending}
                      </TableCell>
                      <TableCell>
                        {alreadyIssued >= requiredQty ? (
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
                {sendMaterialsMutation.isPending ? "Sending..." : "Send Materials to Production"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionVoucherDetails;
