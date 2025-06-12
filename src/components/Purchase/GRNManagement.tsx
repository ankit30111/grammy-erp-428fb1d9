
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, FileText, Edit, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useGRN, useUpdateGRNItem } from "@/hooks/useGRN";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const GRNManagement = () => {
  const { data: grns, isLoading } = useGRN();
  const updateGRNItem = useUpdateGRNItem();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");

  // Set up real-time subscription for inventory updates
  useEffect(() => {
    const channel = supabase
      .channel('inventory-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory'
        },
        () => {
          // Refresh purchase orders when inventory updates
          queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'APPROVED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  const getIQCStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'ACCEPTED': return 'default';
      case 'REJECTED': return 'destructive';
      case 'SEGREGATED': return 'secondary';
      default: return 'secondary';
    }
  };

  const handleEditQuantity = (item: any) => {
    setEditingItem(item.id);
    setEditQuantity(item.received_quantity.toString());
  };

  const handleSaveEdit = (item: any) => {
    const newQuantity = parseInt(editQuantity);
    if (newQuantity <= 0 || newQuantity > item.po_quantity) {
      toast({
        title: "Invalid Quantity",
        description: `Quantity must be between 1 and ${item.po_quantity}`,
        variant: "destructive",
      });
      return;
    }

    updateGRNItem.mutate({
      itemId: item.id,
      updates: {
        received_quantity: newQuantity,
      }
    });

    setEditingItem(null);
    setEditQuantity("");
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditQuantity("");
  };

  const handleIQCApproval = (itemId: string, approved: boolean) => {
    if (approved) {
      updateGRNItem.mutate({
        itemId,
        updates: {
          iqc_status: 'ACCEPTED',
          iqc_approved_at: new Date().toISOString(),
        }
      });
    } else {
      updateGRNItem.mutate({
        itemId,
        updates: {
          iqc_status: 'REJECTED',
          iqc_approved_at: new Date().toISOString(),
          accepted_quantity: 0,
        }
      });
    }
  };

  const handleIQCSegregation = (itemId: string, acceptedQty: number) => {
    updateGRNItem.mutate({
      itemId,
      updates: {
        iqc_status: 'SEGREGATED',
        iqc_approved_at: new Date().toISOString(),
        accepted_quantity: acceptedQty,
        rejected_quantity: 0, // Calculate if needed
      }
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            GRN Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading GRNs...</div>
        </CardContent>
      </Card>
    );
  }

  if (!grns?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            GRN Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No GRNs found</p>
            <p className="text-sm text-muted-foreground mt-1">
              GRNs will appear here when materials are received against purchase orders
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* IQC Workflow Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            IQC Inspection Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              <span>1. GRN Created</span>
            </div>
            <div className="text-gray-400">→</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
              <span>2. IQC Inspection</span>
            </div>
            <div className="text-gray-400">→</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
              <span>3. Forward to Store</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {grns.map((grn) => (
        <Card key={grn.id}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                GRN: {grn.grn_number}
              </CardTitle>
              <Badge variant={getStatusColor(grn.status) as any}>
                {grn.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">PO Number:</span>
                <p className="font-medium">{grn.purchase_orders?.po_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Vendor:</span>
                <p className="font-medium">{grn.vendors?.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Received Date:</span>
                <p className="font-medium">{format(new Date(grn.received_date), 'MMM dd, yyyy')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Items:</span>
                <p className="font-medium">{grn.grn_items?.length || 0}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>PO Qty</TableHead>
                  <TableHead>Received Qty</TableHead>
                  <TableHead>IQC Status</TableHead>
                  <TableHead>Store Status</TableHead>
                  <TableHead>IQC Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grn.grn_items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                    <TableCell>{item.raw_materials?.name}</TableCell>
                    <TableCell>{item.po_quantity}</TableCell>
                    <TableCell>
                      {editingItem === item.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                            className="w-20"
                            min="1"
                            max={item.po_quantity}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(item)}
                            className="h-8 w-8 p-0"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            className="h-8 w-8 p-0"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{item.received_quantity}</span>
                          {grn.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditQuantity(item)}
                              className="h-6 w-6 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getIQCStatusColor(item.iqc_status) as any}>
                        {item.iqc_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.store_confirmed ? (
                        <Badge variant="default">Received to Store</Badge>
                      ) : item.iqc_status === 'ACCEPTED' || item.iqc_status === 'SEGREGATED' ? (
                        <Badge variant="secondary">Ready for Store</Badge>
                      ) : (
                        <Badge variant="outline">Pending IQC</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {item.iqc_status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIQCApproval(item.id, true)}
                              className="text-green-600 border-green-300 hover:bg-green-50 text-xs"
                            >
                              IQC Pass
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIQCApproval(item.id, false)}
                              className="text-red-600 border-red-300 hover:bg-red-50 text-xs"
                            >
                              IQC Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const acceptedQty = prompt(`Enter accepted quantity (max: ${item.received_quantity}):`);
                                if (acceptedQty && parseInt(acceptedQty) > 0 && parseInt(acceptedQty) <= item.received_quantity) {
                                  handleIQCSegregation(item.id, parseInt(acceptedQty));
                                }
                              }}
                              className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs"
                            >
                              Segregate
                            </Button>
                          </>
                        )}
                        {(item.iqc_status === 'ACCEPTED' || item.iqc_status === 'SEGREGATED') && !item.store_confirmed && (
                          <Badge variant="secondary" className="text-xs">
                            Forwarded to Store
                          </Badge>
                        )}
                        {item.store_confirmed && (
                          <Badge variant="default" className="text-xs">
                            Process Complete
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default GRNManagement;
