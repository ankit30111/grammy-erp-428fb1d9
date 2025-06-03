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
import { Package, AlertTriangle, Settings } from "lucide-react";

interface ProductionVoucherDetailViewProps {
  production: any;
  isOpen: boolean;
  onClose: () => void;
}

const ProductionVoucherDetailView = ({ production, isOpen, onClose }: ProductionVoucherDetailViewProps) => {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Fetch materials actually sent by store (from kit_items table)
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

  // Group BOM items by type - using lowercase keys to match database enum
  const groupedBOM = {
    main_assembly: bomData.filter(item => item.bom_type === 'main_assembly'),
    sub_assembly: bomData.filter(item => item.bom_type === 'sub_assembly'),
    accessory: bomData.filter(item => item.bom_type === 'accessory')
  };

  // Get quantity sent by store for a material from actual kit_items
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

  // Handle save all quantities
  const handleSaveQuantities = () => {
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
  };

  const renderBOMSection = (sectionName: string, items: any[], sectionKey: string) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {sectionName}
          <Badge variant="outline">{items.length} items</Badge>
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
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const requiredQty = item.quantity * production.quantity;
              const quantitySent = getQuantitySent(item.raw_material_id);
              const quantityReceived = receivedQuantities[item.raw_material_id] || quantitySent;
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
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
            <h3 className="text-lg font-semibold">Materials Sent by Store</h3>
            {renderBOMSection("Main Assembly", groupedBOM.main_assembly, "main_assembly")}
            {renderBOMSection("Sub Assembly", groupedBOM.sub_assembly, "sub_assembly")}
            {renderBOMSection("Accessory", groupedBOM.accessory, "accessory")}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              onClick={handleSaveQuantities}
              disabled={saveDiscrepancyMutation.isPending}
            >
              Save Quantities & Log Discrepancies
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionVoucherDetailView;
