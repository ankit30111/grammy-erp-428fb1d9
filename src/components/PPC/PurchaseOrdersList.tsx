
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, FileText, Eye } from "lucide-react";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { format } from "date-fns";

interface PurchaseOrdersListProps {
  onViewDetails?: (poId: string) => void;
}

const PurchaseOrdersList = ({ onViewDetails }: PurchaseOrdersListProps) => {
  const { data: purchaseOrders, isLoading } = usePurchaseOrders();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'secondary';
      case 'PENDING': return 'warning';
      case 'SENT': return 'default';
      case 'RECEIVED': return 'success';
      case 'CANCELLED': return 'destructive';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading purchase orders...</div>
        </CardContent>
      </Card>
    );
  }

  if (!purchaseOrders?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No purchase orders yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Purchase orders will appear here when material shortages are identified
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Purchase Orders ({purchaseOrders.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">{po.po_number}</TableCell>
                <TableCell>{po.vendors?.name}</TableCell>
                <TableCell>
                  <Badge variant={getStatusColor(po.status) as any}>
                    {po.status}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(po.po_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell>{po.purchase_order_items?.length || 0}</TableCell>
                <TableCell>₹{po.total_amount?.toFixed(2) || '0.00'}</TableCell>
                <TableCell>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onViewDetails?.(po.id)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PurchaseOrdersList;
