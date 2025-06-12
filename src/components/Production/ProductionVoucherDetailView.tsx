
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, AlertTriangle, Settings, TrendingUp } from "lucide-react";
import ProductionStatusSummary from "./ProductionStatusSummary";
import ProductionFeedbackDialog from "./ProductionFeedbackDialog";

interface ProductionVoucherDetailViewProps {
  production: any;
  isOpen: boolean;
  onClose: () => void;
}

const ProductionVoucherDetailView = ({ production, isOpen, onClose }: ProductionVoucherDetailViewProps) => {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [lineAssignments, setLineAssignments] = useState<Record<string, string>>({});
  const [showStatusSummary, setShowStatusSummary] = useState(false);
  const [showProductionFeedback, setShowProductionFeedback] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const productionLines = ["Line 1", "Line 2", "Sub Assembly 1", "Sub Assembly 2"];

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

  // Initialize received quantities from kit items
  useEffect(() => {
    if (sentMaterials.length > 0) {
      const initialQuantities: Record<string, number> = {};
      sentMaterials.forEach(item => {
        if (item.verified_by_production) {
          initialQuantities[item.raw_material_id] = item.actual_quantity || 0;
        }
      });
      setReceivedQuantities(initialQuantities);
    }
  }, [sentMaterials]);

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

  // Fetch materials actually sent by store with real-time updates
  const { data: sentMaterials = [] } = useQuery({
    queryKey: ["sent-materials-detail", production?.id],
    queryFn: async () => {
      if (!production?.id) return [];
      
      console.log("🔍 Fetching sent materials for production:", production.id);
      
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          *,
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
        .eq("kit_preparation.production_order_id", production.id);
      
      if (error) {
        console.error("❌ Error fetching sent materials:", error);
        throw error;
      }
      
      console.log("📦 Sent materials data:", data);
      return data || [];
    },
    enabled: !!production?.id && isOpen,
    refetchInterval: 3000, // Refresh every 3 seconds for real-time updates
  });

  // Group BOM items by assembly type
  const groupedBOM = {
    sub_assembly: bomData.filter(item => item.bom_type === 'sub_assembly'),
    main_assembly: bomData.filter(item => item.bom_type === 'main_assembly'),
    accessory: bomData.filter(item => item.bom_type === 'accessory')
  };

  // Get quantity sent by store for a material
  const getQuantitySent = (materialId: string) => {
    return sentMaterials
      .filter(item => item.raw_material_id === materialId)
      .reduce((sum, item) => sum + item.actual_quantity, 0);
  };

  // Get quantity actually received and verified by production
  const getQuantityReceived = (materialId: string) => {
    return sentMaterials
      .filter(item => item.raw_material_id === materialId && item.verified_by_production)
      .reduce((sum, item) => sum + item.actual_quantity, 0);
  };

  // Handle received quantity change
  const handleReceivedQuantityChange = (materialId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setReceivedQuantities(prev => ({
      ...prev,
      [materialId]: quantity
    }));
  };

  // Handle line assignment change
  const handleLineAssignmentChange = (bomType: string, line: string) => {
    setLineAssignments(prev => ({
      ...prev,
      [bomType]: line
    }));
  };

  // Enhanced save verification mutation with inventory adjustment
  const saveVerificationMutation = useMutation({
    mutationFn: async (verificationData: Array<{ materialId: string; quantitySent: number; quantityReceived: number }>) => {
      console.log("🎯 Processing production verification with inventory adjustment...");
      console.log("📋 Verification data:", verificationData);

      for (const verification of verificationData) {
        console.log(`🔄 Processing verification for material ${verification.materialId}:`);
        console.log(`   - Sent: ${verification.quantitySent}`);
        console.log(`   - Received: ${verification.quantityReceived}`);
        
        const discrepancy = verification.quantitySent - verification.quantityReceived;
        console.log(`   - Discrepancy: ${discrepancy}`);

        // Find the kit items for this material and update them
        const materialKitItems = sentMaterials.filter(item => 
          item.raw_material_id === verification.materialId && 
          !item.verified_by_production
        );

        for (const kitItem of materialKitItems) {
          const { error: kitItemError } = await supabase
            .from("kit_items")
            .update({
              actual_quantity: verification.quantityReceived,
              verified_by_production: true
            })
            .eq("id", kitItem.id);

          if (kitItemError) {
            console.error("❌ Error updating kit item:", kitItemError);
            throw kitItemError;
          }
        }

        // CRITICAL: If there's a discrepancy, adjust inventory
        if (discrepancy !== 0) {
          console.log(`🔄 Adjusting inventory for discrepancy: ${discrepancy}`);
          
          if (discrepancy > 0) {
            // Production received less than sent - return excess to inventory
            console.log(`↩️ Returning ${discrepancy} units to inventory`);
            
            const { data: currentInventory, error: invFetchError } = await supabase
              .from("inventory")
              .select("quantity")
              .eq("raw_material_id", verification.materialId)
              .single();

            if (invFetchError) {
              console.error("❌ Error fetching current inventory:", invFetchError);
              throw new Error(`Failed to fetch inventory for adjustment: ${invFetchError.message}`);
            }

            const newQuantity = currentInventory.quantity + discrepancy;
            
            const { error: invUpdateError } = await supabase
              .from("inventory")
              .update({
                quantity: newQuantity,
                last_updated: new Date().toISOString()
              })
              .eq("raw_material_id", verification.materialId);

            if (invUpdateError) {
              console.error("❌ Error updating inventory:", invUpdateError);
              throw new Error(`Failed to update inventory: ${invUpdateError.message}`);
            }

            console.log(`✅ Inventory adjusted: +${discrepancy} units returned`);

            // Log the inventory adjustment
            await supabase
              .from("material_movements")
              .insert({
                raw_material_id: verification.materialId,
                movement_type: "PRODUCTION_RETURN",
                quantity: discrepancy,
                reference_id: production.id,
                reference_type: "PRODUCTION_ORDER",
                reference_number: production.voucher_number,
                notes: `Production Verification Return: Sent ${verification.quantitySent}, Received ${verification.quantityReceived}, Returned ${discrepancy} to inventory`
              });
          }
        }

        // Log material request for any shortages
        const bomItem = bomData.find(item => item.raw_material_id === verification.materialId);
        const requiredQty = bomItem ? bomItem.quantity * production.quantity : 0;
        const shortfall = requiredQty - verification.quantityReceived;
        
        if (shortfall > 0) {
          await supabase
            .from("material_requests")
            .insert({
              production_order_id: production.id,
              raw_material_id: verification.materialId,
              requested_quantity: shortfall,
              reason: `Verification shortage: Required ${requiredQty}, Received ${verification.quantityReceived}`,
              status: 'PENDING'
            });
        }
      }

      console.log("✅ Production verification processing completed");
    },
    onSuccess: () => {
      toast({
        title: "Verification Completed",
        description: "Production verification saved and inventory adjusted for discrepancies",
      });
      queryClient.invalidateQueries({ queryKey: ["sent-materials-detail"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
    },
    onError: (error: Error) => {
      console.error("❌ Failed to save verification:", error);
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

  // Handle save verification and assignments
  const handleSaveVerification = () => {
    // Create verification data for materials with quantity changes
    const verificationData = Object.entries(receivedQuantities)
      .map(([materialId, quantityReceived]) => {
        const quantitySent = getQuantitySent(materialId);
        return {
          materialId,
          quantitySent,
          quantityReceived
        };
      })
      .filter(v => v.quantitySent > 0); // Only process materials that were actually sent

    if (verificationData.length > 0) {
      console.log("💾 Saving production verification:", verificationData);
      saveVerificationMutation.mutate(verificationData);
    }

    // Save line assignments if any
    if (Object.keys(lineAssignments).length > 0) {
      saveLineAssignments.mutate();
    }
  };

  const renderBOMSection = (sectionName: string, items: any[], sectionKey: string) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {sectionName}
            <Badge variant="outline">{items.length} items</Badge>
          </div>
          
          {/* Line Assignment Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Assign to Line:</span>
            <Select
              value={lineAssignments[sectionKey] || ""}
              onValueChange={(value) => handleLineAssignmentChange(sectionKey, value)}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material Code</TableHead>
              <TableHead>Raw Material Name</TableHead>
              <TableHead>Required Qty</TableHead>
              <TableHead>Qty Sent by Store</TableHead>
              <TableHead>Qty Received by Production</TableHead>
              <TableHead>Remaining Qty</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const requiredQty = item.quantity * production.quantity;
              const quantitySent = getQuantitySent(item.raw_material_id);
              const quantityReceived = receivedQuantities[item.raw_material_id] !== undefined 
                ? receivedQuantities[item.raw_material_id] 
                : getQuantityReceived(item.raw_material_id);
              const remainingQty = requiredQty - quantityReceived;
              const difference = quantitySent - quantityReceived;
              const isVerified = sentMaterials.some(m => 
                m.raw_material_id === item.raw_material_id && m.verified_by_production
              );
              
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.raw_materials.material_code}</TableCell>
                  <TableCell>{item.raw_materials.name}</TableCell>
                  <TableCell className="font-medium">{requiredQty}</TableCell>
                  <TableCell className="font-medium text-blue-600">{quantitySent}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={quantityReceived}
                      onChange={(e) => handleReceivedQuantityChange(item.raw_material_id, e.target.value)}
                      className="w-24"
                      disabled={isVerified}
                      max={quantitySent}
                      min="0"
                    />
                    {difference > 0 && !isVerified && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {difference} will return to inventory
                      </div>
                    )}
                  </TableCell>
                  <TableCell className={remainingQty > 0 ? "text-orange-600 font-medium" : "text-green-600 font-medium"}>
                    {remainingQty}
                  </TableCell>
                  <TableCell>
                    {isVerified ? (
                      <Badge variant="default">Verified</Badge>
                    ) : difference === 0 ? (
                      <Badge variant="default">Matched</Badge>
                    ) : difference > 0 ? (
                      <Badge variant="warning" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Return +{difference}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Short {Math.abs(difference)}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No materials sent for this assembly type
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

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

          {/* Materials Sent by Store - Grouped by Assembly Type */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Materials Sent by Store - Production Verification</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowProductionFeedback(true)}
                  className="gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Production Feedback
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowStatusSummary(true)}
                  className="gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Production Status
                </Button>
              </div>
            </div>
            
            {renderBOMSection("Sub Assembly", groupedBOM.sub_assembly, "sub_assembly")}
            {renderBOMSection("Main Assembly", groupedBOM.main_assembly, "main_assembly")}
            {renderBOMSection("Accessories", groupedBOM.accessory, "accessory")}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              onClick={handleSaveVerification}
              disabled={saveVerificationMutation.isPending || saveLineAssignments.isPending}
            >
              Save Verification & Line Assignments
            </Button>
          </div>
        </div>

        {/* Production Status Summary Dialog */}
        {showStatusSummary && (
          <ProductionStatusSummary
            productionId={production.id}
            voucherNumber={production.voucher_number}
            isOpen={showStatusSummary}
            onClose={() => setShowStatusSummary(false)}
          />
        )}

        {/* Production Feedback Dialog */}
        {showProductionFeedback && (
          <ProductionFeedbackDialog
            productionOrderId={production.id}
            voucherNumber={production.voucher_number}
            isOpen={showProductionFeedback}
            onClose={() => setShowProductionFeedback(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProductionVoucherDetailView;
