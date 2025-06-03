
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

interface ProductionVoucherDetailViewProps {
  production: any;
  isOpen: boolean;
  onClose: () => void;
}

const ProductionVoucherDetailView = ({ production, isOpen, onClose }: ProductionVoucherDetailViewProps) => {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [lineAssignments, setLineAssignments] = useState<Record<string, string>>({});
  const [showStatusSummary, setShowStatusSummary] = useState(false);
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

  // Fetch materials actually sent by store
  const { data: sentMaterials = [] } = useQuery({
    queryKey: ["sent-materials-detail", production?.id],
    queryFn: async () => {
      if (!production?.id) return [];
      
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
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!production?.id && isOpen,
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

  // Save discrepancy mutation
  const saveDiscrepancyMutation = useMutation({
    mutationFn: async (discrepancy: any) => {
      const { error } = await supabase
        .from("material_requests")
        .insert({
          production_order_id: production.id,
          raw_material_id: discrepancy.materialId,
          requested_quantity: Math.abs(discrepancy.difference),
          reason: `Discrepancy: Sent ${discrepancy.quantitySent}, Received ${discrepancy.quantityReceived}. Section: ${discrepancy.section}`,
          status: 'PENDING'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Discrepancy Logged",
        description: "Material discrepancy has been logged for Store review",
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

  // Handle save all quantities and assignments
  const handleSaveQuantities = () => {
    // Log discrepancies
    Object.entries(receivedQuantities).forEach(([materialId, quantityReceived]) => {
      const quantitySent = getQuantitySent(materialId);
      const difference = quantityReceived - quantitySent;
      
      if (difference !== 0) {
        const bomItem = bomData.find(item => item.raw_material_id === materialId);
        const section = bomItem?.bom_type?.replace('_', ' ') || 'Unknown';
        
        saveDiscrepancyMutation.mutate({
          materialId,
          quantitySent,
          quantityReceived,
          difference,
          section
        });
      }
    });

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
              const quantityReceived = receivedQuantities[item.raw_material_id] || quantitySent;
              const remainingQty = requiredQty - quantityReceived;
              const difference = quantityReceived - quantitySent;
              
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
                    />
                  </TableCell>
                  <TableCell className={remainingQty > 0 ? "text-orange-600 font-medium" : "text-green-600 font-medium"}>
                    {remainingQty}
                  </TableCell>
                  <TableCell>
                    {difference === 0 ? (
                      <Badge variant="default">Matched</Badge>
                    ) : difference > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Over +{difference}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Short {difference}
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
              <h3 className="text-lg font-semibold">Materials Sent by Store</h3>
              <Button
                variant="outline"
                onClick={() => setShowStatusSummary(true)}
                className="gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Production Status
              </Button>
            </div>
            
            {renderBOMSection("Sub Assembly", groupedBOM.sub_assembly, "sub_assembly")}
            {renderBOMSection("Main Assembly", groupedBOM.main_assembly, "main_assembly")}
            {renderBOMSection("Accessories", groupedBOM.accessory, "accessory")}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              onClick={handleSaveQuantities}
              disabled={saveDiscrepancyMutation.isPending || saveLineAssignments.isPending}
            >
              Save Quantities & Line Assignments
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
      </DialogContent>
    </Dialog>
  );
};

export default ProductionVoucherDetailView;
