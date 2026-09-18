
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
import { useProductionLinesList } from "@/hooks/useProductionLinesList";
import {
  finishedGoodLine,
  replaceProductionOrderLines,
  useProductionOrderLinesForOrder,
} from "@/hooks/useProductionOrderLines";

interface ProductionVoucherDetailViewProps {
  production: any;
  isOpen: boolean;
  onClose: () => void;
}

const ProductionVoucherDetailView = ({ production, isOpen, onClose }: ProductionVoucherDetailViewProps) => {
  const [lineAssignments, setLineAssignments] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { rows: productionLines } = useProductionLinesList();
  const { data: existingLineRows } = useProductionOrderLinesForOrder(production?.id, isOpen);

  // Fetch BOM data for the product
  const { data: bomData = [] } = useQuery({
    queryKey: ["production-bom", production?.id],
    queryFn: async () => {
      if (!production?.part_id) return [];
      
      const { data, error } = await supabase
        .from("bom")
        .select(`
          *,
          parts!child_part_id(
            id,
            part_code,
            name,
            category
          )
        `)
        .eq("parent_part_id", production.part_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!production?.part_id && isOpen,
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
          part_id,
          received_quantity,
          created_at,
          parts!inner(
            id,
            part_code,
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

  // Initialize the line choice from production_order_lines. The finished-good row
  // (part_id IS NULL) is the voucher's line; the key is "materials" to match the
  // single section the dialog now renders.
  useEffect(() => {
    const finishedGood = finishedGoodLine(existingLineRows);
    setLineAssignments(
      finishedGood ? { materials: finishedGood.production_line_id } : {}
    );
  }, [existingLineRows]);

  // ENHANCED: Individual dispatch verification mutation with discrepancy handling
  const verifyDispatchMutation = useMutation({
    mutationFn: async ({ kitItemId, receivedQuantity, notes }: { kitItemId: string; receivedQuantity: number; notes: string }) => {
      console.log("🎯 PROCESSING INDIVIDUAL DISPATCH VERIFICATION WITH DISCREPANCY HANDLING...");
      
      // Get the kit item details
      const kitItem = sentMaterials.find(item => item.id === kitItemId);
      if (!kitItem) {
        throw new Error("Kit item not found");
      }

      const sentQuantity = kitItem.received_quantity;
      const difference = sentQuantity - receivedQuantity;
      
      console.log(`📋 Verification details:`);
      console.log(`   - Kit Item ID: ${kitItemId}`);
      console.log(`   - Material: ${kitItem.parts.part_code}`);
      console.log(`   - Sent: ${sentQuantity}`);
      console.log(`   - Received: ${receivedQuantity}`);
      console.log(`   - Difference: ${difference}`);

      // production_material_discrepancies was dropped in the database rebuild
      // and has NO replacement, so a quantity dispute can no longer be recorded
      // for store review. Refuse the verification rather than silently swallow
      // the difference or pretend it was filed.
      if (difference !== 0) {
        throw new Error(
          `Quantity mismatch (sent ${sentQuantity}, received ${receivedQuantity}). ` +
          `Discrepancy reporting is not available after the database rebuild — ` +
          `the production_material_discrepancies table was removed with no replacement. ` +
          `Please resolve the count with the store before verifying.`
        );
      } else {
        // No discrepancy - proceed with normal verification
        console.log(`✅ NO DISCREPANCY - Processing normal verification`);
        
        const { error: kitUpdateError } = await supabase
          .from("kit_items")
          .update({
            // Recording a received quantity IS production confirming the kit.
            // verified_by_production was a second column saying the same thing.
            received_quantity: receivedQuantity
          })
          .eq("id", kitItemId);

        if (kitUpdateError) {
          console.error("❌ Error updating kit item:", kitUpdateError);
          throw new Error(`Failed to verify dispatch: ${kitUpdateError.message}`);
        }
      }

      console.log("✅ INDIVIDUAL DISPATCH VERIFICATION COMPLETED");
    },
    onSuccess: () => {
      toast({
        title: "Dispatch Verified",
        description: "Dispatch verified successfully. Any discrepancies sent to store for review.",
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

  // Save line assignments mutation - Updated to change status to IN_PRODUCTION
  const saveLineAssignments = useMutation({
    mutationFn: async () => {
      console.log("🏭 Saving line assignments:", lineAssignments);

      // The voucher runs on one line. This used to fan out over three BOM-type
      // sections, assigning a line per section; with bom_type gone there is one
      // materials list and one choice, and the row carries part_id null because
      // what runs on the line is the finished good.
      const lineId = lineAssignments.materials;
      const rows: { production_line_id: string; part_id: string | null }[] = lineId
        ? [{ production_line_id: lineId, part_id: null }]
        : [];

      if (rows.length === 0) {
        throw new Error("Choose a production line before starting production");
      }

      await replaceProductionOrderLines(production.id, rows);

      // Change status to make it appear in production lines
      const { error } = await supabase
        .from("production_orders")
        .update({
          status: 'IN_PRODUCTION',
          updated_at: new Date().toISOString()
        })
        .eq("id", production.id);
      
      if (error) {
        console.error("❌ Error updating production order:", error);
        throw error;
      }
      
      console.log("✅ Line assignments saved and status updated to IN_PRODUCTION");
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
      queryClient.invalidateQueries({ queryKey: ["production-order-lines"] });
    },
  });

  // ENHANCED: Group ALL BOM materials by category first, then merge dispatch data
  const groupedMaterials = bomData.reduce((acc, bomItem) => {
    const bomType = 'materials';
    
    if (!acc[bomType]) {
      acc[bomType] = {};
    }
    
    // Initialize with BOM data and empty dispatches
    acc[bomType][bomItem.child_part_id] = {
      rawMaterial: bomItem.parts,
      bomItem: bomItem,
      dispatches: [],
      requiredQuantity: bomItem.quantity * production.quantity
    };
    
    return acc;
  }, {} as any);

  // Now merge dispatch data for materials that have been sent
  sentMaterials.forEach(item => {
    const bomItem = bomData.find(b => b.child_part_id === item.part_id);
    const bomType = 'materials';
    
    if (groupedMaterials[bomType] && groupedMaterials[bomType][item.part_id]) {
      groupedMaterials[bomType][item.part_id].dispatches.push(item);
    }
  });

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
                    <SelectItem key={line.id} value={line.id}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {materialEntries.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No materials found for this assembly type</p>
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
                  <p className="font-medium">{production?.parts?.name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Production Quantity:</span>
                  <p className="font-medium">{production?.quantity}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Scheduled Date:</span>
                  <p className="font-medium">{new Date(production?.planned_date).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Complete BOM Display with Multi-Dispatch Support */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Complete BOM - Enhanced Material Tracking with Discrepancy Management</h3>
            </div>
            
            {/*
              Three sections used to be rendered here - Sub Assembly, Main Assembly,
              Accessories - keyed on bom.bom_type. That column was dropped in the
              rebuild, and the grouping above had already been changed to put every
              BOM line in one "materials" bucket. The render was left on the three
              old keys, so all three read groupedMaterials.sub_assembly and friends,
              found nothing, and every section showed "0 MATERIALS / No materials
              found for this assembly type" on a voucher with 54 BOM lines.
            */}
            {renderMaterialSection("Materials", "materials", groupedMaterials.materials)}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              onClick={() => {
                if (lineAssignments.materials) {
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
