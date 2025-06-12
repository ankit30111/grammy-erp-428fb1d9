
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle, Package, AlertTriangle } from "lucide-react";

interface MaterialDispatchHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productionOrderId: string;
  rawMaterialId: string;
  materialCode: string;
  materialName: string;
  requiredQuantity: number;
}

const MaterialDispatchHistoryDialog = ({
  isOpen,
  onClose,
  productionOrderId,
  rawMaterialId,
  materialCode,
  materialName,
  requiredQuantity
}: MaterialDispatchHistoryDialogProps) => {
  const [verificationData, setVerificationData] = useState<Record<string, { receivedQty: number; notes: string }>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch individual dispatch history for this material
  const { data: dispatchHistory = [], refetch } = useQuery({
    queryKey: ["material-dispatch-history", productionOrderId, rawMaterialId],
    queryFn: async () => {
      console.log("🔍 Fetching dispatch history for material:", materialCode);
      
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          id,
          actual_quantity,
          verified_by_production,
          created_at,
          kit_preparation!inner(
            production_order_id,
            created_at
          )
        `)
        .eq("kit_preparation.production_order_id", productionOrderId)
        .eq("raw_material_id", rawMaterialId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("❌ Error fetching dispatch history:", error);
        throw error;
      }

      console.log("📋 Dispatch history:", data);
      return data || [];
    },
    enabled: isOpen,
    refetchInterval: 3000, // Real-time updates
  });

  // Verify individual dispatch mutation
  const verifyDispatchMutation = useMutation({
    mutationFn: async ({ kitItemId, receivedQuantity, notes }: { kitItemId: string; receivedQuantity: number; notes: string }) => {
      console.log("🎯 Verifying individual dispatch:", { kitItemId, receivedQuantity, notes });
      
      const kitItem = dispatchHistory.find(item => item.id === kitItemId);
      if (!kitItem) throw new Error("Kit item not found");

      const sentQuantity = kitItem.actual_quantity;
      const difference = sentQuantity - receivedQuantity;

      // Update kit item verification
      const { error: updateError } = await supabase
        .from("kit_items")
        .update({
          actual_quantity: receivedQuantity,
          verified_by_production: true
        })
        .eq("id", kitItemId);

      if (updateError) throw updateError;

      // Handle inventory adjustment if needed
      if (difference !== 0) {
        if (difference > 0) {
          // Return excess to inventory
          const { data: currentInventory, error: invError } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("raw_material_id", rawMaterialId)
            .single();

          if (invError) throw invError;

          await supabase
            .from("inventory")
            .update({
              quantity: currentInventory.quantity + difference,
              last_updated: new Date().toISOString()
            })
            .eq("raw_material_id", rawMaterialId);

          // Log return movement
          await supabase
            .from("material_movements")
            .insert({
              raw_material_id: rawMaterialId,
              movement_type: "PRODUCTION_RETURN",
              quantity: difference,
              reference_id: productionOrderId,
              reference_type: "PRODUCTION_ORDER",
              reference_number: productionOrderId,
              notes: `Production verification return: ${materialCode} - Sent ${sentQuantity}, Received ${receivedQuantity}. Notes: ${notes}`
            });
        } else {
          // Log shortage request
          await supabase
            .from("material_requests")
            .insert({
              production_order_id: productionOrderId,
              raw_material_id: rawMaterialId,
              requested_quantity: Math.abs(difference),
              reason: `Production verification shortage: ${notes}`,
              status: 'PENDING'
            });
        }
      }

      return { success: true, difference };
    },
    onSuccess: () => {
      toast({
        title: "Dispatch Verified",
        description: "Individual dispatch verified and inventory adjusted"
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["production-bom-status"] });
      setVerificationData({});
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleVerificationChange = (kitItemId: string, field: 'receivedQty' | 'notes', value: string | number) => {
    setVerificationData(prev => ({
      ...prev,
      [kitItemId]: {
        ...prev[kitItemId],
        [field]: value,
        receivedQty: field === 'receivedQty' ? Number(value) : (prev[kitItemId]?.receivedQty || 0),
        notes: field === 'notes' ? String(value) : (prev[kitItemId]?.notes || '')
      }
    }));
  };

  const totalSent = dispatchHistory.reduce((sum, item) => sum + item.actual_quantity, 0);
  const totalVerified = dispatchHistory.filter(item => item.verified_by_production).reduce((sum, item) => sum + item.actual_quantity, 0);
  const remainingNeeded = Math.max(0, requiredQuantity - totalVerified);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Dispatch History: {materialCode} - {materialName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <span className="text-sm text-muted-foreground">Required</span>
              <p className="font-semibold text-lg">{requiredQuantity}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total Sent</span>
              <p className="font-semibold text-lg text-blue-600">{totalSent}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total Verified</span>
              <p className="font-semibold text-lg text-green-600">{totalVerified}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Remaining</span>
              <p className={`font-semibold text-lg ${remainingNeeded === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {remainingNeeded}
              </p>
            </div>
          </div>

          {/* Dispatch History Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispatch #</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Qty Sent</TableHead>
                  <TableHead>Qty Received</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatchHistory.map((dispatch, index) => {
                  const isVerified = dispatch.verified_by_production;
                  const sentQty = dispatch.actual_quantity;
                  const receivedQty = verificationData[dispatch.id]?.receivedQty ?? sentQty;
                  const difference = sentQty - receivedQty;
                  const notes = verificationData[dispatch.id]?.notes || '';

                  return (
                    <TableRow key={dispatch.id} className={isVerified ? "bg-green-50" : ""}>
                      <TableCell className="font-medium">#{index + 1}</TableCell>
                      <TableCell>
                        {format(new Date(dispatch.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium text-blue-600">{sentQty}</TableCell>
                      <TableCell>
                        {isVerified ? (
                          <span className="font-medium text-green-600">{sentQty}</span>
                        ) : (
                          <Input
                            type="number"
                            value={receivedQty}
                            onChange={(e) => handleVerificationChange(dispatch.id, 'receivedQty', e.target.value)}
                            className="w-20"
                            min="0"
                            max={sentQty}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {difference > 0 ? `+${difference}` : difference < 0 ? difference : '0'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isVerified ? (
                          <span className="text-sm text-muted-foreground">Verified</span>
                        ) : (
                          <Textarea
                            value={notes}
                            onChange={(e) => handleVerificationChange(dispatch.id, 'notes', e.target.value)}
                            placeholder="Add notes..."
                            className="w-32 h-8 text-xs"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {isVerified ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isVerified && (
                          <Button
                            size="sm"
                            onClick={() => verifyDispatchMutation.mutate({
                              kitItemId: dispatch.id,
                              receivedQuantity: receivedQty,
                              notes
                            })}
                            disabled={verifyDispatchMutation.isPending}
                          >
                            Verify
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {remainingNeeded === 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">
                Material requirement completed! All {requiredQuantity} units have been verified.
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialDispatchHistoryDialog;
