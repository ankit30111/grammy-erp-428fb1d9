import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Package, Edit, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name: string;
  total_amount: number;
  po_date: string;
  expected_delivery_date: string | null;
  status: string;
  items_count: number;
  created_by_name: string | null;
  has_existing_workflow?: boolean;
}

interface POItem {
  id: string;
  raw_material_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

const PurchaseOrderApprovalsEnhanced = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [editingItems, setEditingItems] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingPOs();
  }, []);

  const fetchPendingPOs = async () => {
    try {
      // Fetch purchase orders with existing workflow status
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          total_amount,
          po_date,
          expected_delivery_date,
          status,
          vendors:vendor_id (name),
          purchase_order_items (id)
        `)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check for existing workflows for these POs
      const poIds = data?.map(po => po.id) || [];
      const { data: workflowData } = await supabase
        .from('approval_workflows')
        .select('reference_id, status')
        .eq('workflow_type', 'PURCHASE_ORDER')
        .in('reference_id', poIds);

      const workflowMap = new Map(workflowData?.map(w => [w.reference_id, w.status]) || []);

      const formattedData = data?.map(po => ({
        id: po.id,
        po_number: po.po_number,
        vendor_name: po.vendors?.name || 'Unknown Vendor',
        total_amount: po.total_amount || 0,
        po_date: po.po_date,
        expected_delivery_date: po.expected_delivery_date,
        status: po.status,
        items_count: po.purchase_order_items?.length || 0,
        created_by_name: null,
        has_existing_workflow: workflowMap.has(po.id)
      })) || [];

      setPurchaseOrders(formattedData);
    } catch (error) {
      console.error('Error fetching pending POs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch pending purchase orders",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPOItems = async (poId: string) => {
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          raw_materials:raw_material_id (name)
        `)
        .eq('purchase_order_id', poId);

      if (error) throw error;

      const formattedItems = data?.map(item => ({
        id: item.id,
        raw_material_name: item.raw_materials?.name || 'Unknown Material',
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        total_price: item.total_price || 0
      })) || [];

      setPOItems(formattedItems);
    } catch (error) {
      console.error('Error fetching PO items:', error);
      toast({
        title: "Error",
        description: "Failed to fetch purchase order items",
        variant: "destructive"
      });
    }
  };

  const checkExistingWorkflow = async (poId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('approval_workflows')
      .select('id')
      .eq('workflow_type', 'PURCHASE_ORDER')
      .eq('reference_id', poId)
      .single();
    
    return !!data;
  };

  const handlePOAction = async () => {
    if (!selectedPO || !actionType || processingAction) return;

    // Validation
    if (actionType === 'reject' && !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive"
      });
      return;
    }

    setProcessingAction(true);

    try {
      // Check for existing workflow
      const hasExistingWorkflow = await checkExistingWorkflow(selectedPO.id);
      if (hasExistingWorkflow) {
        toast({
          title: "Error",
          description: "This purchase order has already been processed",
          variant: "destructive"
        });
        setProcessingAction(false);
        return;
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast({
          title: "Error",
          description: "You must be logged in to perform this action",
          variant: "destructive"
        });
        setProcessingAction(false);
        return;
      }

      const newStatus = actionType === 'approve' ? 'APPROVED' : 'REJECTED';
      const currentTime = new Date().toISOString();

      // Use a transaction-like approach with proper error handling
      const workflowData = {
        workflow_type: 'PURCHASE_ORDER',
        reference_id: selectedPO.id,
        status: newStatus,
        reviewed_by: user.user.id,
        reviewed_at: currentTime,
        rejection_reason: actionType === 'reject' ? rejectionReason : null,
        comments: actionType === 'approve' ? 'Purchase order approved' : rejectionReason
      };

      const poUpdateData: any = {
        status: newStatus,
        updated_at: currentTime
      };

      if (actionType === 'reject') {
        poUpdateData.rejection_reason = rejectionReason;
      }

      // First, create the workflow entry
      const { error: workflowError } = await supabase
        .from('approval_workflows')
        .insert(workflowData);

      if (workflowError) {
        console.error('Workflow creation error:', workflowError);
        throw new Error(`Failed to create approval workflow: ${workflowError.message}`);
      }

      // Then, update the purchase order status
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update(poUpdateData)
        .eq('id', selectedPO.id);

      if (poError) {
        console.error('PO update error:', poError);
        // If PO update fails, try to clean up the workflow entry
        await supabase
          .from('approval_workflows')
          .delete()
          .eq('reference_id', selectedPO.id)
          .eq('workflow_type', 'PURCHASE_ORDER');
        
        throw new Error(`Failed to update purchase order: ${poError.message}`);
      }

      toast({
        title: "Success",
        description: `Purchase order ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`
      });

      // Reset form and refresh data
      setSelectedPO(null);
      setActionType(null);
      setRejectionReason("");
      setPOItems([]);
      fetchPendingPOs();

    } catch (error) {
      console.error('Error processing purchase order action:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process purchase order",
        variant: "destructive"
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="p-4">Loading purchase order approvals...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Purchase Order Approvals
        </CardTitle>
      </CardHeader>
      <CardContent>
        {purchaseOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4" />
            <p>No purchase orders awaiting approval</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>PO Date</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono">{po.po_number}</TableCell>
                  <TableCell>{po.vendor_name}</TableCell>
                  <TableCell>₹{po.total_amount.toLocaleString()}</TableCell>
                  <TableCell>{new Date(po.po_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>{po.items_count} items</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(po.status)}>
                      {po.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPO(po);
                              fetchPOItems(po.id);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Review Purchase Order - {po.po_number}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                              <div>
                                <p><strong>Vendor:</strong> {po.vendor_name}</p>
                                <p><strong>PO Date:</strong> {new Date(po.po_date).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p><strong>Total Amount:</strong> ₹{po.total_amount.toLocaleString()}</p>
                                <p><strong>Expected Delivery:</strong> {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'Not specified'}</p>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium mb-2">Purchase Order Items</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Unit Price</TableHead>
                                    <TableHead>Total Price</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {poItems.map((item) => (
                                    <TableRow key={item.id}>
                                      <TableCell>{item.raw_material_name}</TableCell>
                                      <TableCell>{item.quantity}</TableCell>
                                      <TableCell>₹{item.unit_price}</TableCell>
                                      <TableCell>₹{item.total_price}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>

                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setActionType('approve');
                                  handlePOAction();
                                }}
                                disabled={processingAction || po.has_existing_workflow}
                              >
                                {processingAction && actionType === 'approve' ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                )}
                                {processingAction && actionType === 'approve' ? 'Processing...' : 'Approve PO'}
                              </Button>
                              
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    onClick={() => setActionType('reject')}
                                    disabled={processingAction || po.has_existing_workflow}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject PO
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Reject Purchase Order</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <p>Are you sure you want to reject PO <strong>{po.po_number}</strong>?</p>
                                    <div className="space-y-2">
                                      <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                                      <Textarea
                                        id="rejection-reason"
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="Please provide reason for rejection..."
                                        required
                                        disabled={processingAction}
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button 
                                        variant="outline" 
                                        onClick={() => {
                                          setActionType(null);
                                          setRejectionReason("");
                                        }}
                                        disabled={processingAction}
                                      >
                                        Cancel
                                      </Button>
                                      <Button 
                                        variant="destructive" 
                                        onClick={handlePOAction}
                                        disabled={!rejectionReason.trim() || processingAction}
                                      >
                                        {processingAction && actionType === 'reject' ? (
                                          <>
                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                            Processing...
                                          </>
                                        ) : (
                                          'Reject PO'
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PurchaseOrderApprovalsEnhanced;
