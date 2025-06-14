import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, X, Package, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ProductionFeedbackTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [actionType, setActionType] = useState<'ACCEPT' | 'REJECT'>('ACCEPT');

  // Fetch pending production material discrepancies
  const { data: discrepancies = [], isLoading } = useQuery({
    queryKey: ["production-material-discrepancies"],
    queryFn: async () => {
      console.log("🔍 Fetching production material discrepancies...");
      
      const { data, error } = await supabase
        .from("production_material_discrepancies")
        .select(`
          *,
          production_orders!inner(
            id,
            voucher_number,
            products!inner(
              name
            )
          ),
          raw_materials!inner(
            id,
            material_code,
            name,
            category
          )
        `)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching discrepancies:", error);
        throw error;
      }

      console.log("📋 Production discrepancies:", data);
      return data || [];
    },
    refetchInterval: 5000, // Real-time updates
  });

  // Resolve discrepancy mutation
  const resolveDiscrepancyMutation = useMutation({
    mutationFn: async ({ discrepancyId, action, notes }: { discrepancyId: string; action: 'ACCEPT' | 'REJECT'; notes: string }) => {
      console.log(`🎯 RESOLVING DISCREPANCY: ${action}`, { discrepancyId, notes });
      
      const discrepancy = discrepancies.find(d => d.id === discrepancyId);
      if (!discrepancy) throw new Error("Discrepancy not found");

      // Update discrepancy status
      const { error: updateError } = await supabase
        .from("production_material_discrepancies")
        .update({
          status: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
          resolved_at: new Date().toISOString(),
          resolution_notes: notes
        })
        .eq("id", discrepancyId);

      if (updateError) {
        console.error("❌ Error updating discrepancy:", updateError);
        throw new Error(`Failed to update discrepancy: ${updateError.message}`);
      }

      if (action === 'ACCEPT') {
        // Accept production quantity - update kit item and adjust inventory
        console.log("✅ ACCEPTING PRODUCTION QUANTITY");
        
        // Update kit item with production verified quantity
        const { error: kitError } = await supabase
          .from("kit_items")
          .update({
            actual_quantity: discrepancy.received_quantity
          })
          .eq("id", discrepancy.kit_item_id);

        if (kitError) {
          console.error("❌ Error updating kit item:", kitError);
          throw new Error(`Failed to update kit item: ${kitError.message}`);
        }

        // If production received less (shortage), return excess to inventory
        if (discrepancy.discrepancy_type === 'SHORTAGE') {
          const { data: currentInventory, error: invError } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("raw_material_id", discrepancy.raw_material_id)
            .single();

          if (invError) {
            console.error("❌ Error fetching inventory:", invError);
            throw new Error(`Failed to fetch inventory: ${invError.message}`);
          }

          const returnQuantity = discrepancy.discrepancy_quantity;
          const newQuantity = currentInventory.quantity + returnQuantity;

          const { error: invUpdateError } = await supabase
            .from("inventory")
            .update({
              quantity: newQuantity,
              last_updated: new Date().toISOString()
            })
            .eq("raw_material_id", discrepancy.raw_material_id);

          if (invUpdateError) {
            console.error("❌ Error updating inventory:", invUpdateError);
            throw new Error(`Failed to update inventory: ${invUpdateError.message}`);
          }

          // Auto-log the return movement with proper reference
          const { error: logError } = await supabase.rpc('log_material_movement', {
            p_raw_material_id: discrepancy.raw_material_id,
            p_movement_type: 'PRODUCTION_FEEDBACK_RETURN',
            p_quantity: returnQuantity,
            p_reference_id: discrepancy.production_order_id,
            p_reference_type: 'PRODUCTION_DISCREPANCY',
            p_reference_number: discrepancy.production_orders.voucher_number,
            p_notes: `Store accepted production shortage discrepancy. Returned ${returnQuantity} units to inventory. ${notes}`
          });

          if (logError) {
            console.error("❌ Error logging discrepancy return:", logError);
          }

          console.log(`📦 RETURNED ${returnQuantity} UNITS TO INVENTORY`);
        }

      } else {
        // Reject production quantity - keep store quantity as correct
        console.log("❌ REJECTING PRODUCTION QUANTITY - KEEPING STORE QUANTITY");
        
        // Keep original sent quantity in kit item (no inventory adjustment needed)
        const { error: kitError } = await supabase
          .from("kit_items")
          .update({
            actual_quantity: discrepancy.sent_quantity
          })
          .eq("id", discrepancy.kit_item_id);

        if (kitError) {
          console.error("❌ Error updating kit item:", kitError);
          throw new Error(`Failed to update kit item: ${kitError.message}`);
        }

        // Auto-log the rejection with proper reference
        const { error: logError } = await supabase.rpc('log_material_movement', {
          p_raw_material_id: discrepancy.raw_material_id,
          p_movement_type: 'PRODUCTION_DISCREPANCY_REJECTED',
          p_quantity: discrepancy.discrepancy_quantity,
          p_reference_id: discrepancy.production_order_id,
          p_reference_type: 'PRODUCTION_DISCREPANCY',
          p_reference_number: discrepancy.production_orders.voucher_number,
          p_notes: `Store rejected production discrepancy. Maintained store sent quantity of ${discrepancy.sent_quantity}. ${notes}`
        });

        if (logError) {
          console.error("❌ Error logging discrepancy rejection:", logError);
        }
      }

      console.log(`✅ DISCREPANCY ${action} COMPLETED`);
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Discrepancy Resolved",
        description: `Production discrepancy ${variables.action.toLowerCase()}ed successfully`,
      });
      
      // Refresh related queries
      queryClient.invalidateQueries({ queryKey: ["production-material-discrepancies"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      
      // Close dialog and reset state
      setShowResolutionDialog(false);
      setSelectedDiscrepancy(null);
      setResolutionNotes("");
    },
    onError: (error: Error) => {
      console.error("❌ Failed to resolve discrepancy:", error);
      toast({
        title: "Resolution Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleResolveDiscrepancy = (discrepancy: any, action: 'ACCEPT' | 'REJECT') => {
    setSelectedDiscrepancy(discrepancy);
    setActionType(action);
    setShowResolutionDialog(true);
  };

  const confirmResolution = () => {
    if (!selectedDiscrepancy) return;
    
    resolveDiscrepancyMutation.mutate({
      discrepancyId: selectedDiscrepancy.id,
      action: actionType,
      notes: resolutionNotes
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Loading production feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Production Material Discrepancies ({discrepancies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {discrepancies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p className="font-medium">No pending discrepancies</p>
              <p className="text-sm mt-1">All production quantities match store dispatches</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Quantities</TableHead>
                  <TableHead>Discrepancy</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discrepancies.map((discrepancy) => (
                  <TableRow key={discrepancy.id}>
                    <TableCell className="font-medium">
                      {discrepancy.production_orders.voucher_number}
                    </TableCell>
                    <TableCell>
                      {discrepancy.production_orders.products.name}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{discrepancy.raw_materials.material_code}</p>
                        <p className="text-sm text-muted-foreground">{discrepancy.raw_materials.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Store Sent:</span>
                          <span className="font-medium text-blue-600">{discrepancy.sent_quantity}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Production Received:</span>
                          <span className="font-medium text-orange-600">{discrepancy.received_quantity}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={discrepancy.discrepancy_type === 'SHORTAGE' ? 'destructive' : 'secondary'}>
                          {discrepancy.discrepancy_type}
                        </Badge>
                        <span className="font-medium">{discrepancy.discrepancy_quantity}</span>
                      </div>
                      {discrepancy.reason && (
                        <p className="text-xs text-muted-foreground mt-1">{discrepancy.reason}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{format(new Date(discrepancy.created_at), "MMM dd, HH:mm")}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveDiscrepancy(discrepancy, 'ACCEPT')}
                          className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Accept Production
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveDiscrepancy(discrepancy, 'REJECT')}
                          className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="h-3 w-3" />
                          Reject (Keep Store)
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resolution Confirmation Dialog */}
      <Dialog open={showResolutionDialog} onOpenChange={setShowResolutionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              {actionType === 'ACCEPT' ? 'Accept Production Quantity' : 'Reject Production Quantity'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDiscrepancy && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Discrepancy Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Material:</span> {selectedDiscrepancy.raw_materials.material_code}
                  </div>
                  <div>
                    <span className="font-medium">Voucher:</span> {selectedDiscrepancy.production_orders.voucher_number}
                  </div>
                  <div>
                    <span className="font-medium">Store Sent:</span> 
                    <span className="ml-1 text-blue-600 font-medium">{selectedDiscrepancy.sent_quantity}</span>
                  </div>
                  <div>
                    <span className="font-medium">Production Received:</span> 
                    <span className="ml-1 text-orange-600 font-medium">{selectedDiscrepancy.received_quantity}</span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${actionType === 'ACCEPT' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  {actionType === 'ACCEPT' ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Accept Production Quantity
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 text-red-600" />
                      Reject Production Quantity
                    </>
                  )}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {actionType === 'ACCEPT' ? (
                    selectedDiscrepancy.discrepancy_type === 'SHORTAGE' ? (
                      `This will return ${selectedDiscrepancy.discrepancy_quantity} units back to inventory and update the kit item to ${selectedDiscrepancy.received_quantity} units.`
                    ) : (
                      `This will keep the production verified quantity of ${selectedDiscrepancy.received_quantity} units.`
                    )
                  ) : (
                    `This will maintain the store sent quantity of ${selectedDiscrepancy.sent_quantity} units with no inventory adjustment.`
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Resolution Notes</label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add notes about this resolution..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowResolutionDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmResolution}
                  disabled={resolveDiscrepancyMutation.isPending}
                  className={actionType === 'ACCEPT' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                >
                  {resolveDiscrepancyMutation.isPending ? "Processing..." : `Confirm ${actionType === 'ACCEPT' ? 'Accept' : 'Reject'}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductionFeedbackTab;
