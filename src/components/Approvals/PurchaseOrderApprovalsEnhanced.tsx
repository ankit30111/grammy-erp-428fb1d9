import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Package, Edit, Loader2, FileText, Download, Eye, Clock, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generatePurchaseOrderPDF, generatePurchaseOrderFilename, type PurchaseOrderData } from "@/utils/pdfTemplates";

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
          raw_materials:raw_material_id (name, material_code)
        `)
        .eq('purchase_order_id', poId);

      if (error) throw error;

      const formattedItems = data?.map(item => ({
        id: item.id,
        raw_material_name: item.raw_materials?.name || 'Unknown Material',
        material_code: item.raw_materials?.material_code || 'N/A',
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

  const fetchCompletePoData = async (poId: string): Promise<PurchaseOrderData | null> => {
    try {
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors:vendor_id (name, address, contact_number, email),
          purchase_order_items (
            id,
            quantity,
            unit_price,
            total_price,
            raw_materials:raw_material_id (name, material_code)
          )
        `)
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      const vendor = poData.vendors;
      return {
        poNumber: poData.po_number,
        vendorName: vendor?.name || 'Unknown Vendor',
        vendorAddress: vendor?.address || 'Address not available',
        vendorContact: vendor?.contact_number || vendor?.email || 'Contact not available',
        expectedDeliveryDate: poData.expected_delivery_date || new Date().toISOString(),
        items: poData.purchase_order_items?.map(item => ({
          materialCode: item.raw_materials?.material_code || 'N/A',
          materialName: item.raw_materials?.name || 'Unknown Material',
          quantity: item.quantity,
          unitPrice: item.unit_price || 0,
          totalPrice: item.total_price || 0
        })) || [],
        totalAmount: poData.total_amount || 0,
        notes: poData.notes || '',
        createdBy: 'Purchase Department',
        createdAt: poData.created_at
      };
    } catch (error) {
      console.error('Error fetching complete PO data:', error);
      return null;
    }
  };

  const handleViewPDF = async (po: PurchaseOrder) => {
    try {
      const poData = await fetchCompletePoData(po.id);
      if (!poData) {
        toast({
          title: "Error",
          description: "Failed to fetch purchase order data for PDF generation",
          variant: "destructive"
        });
        return;
      }

      const pdf = generatePurchaseOrderPDF(poData);
      const dataUrl = pdf.getDataURL();
      
      // Open PDF in new tab
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>Purchase Order - ${po.po_number}</title></head>
            <body style="margin:0;">
              <iframe src="${dataUrl}" width="100%" height="100%" style="border:none;"></iframe>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive"
      });
    }
  };

  const handleDownloadPDF = async (po: PurchaseOrder) => {
    try {
      const poData = await fetchCompletePoData(po.id);
      if (!poData) {
        toast({
          title: "Error",
          description: "Failed to fetch purchase order data for PDF generation",
          variant: "destructive"
        });
        return;
      }

      const pdf = generatePurchaseOrderPDF(poData);
      const filename = generatePurchaseOrderFilename(po.po_number);
      pdf.save(filename);
      
      toast({
        title: "Success",
        description: "PDF downloaded successfully"
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Error",
        description: "Failed to download PDF",
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

                            <div className="flex flex-col gap-4">
                              {/* PDF Actions */}
                              <div className="flex justify-start gap-2 p-4 bg-blue-50 rounded-lg">
                                <h4 className="font-medium text-sm text-blue-800 mr-4">Document Actions:</h4>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewPDF(po)}
                                  className="flex items-center gap-1"
                                >
                                  <Eye className="h-4 w-4" />
                                  View PDF
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadPDF(po)}
                                  className="flex items-center gap-1"
                                >
                                  <Download className="h-4 w-4" />
                                  Download PDF
                                </Button>
                              </div>

                              {/* Review Actions */}
                              <div className="flex justify-end gap-2 p-4 bg-gray-50 rounded-lg">
                                <h4 className="font-medium text-sm text-gray-700 mr-auto">Review Actions:</h4>
                                
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={po.has_existing_workflow}
                                  onClick={() => {
                                    toast({
                                      title: "Hold for Review",
                                      description: "Purchase order has been put on hold for review"
                                    });
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <Clock className="h-4 w-4" />
                                  Hold for Review
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={po.has_existing_workflow}
                                  onClick={() => setEditingItems(true)}
                                  className="flex items-center gap-1"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit PO
                                </Button>

                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={processingAction || po.has_existing_workflow}
                                      className="flex items-center gap-1"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                      Approve PO
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Approve Purchase Order</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <p>Are you sure you want to approve PO <strong>{po.po_number}</strong>?</p>
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline">Cancel</Button>
                                        <Button 
                                          onClick={() => {
                                            setActionType('approve');
                                            handlePOAction();
                                          }}
                                          disabled={processingAction}
                                        >
                                          {processingAction && actionType === 'approve' ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                              Processing...
                                            </>
                                          ) : (
                                            'Confirm Approval'
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      onClick={() => setActionType('reject')}
                                      disabled={processingAction || po.has_existing_workflow}
                                      className="flex items-center gap-1"
                                    >
                                      <XCircle className="h-4 w-4" />
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
                                          placeholder="Please provide detailed reason for rejection..."
                                          required
                                          disabled={processingAction}
                                          rows={4}
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

                              {/* Edit PO Items Section */}
                              {editingItems && (
                                <div className="mt-4 p-4 bg-yellow-50 rounded-lg border">
                                  <h5 className="font-medium text-yellow-800 mb-3">Edit Purchase Order Items</h5>
                                  <div className="space-y-3">
                                    {poItems.map((item, index) => (
                                      <div key={item.id} className="grid grid-cols-4 gap-3 items-center p-3 bg-white rounded border">
                                        <div className="text-sm font-medium">{item.raw_material_name}</div>
                                        <div>
                                          <Label className="text-xs">Quantity</Label>
                                          <Input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => {
                                              const newItems = [...poItems];
                                              newItems[index].quantity = parseInt(e.target.value) || 0;
                                              newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
                                              setPOItems(newItems);
                                            }}
                                            className="mt-1"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Unit Price</Label>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            value={item.unit_price}
                                            onChange={(e) => {
                                              const newItems = [...poItems];
                                              newItems[index].unit_price = parseFloat(e.target.value) || 0;
                                              newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
                                              setPOItems(newItems);
                                            }}
                                            className="mt-1"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Total</Label>
                                          <div className="text-sm font-medium mt-1 p-2 bg-gray-100 rounded">
                                            ₹{item.total_price.toLocaleString()}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex justify-between items-center mt-4 pt-3 border-t">
                                    <div className="text-lg font-semibold">
                                      Total Amount: ₹{poItems.reduce((sum, item) => sum + item.total_price, 0).toLocaleString()}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingItems(false);
                                          fetchPOItems(po.id); // Reset to original values
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={async () => {
                                          try {
                                            setProcessingAction(true);
                                            
                                            // Update PO items in database
                                            for (const item of poItems) {
                                              await supabase
                                                .from('purchase_order_items')
                                                .update({
                                                  quantity: item.quantity,
                                                  unit_price: item.unit_price,
                                                  total_price: item.total_price
                                                })
                                                .eq('id', item.id);
                                            }
                                            
                                            // Update total amount
                                            const newTotal = poItems.reduce((sum, item) => sum + item.total_price, 0);
                                            await supabase
                                              .from('purchase_orders')
                                              .update({ 
                                                total_amount: newTotal,
                                                updated_at: new Date().toISOString()
                                              })
                                              .eq('id', selectedPO?.id);
                                            
                                            toast({
                                              title: "Success",
                                              description: "Purchase order updated successfully"
                                            });
                                            
                                            setEditingItems(false);
                                            fetchPendingPOs();
                                          } catch (error) {
                                            console.error('Error updating PO:', error);
                                            toast({
                                              title: "Error",
                                              description: "Failed to update purchase order",
                                              variant: "destructive"
                                            });
                                          } finally {
                                            setProcessingAction(false);
                                          }
                                        }}
                                        disabled={processingAction}
                                      >
                                        {processingAction ? (
                                          <>
                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                            Saving...
                                          </>
                                        ) : (
                                          'Save Changes'
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
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
