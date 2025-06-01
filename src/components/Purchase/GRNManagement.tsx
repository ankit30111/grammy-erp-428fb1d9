
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, FileText, Edit, CheckCircle, XCircle } from "lucide-react";
import { useGRN, useUpdateGRNItem } from "@/hooks/useGRN";
import { format } from "date-fns";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const GRNManagement = () => {
  const { data: grns, isLoading } = useGRN();
  const updateGRNItem = useUpdateGRNItem();
  const { toast } = useToast();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");

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
        accepted_quantity: newQuantity, // For now, assume all received is accepted
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
    updateGRNItem.mutate({
      itemId,
      updates: {
        iqc_status: approved ? 'ACCEPTED' : 'REJECTED',
        iqc_approved_at: new Date().toISOString(),
        accepted_quantity: approved ? undefined : 0, // If rejected, set accepted quantity to 0
      }
    });
  };

  const handleStoreConfirmation = (itemId: string) => {
    updateGRNItem.mutate({
      itemId,
      updates: {
        store_confirmed: true,
        store_confirmed_at: new Date().toISOString(),
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
                  <TableHead>Actions</TableHead>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditQuantity(item)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
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
                        <Badge variant="default">Confirmed</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {item.iqc_status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIQCApproval(item.id, true)}
                              className="text-green-600 border-green-300 hover:bg-green-50"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              IQC Pass
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIQCApproval(item.id, false)}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              IQC Reject
                            </Button>
                          </>
                        )}
                        {item.iqc_status === 'ACCEPTED' && !item.store_confirmed && (
                          <Button
                            size="sm"
                            onClick={() => handleStoreConfirmation(item.id)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Confirm to Store
                          </Button>
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
