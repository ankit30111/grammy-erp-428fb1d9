
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Package, AlertTriangle, MessageSquare } from "lucide-react";

interface DispatchReceiptProps {
  productionOrderId: string;
  voucherNumber: string;
}

const EnhancedDispatchReceiptHandler = ({ productionOrderId, voucherNumber }: DispatchReceiptProps) => {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch kit items sent by store
  const { data: kitItems = [] } = useQuery({
    queryKey: ["kit-items-for-receipt", productionOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          *,
          raw_materials!raw_material_id (
            id,
            material_code,
            name,
            category
          ),
          kit_preparation!kit_preparation_id (
            production_order_id,
            kit_number,
            created_at
          )
        `)
        .eq("kit_preparation.production_order_id", productionOrderId)
        .eq("verified_by_production", false);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionOrderId,
    refetchInterval: 3000,
  });

  // Mutation to record material receipt with discrepancy detection
  const recordReceiptMutation = useMutation({
    mutationFn: async ({ 
      kitItemId, 
      rawMaterialId, 
      sentQuantity, 
      receivedQuantity, 
      notes 
    }: {
      kitItemId: string;
      rawMaterialId: string;
      sentQuantity: number;
      receivedQuantity: number;
      notes: string;
    }) => {
      console.log("📦 RECORDING MATERIAL RECEIPT WITH ENHANCED DISCREPANCY DETECTION");
      console.log({
        productionOrderId,
        rawMaterialId,
        sentQuantity,
        receivedQuantity,
        difference: sentQuantity - receivedQuantity
      });

      // Call the new database function to handle receipt with discrepancy detection
      const { data, error } = await supabase.rpc('log_production_receipt_with_discrepancy', {
        p_production_order_id: productionOrderId,
        p_raw_material_id: rawMaterialId,
        p_sent_quantity: sentQuantity,
        p_received_quantity: receivedQuantity,
        p_received_by: (await supabase.auth.getUser()).data.user?.id,
        p_notes: notes
      });

      if (error) {
        console.error("❌ Error recording receipt:", error);
        throw error;
      }

      // Update kit item verification status
      const { error: kitUpdateError } = await supabase
        .from("kit_items")
        .update({
          verified_by_production: true,
          actual_quantity: receivedQuantity
        })
        .eq("id", kitItemId);

      if (kitUpdateError) {
        console.error("❌ Error updating kit item:", kitUpdateError);
        throw kitUpdateError;
      }

      console.log("✅ MATERIAL RECEIPT RECORDED WITH DISCREPANCY HANDLING");
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Material Receipt Recorded",
        description: "Material receipt recorded with automatic discrepancy detection",
      });
      
      queryClient.invalidateQueries({ queryKey: ["kit-items-for-receipt"] });
      queryClient.invalidateQueries({ queryKey: ["production-discrepancies"] });
      queryClient.invalidateQueries({ queryKey: ["production-material-receipts"] });
      
      setShowReceiptDialog(false);
      setSelectedMaterial(null);
      setReceivedQuantities({});
      setNotes({});
    },
    onError: (error: Error) => {
      toast({
        title: "Receipt Recording Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRecordReceipt = (material: any) => {
    const receivedQty = receivedQuantities[material.id] || 0;
    const materialNotes = notes[material.id] || "";
    
    if (receivedQty <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid received quantity",
        variant: "destructive",
      });
      return;
    }

    setSelectedMaterial(material);
    setShowReceiptDialog(true);
  };

  const confirmReceipt = () => {
    if (!selectedMaterial) return;
    
    const receivedQty = receivedQuantities[selectedMaterial.id] || 0;
    const materialNotes = notes[selectedMaterial.id] || "";
    
    recordReceiptMutation.mutate({
      kitItemId: selectedMaterial.id,
      rawMaterialId: selectedMaterial.raw_material_id,
      sentQuantity: selectedMaterial.actual_quantity,
      receivedQuantity: receivedQty,
      notes: materialNotes
    });
  };

  if (kitItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material Receipt - {voucherNumber}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
            <p>No materials pending receipt verification</p>
            <p className="text-sm mt-1">Materials sent by store will appear here for verification</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material Receipt Verification - {voucherNumber}
            <Badge variant="outline">{kitItems.length} items pending</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Enhanced Discrepancy Detection</h4>
              <p className="text-sm text-blue-700">
                When you enter received quantities that differ from sent quantities, the system will automatically 
                log discrepancies for store review and resolution. This ensures full accountability for all material movements.
              </p>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Sent by Store</TableHead>
                  <TableHead>Received by Production</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kitItems.map((kitItem) => (
                  <TableRow key={kitItem.id}>
                    <TableCell className="font-mono font-medium">
                      {kitItem.raw_materials?.material_code}
                    </TableCell>
                    <TableCell>{kitItem.raw_materials?.name}</TableCell>
                    <TableCell className="font-medium text-blue-600">
                      {kitItem.actual_quantity}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={receivedQuantities[kitItem.id] || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setReceivedQuantities(prev => ({
                            ...prev,
                            [kitItem.id]: value
                          }));
                        }}
                        className="w-24"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={notes[kitItem.id] || ''}
                        onChange={(e) => {
                          setNotes(prev => ({
                            ...prev,
                            [kitItem.id]: e.target.value
                          }));
                        }}
                        placeholder="Optional notes..."
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRecordReceipt(kitItem)}
                        disabled={!receivedQuantities[kitItem.id] || recordReceiptMutation.isPending}
                        className="gap-1"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Record Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Confirmation Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Confirm Material Receipt
            </DialogTitle>
          </DialogHeader>
          
          {selectedMaterial && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <span className="text-sm text-muted-foreground">Material:</span>
                  <p className="font-medium">{selectedMaterial.raw_materials?.material_code}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Material Name:</span>
                  <p className="font-medium">{selectedMaterial.raw_materials?.name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Sent Quantity:</span>
                  <p className="font-medium text-blue-600">{selectedMaterial.actual_quantity}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Received Quantity:</span>
                  <p className="font-medium text-green-600">{receivedQuantities[selectedMaterial.id] || 0}</p>
                </div>
              </div>

              {receivedQuantities[selectedMaterial.id] !== selectedMaterial.actual_quantity && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <h4 className="font-medium text-yellow-800">Quantity Mismatch Detected</h4>
                  </div>
                  <p className="text-sm text-yellow-700">
                    This discrepancy will be automatically logged for store review and resolution. 
                    The store team will be able to approve or reject this discrepancy.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowReceiptDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmReceipt}
                  disabled={recordReceiptMutation.isPending}
                >
                  {recordReceiptMutation.isPending ? (
                    "Recording..."
                  ) : (
                    "Confirm Receipt"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EnhancedDispatchReceiptHandler;
