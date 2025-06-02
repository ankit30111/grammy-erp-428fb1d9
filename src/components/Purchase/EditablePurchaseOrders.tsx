
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Eye, Save, X } from "lucide-react";
import { useState, useEffect } from "react";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const EditablePurchaseOrders = () => {
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const [editingPO, setEditingPO] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Set up real-time subscription for GRN updates
  useEffect(() => {
    const channel = supabase
      .channel('grn-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'grn_items'
        },
        (payload) => {
          console.log('GRN item updated:', payload);
          // Invalidate purchase orders to refresh received quantities
          queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch vendors for the dropdown
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const updatePOMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update(data.updates)
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      setEditingPO(null);
      setEditFormData({});
      toast({
        title: "Success",
        description: "Purchase order updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating PO:', error);
      toast({
        title: "Error",
        description: "Failed to update purchase order",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (po: any) => {
    setEditingPO(po.id);
    setEditFormData({
      vendor_id: po.vendor_id,
      expected_delivery_date: po.expected_delivery_date,
      notes: po.notes || '',
    });
  };

  const handleSave = () => {
    if (!editingPO) return;
    
    updatePOMutation.mutate({
      id: editingPO,
      updates: editFormData
    });
  };

  const handleCancel = () => {
    setEditingPO(null);
    setEditFormData({});
  };

  return (
    <div className="space-y-4">
      {purchaseOrders && purchaseOrders.length > 0 ? (
        <div className="grid gap-4">
          {purchaseOrders.map((po) => (
            <Card key={po.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {po.po_number}
                    <Badge variant={po.status === 'PENDING' ? 'warning' : 'secondary'}>
                      {po.status}
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    {editingPO === po.id ? (
                      <>
                        <Button 
                          size="sm" 
                          onClick={handleSave}
                          disabled={updatePOMutation.isPending}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleCancel}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEdit(po)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editingPO === po.id ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label>Vendor</Label>
                      <Select 
                        value={editFormData.vendor_id} 
                        onValueChange={(value) => setEditFormData(prev => ({ ...prev, vendor_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name} ({vendor.vendor_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Expected Delivery Date</Label>
                      <Input
                        type="date"
                        value={editFormData.expected_delivery_date || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>PO Remarks</Label>
                      <Textarea
                        value={editFormData.notes || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                        rows={2}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Vendor</p>
                      <p className="font-medium">{po.vendors?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="font-medium">₹{po.total_amount?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Expected Delivery</p>
                      <p className="font-medium">
                        {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Items</p>
                      <p className="font-medium">{po.purchase_order_items?.length || 0} items</p>
                    </div>
                  </div>
                )}

                {/* Enhanced PO Items with real-time quantity tracking */}
                {po.purchase_order_items && po.purchase_order_items.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Items & Real-time Tracking (IQC + Store Verified):</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Code</TableHead>
                          <TableHead>Material Name</TableHead>
                          <TableHead>Ordered Qty</TableHead>
                          <TableHead>Received Qty</TableHead>
                          <TableHead>Pending Qty</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Completion %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {po.purchase_order_items.map((item) => {
                          const receivedQty = item.received_quantity || 0;
                          const pendingQty = item.pending_quantity || item.quantity;
                          const completionPercentage = Math.round((receivedQty / item.quantity) * 100);
                          
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono">
                                {item.raw_materials?.material_code}
                              </TableCell>
                              <TableCell>{item.raw_materials?.name}</TableCell>
                              <TableCell className="font-medium">{item.quantity}</TableCell>
                              <TableCell className="text-blue-600 font-medium">{receivedQty}</TableCell>
                              <TableCell className={pendingQty > 0 ? "text-orange-600 font-medium" : "text-green-600 font-medium"}>
                                {pendingQty}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  receivedQty >= item.quantity ? "default" : 
                                  receivedQty > 0 ? "warning" : "destructive"
                                }>
                                  {receivedQty >= item.quantity ? "Complete" : 
                                   receivedQty > 0 ? "Partial" : "Pending"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        completionPercentage === 100 ? 'bg-green-600' : 
                                        completionPercentage > 0 ? 'bg-blue-600' : 'bg-gray-300'
                                      }`}
                                      style={{ width: `${Math.min(completionPercentage, 100)}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-medium">{completionPercentage}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Workflow Status Indicator */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-1">Material Acceptance Workflow:</p>
                  <p className="text-xs text-blue-600">
                    GRN Created → IQC Approval → Store Physical Verification → Inventory Update → PO Received Qty Updated
                  </p>
                </div>

                {po.notes && !editingPO && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Notes:</p>
                    <p className="text-sm">{po.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Purchase Orders</h3>
            <p className="text-muted-foreground">
              Create purchase orders from material shortages
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
