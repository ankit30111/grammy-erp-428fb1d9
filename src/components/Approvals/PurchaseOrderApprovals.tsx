
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Edit, Eye, Package, X } from "lucide-react";
import { useState } from "react";
import { usePurchaseOrders, useUpdatePOStatus } from "@/hooks/usePurchaseOrders";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const PurchaseOrderApprovals = () => {
  const { data: purchaseOrders = [], isLoading } = usePurchaseOrders();
  const [editingPO, setEditingPO] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<Record<string, number>>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter for pending POs only
  const pendingPOs = purchaseOrders.filter(po => po.status === 'PENDING');

  const updatePOItemsMutation = useMutation({
    mutationFn: async ({ poId, items }: { poId: string; items: Record<string, number> }) => {
      // Update each purchase order item with new quantities
      const updates = Object.entries(items).map(([itemId, quantity]) => {
        return supabase
          .from('purchase_order_items')
          .update({ quantity })
          .eq('id', itemId);
      });

      await Promise.all(updates);

      // Recalculate total amount
      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select('quantity, unit_price')
        .eq('purchase_order_id', poId);

      if (poItems) {
        const totalAmount = poItems.reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0);
        
        await supabase
          .from('purchase_orders')
          .update({ total_amount: totalAmount })
          .eq('id', poId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast({
        title: "Success",
        description: "Purchase order quantities updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating PO items:', error);
      toast({
        title: "Error",
        description: "Failed to update purchase order quantities",
        variant: "destructive",
      });
    },
  });

  const approvePOMutation = useMutation({
    mutationFn: async (poId: string) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'APPROVED' })
        .eq('id', poId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      toast({
        title: "PO Approved",
        description: "Purchase order has been approved and is now available for GRN creation",
      });
    },
    onError: (error) => {
      console.error('Error approving PO:', error);
      toast({
        title: "Error",
        description: "Failed to approve purchase order",
        variant: "destructive",
      });
    },
  });

  const handleEditQuantities = (po: any) => {
    setEditingPO(po.id);
    const quantities: Record<string, number> = {};
    po.purchase_order_items?.forEach((item: any) => {
      quantities[item.id] = item.quantity;
    });
    setEditingItems(quantities);
    setEditDialogOpen(true);
  };

  const handleSaveQuantities = async () => {
    if (!editingPO) return;

    await updatePOItemsMutation.mutateAsync({
      poId: editingPO,
      items: editingItems
    });

    setEditDialogOpen(false);
    setEditingPO(null);
    setEditingItems({});
  };

  const handleApprovePO = async (poId: string) => {
    await approvePOMutation.mutateAsync(poId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-muted-foreground">Loading purchase orders...</div>
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
            Purchase Order Approvals
            {pendingPOs.length > 0 && (
              <Badge variant="secondary">{pendingPOs.length} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingPOs.length > 0 ? (
            <div className="space-y-4">
              {pendingPOs.map((po) => (
                <Card key={po.id} className="border-l-4 border-l-orange-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <h3 className="font-semibold">{po.po_number}</h3>
                          <p className="text-sm text-muted-foreground">
                            Vendor: {po.vendors?.name}
                          </p>
                        </div>
                        <Badge variant="warning">Pending Approval</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditQuantities(po)}
                          className="gap-1"
                        >
                          <Edit className="h-4 w-4" />
                          Edit Quantities
                        </Button>
                        <Button
                          onClick={() => handleApprovePO(po.id)}
                          disabled={approvePOMutation.isPending}
                          className="gap-1"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {approvePOMutation.isPending ? "Approving..." : "Approve"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Amount</p>
                        <p className="font-medium">₹{po.total_amount?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Items</p>
                        <p className="font-medium">{po.purchase_order_items?.length || 0} items</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Expected Delivery</p>
                        <p className="font-medium">
                          {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {new Date(po.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {po.purchase_order_items && po.purchase_order_items.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Items:</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Material Code</TableHead>
                              <TableHead>Material Name</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>Total Price</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {po.purchase_order_items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-mono">
                                  {item.raw_materials?.material_code}
                                </TableCell>
                                <TableCell>{item.raw_materials?.name}</TableCell>
                                <TableCell className="font-medium">{item.quantity}</TableCell>
                                <TableCell>₹{item.unit_price?.toFixed(2) || '0.00'}</TableCell>
                                <TableCell>₹{(item.quantity * (item.unit_price || 0)).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">All Purchase Orders Approved</h3>
              <p className="text-muted-foreground">
                No purchase orders are currently pending approval.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Quantities Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Edit Quantities - {pendingPOs.find(po => po.id === editingPO)?.po_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingPO && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Current Quantity</TableHead>
                    <TableHead>New Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPOs
                    .find(po => po.id === editingPO)
                    ?.purchase_order_items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">
                        {item.raw_materials?.material_code}
                      </TableCell>
                      <TableCell>{item.raw_materials?.name}</TableCell>
                      <TableCell className="font-medium">{item.quantity}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={editingItems[item.id] || item.quantity}
                          onChange={(e) => setEditingItems(prev => ({
                            ...prev,
                            [item.id]: parseInt(e.target.value) || 0
                          }))}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>₹{item.unit_price?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>
                        ₹{((editingItems[item.id] || item.quantity) * (item.unit_price || 0)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setEditDialogOpen(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleSaveQuantities}
                disabled={updatePOItemsMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {updatePOItemsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PurchaseOrderApprovals;
