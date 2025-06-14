
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, Settings } from "lucide-react";
import EnhancedDispatchVerificationRow from "./EnhancedDispatchVerificationRow";

interface ProductionVoucherDetailViewProps {
  production: any;
  isOpen: boolean;
  onClose: () => void;
}

const ProductionVoucherDetailView = ({ production, isOpen, onClose }: ProductionVoucherDetailViewProps) => {
  const [lineAssignments, setLineAssignments] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const productionLines = ["Line 1", "Line 2", "Sub Assembly 1", "Sub Assembly 2"];

  // Fetch BOM data for the product
  const { data: bomData = [] } = useQuery({
    queryKey: ["production-bom", production?.id],
    queryFn: async () => {
      if (!production?.product_id) return [];
      
      const { data, error } = await supabase
        .from("bom")
        .select(`
          *,
          raw_materials!inner(
            id,
            material_code,
            name,
            category
          )
        `)
        .eq("product_id", production.product_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!production?.product_id && isOpen,
  });

  // ENHANCED: Fetch materials sent by store with individual dispatch tracking
  const { data: sentMaterials = [] } = useQuery({
    queryKey: ["sent-materials-detail", production?.id],
    queryFn: async () => {
      if (!production?.id) return [];
      
      console.log("🔍 Fetching individual dispatches for production:", production.id);
      
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          id,
          raw_material_id,
          actual_quantity,
          verified_by_production,
          created_at,
          raw_materials!inner(
            id,
            material_code,
            name,
            category
          ),
          kit_preparation!inner(
            production_order_id
          )
        `)
        .eq("kit_preparation.production_order_id", production.id)
        .order("created_at", { ascending: true });
      
      if (error) {
        console.error("❌ Error fetching sent materials:", error);
        throw error;
      }
      
      console.log("📦 Individual dispatch data:", data);
      return data || [];
    },
    enabled: !!production?.id && isOpen,
    refetchInterval: 3000, // Refresh every 3 seconds for real-time updates
  });

  // Initialize line assignments from existing production order data
  useEffect(() => {
    if (production?.production_lines) {
      try {
        const existingAssignments = typeof production.production_lines === 'string' 
          ? JSON.parse(production.production_lines) 
          : production.production_lines;
        setLineAssignments(existingAssignments || {});
      } catch (error) {
        console.log("No existing line assignments found");
        setLineAssignments({});
      }
    }
  }, [production]);

  // ENHANCED: Individual dispatch verification mutation with inventory adjustment
  const verifyDispatchMutation = useMutation({
    mutationFn: async ({ kitItemId, receivedQuantity, notes }: { kitItemId: string; receivedQuantity: number; notes: string }) => {
      console.log("🎯 PROCESSING INDIVIDUAL DISPATCH VERIFICATION...");
      
      // Get the kit item details
      const kitItem = sentMaterials.find(item => item.id === kitItemId);
      if (!kitItem) {
        throw new Error("Kit item not found");
      }

      const sentQuantity = kitItem.actual_quantity;
      const difference = sentQuantity - receivedQuantity;
      
      console.log(`📋 Verification details:`);
      console.log(`   - Kit Item ID: ${kitItemId}`);
      console.log(`   - Material: ${kitItem.raw_materials.material_code}`);
      console.log(`   - Sent: ${sentQuantity}`);
      console.log(`   - Received: ${receivedQuantity}`);
      console.log(`   - Difference: ${difference}`);

      // Update kit item with verification
      const { error: kitUpdateError } = await supabase
        .from("kit_items")
        .update({
          actual_quantity: receivedQuantity,
          verified_by_production: true
        })
        .eq("id", kitItemId);

      if (kitUpdateError) {
        console.error("❌ Error updating kit item:", kitUpdateError);
        throw new Error(`Failed to verify dispatch: ${kitUpdateError.message}`);
      }

      // Handle inventory adjustment if there's a difference
      if (difference !== 0) {
        console.log(`🔄 HANDLING INVENTORY ADJUSTMENT: ${difference}`);
        
        if (difference > 0) {
          // Production received less than sent - return excess to inventory
          console.log(`↩️ Returning ${difference} units to inventory`);
          
          const { data: currentInventory, error: invFetchError } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("raw_material_id", kitItem.raw_material_id)
            .single();

          if (invFetchError) {
            console.error("❌ Error fetching current inventory:", invFetchError);
            throw new Error(`Failed to fetch inventory: ${invFetchError.message}`);
          }

          const newQuantity = currentInventory.quantity + difference;
          
          const { error: invUpdateError } = await supabase
            .from("inventory")
            .update({
              quantity: newQuantity,
              last_updated: new Date().toISOString()
            })
            .eq("raw_material_id", kitItem.raw_material_id);

          if (invUpdateError) {
            console.error("❌ Error updating inventory:", invUpdateError);
            throw new Error(`Failed to return excess to inventory: ${invUpdateError.message}`);
          }

          console.log(`✅ EXCESS RETURNED TO INVENTORY: +${difference} units`);

          // Log the inventory return movement
          await supabase
            .from("material_movements")
            .insert({
              raw_material_id: kitItem.raw_material_id,
              movement_type: "PRODUCTION_RETURN",
              quantity: difference,
              reference_id: production.id,
              reference_type: "PRODUCTION_ORDER",
              reference_number: production.voucher_number,
              notes: `Individual Dispatch Verification Return: ${kitItem.raw_materials.material_code} - Sent ${sentQuantity}, Received ${receivedQuantity}, Returned ${difference}. Notes: ${notes}`
            });
        }

        // If shortage, log material request
        if (difference < 0) {
          const shortageQuantity = Math.abs(difference);
          console.log(`📝 LOGGING MATERIAL REQUEST FOR SHORTAGE: ${shortageQuantity} units`);
          
          await supabase
            .from("material_requests")
            .insert({
              production_order_id: production.id,
              raw_material_id: kitItem.raw_material_id,
              requested_quantity: shortageQuantity,
              reason: `Dispatch verification shortage: ${notes}`,
              status: 'PENDING'
            });
        }
      }

      console.log("✅ INDIVIDUAL DISPATCH VERIFICATION COMPLETED");
    },
    onSuccess: () => {
      toast({
        title: "Dispatch Verified",
        description: "Individual dispatch verified and inventory adjusted if needed",
      });
      
      // Refresh all related queries
      queryClient.invalidateQueries({ queryKey: ["sent-materials-detail"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
    },
    onError: (error: Error) => {
      console.error("❌ Failed to verify dispatch:", error);
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save line assignments mutation - Updated to change status to IN_PROGRESS
  const saveLineAssignments = useMutation({
    mutationFn: async () => {
      console.log("🏭 Saving line assignments:", lineAssignments);
      
      // Update production order with line assignments and change status to IN_PROGRESS
      const { error } = await supabase
        .from("production_orders")
        .update({
          production_lines: lineAssignments,
          status: 'IN_PROGRESS',  // Change status to make it appear in production lines
          updated_at: new Date().toISOString()
        })
        .eq("id", production.id);
      
      if (error) {
        console.error("❌ Error updating production order:", error);
        throw error;
      }
      
      console.log("✅ Line assignments saved and status updated to IN_PROGRESS");
    },
    onSuccess: () => {
      toast({
        title: "Line Assignments Saved",
        description: "Production line assignments have been updated and production started",
      });
      
      // Refresh all related queries
      queryClient.invalidateQueries({ queryKey: ["production-lines-overview"] });
      queryClient.invalidateQueries({ queryKey: ["line-production"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-productions"] });
      queryClient.invalidateQueries({ queryKey: ["production-orders"] });
    },
  });

  // Group sent materials by raw material ID and assembly type with enhanced tracking
  const groupedMaterials = sentMaterials.reduce((acc, item) => {
    const bomItem = bomData.find(b => b.raw_material_id === item.raw_material_id);
    const bomType = bomItem?.bom_type || 'main_assembly';
    
    if (!acc[bomType]) {
      acc[bomType] = {};
    }
    
    if (!acc[bomType][item.raw_material_id]) {
      acc[bomType][item.raw_material_id] = {
        rawMaterial: item.raw_materials,
        bomItem: bomItem,
        dispatches: [],
        requiredQuantity: bomItem ? bomItem.quantity * production.quantity : 0
      };
    }
    
    acc[bomType][item.raw_material_id].dispatches.push(item);
    return acc;
  }, {} as any);

  const renderMaterialSection = (sectionName: string, sectionKey: string, materials: any) => {
    const materialEntries = materials ? Object.values(materials) : [];
    
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {sectionName}
              <Badge variant="outline">{materialEntries.length} materials</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Assign to Line:</span>
              <Select
                value={lineAssignments[sectionKey] || ""}
                onValueChange={(value) => setLineAssignments(prev => ({ ...prev, [sectionKey]: value }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select Line" />
                </SelectTrigger>
                <SelectContent>
                  {productionLines.map((line) => (
                    <SelectItem key={line} value={line}>
                      {line}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {materialEntries.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No materials sent for this assembly type</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Raw Material Name</TableHead>
                  <TableHead>Required Qty</TableHead>
                  <TableHead>Total Sent</TableHead>
                  <TableHead>Total Received</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialEntries.map((materialData: any) => (
                  <EnhancedDispatchVerificationRow
                    key={materialData.rawMaterial.id}
                    materialData={materialData}
                    onVerify={(kitItemId, receivedQuantity, notes) => 
                      verifyDispatchMutation.mutate({ kitItemId, receivedQuantity, notes })
                    }
                    isProcessing={verifyDispatchMutation.isPending}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Production Voucher Details - {production?.voucher_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Voucher Information */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Product:</span>
                  <p className="font-medium">{production?.products?.name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Production Quantity:</span>
                  <p className="font-medium">{production?.quantity}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Scheduled Date:</span>
                  <p className="font-medium">{new Date(production?.scheduled_date).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Individual Dispatch Verification */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Enhanced Material Tracking - Multi-Dispatch Support</h3>
            </div>
            
            {renderMaterialSection("Sub Assembly", "sub_assembly", groupedMaterials.sub_assembly)}
            {renderMaterialSection("Main Assembly", "main_assembly", groupedMaterials.main_assembly)}
            {renderMaterialSection("Accessories", "accessory", groupedMaterials.accessory)}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              onClick={() => {
                if (Object.keys(lineAssignments).length > 0) {
                  saveLineAssignments.mutate();
                }
              }}
              disabled={saveLineAssignments.isPending}
            >
              Save Line Assignments & Start Production
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionVoucherDetailView;
