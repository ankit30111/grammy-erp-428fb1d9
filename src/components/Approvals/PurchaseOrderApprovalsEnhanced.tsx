
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Package, Edit } from "lucide-react";
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
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingPOs();
  }, []);

  const fetchPendingPOs = async () => {
    try {
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
        .eq('status', 'PENDING_APPROVAL')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map(po => ({
        id: po.id,
        po_number: po.po_number,
        vendor_name: po.vendors?.name || 'Unknown Vendor',
        total_amount: po.total_amount || 0,
        po_date: po.po_date,
        expected_delivery_date: po.expected_delivery_date,
        status: po.status,
        items_count: po.purchase_order_items?.length || 0,
        created_by_name: null
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

  const handlePOAction = async () => {
    if (!selectedPO || !actionType) return;

    try {
      const newStatus = actionType === 'approve' ? 'APPROVED' : 'REJECTED';
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (actionType === 'reject') {
        updateData.rejection_reason = rejectionReason;
      }

      // Create approval workflow entry
      await supabase.from('approval_workflows').insert({
        workflow_type: 'PURCHASE_ORDER',
        reference_id: selectedPO.id,
        status: actionType === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: actionType === 'reject' ? rejectionReason : null,
        comments: actionType === 'approve' ? 'Purchase order approved' : rejectionReason
      });

      // Update purchase order status
      const { error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', selectedPO.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Purchase order ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`
      });

      setSelectedPO(null);
      setActionType(null);
      setRejectionReason("");
      setPOItems([]);
      fetchPendingPOs();
    } catch (error) {
      console.error('Error updating purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to update purchase order",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-800';
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
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve PO
                              </Button>
                              
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    onClick={() => setActionType('reject')}
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
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline" onClick={() => setActionType(null)}>
                                        Cancel
                                      </Button>
                                      <Button 
                                        variant="destructive" 
                                        onClick={handlePOAction}
                                        disabled={!rejectionReason.trim()}
                                      >
                                        Reject PO
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
