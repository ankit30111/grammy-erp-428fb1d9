
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, ShoppingCart } from "lucide-react";
import { MaterialShortage, groupShortagesByVendor } from "@/utils/materialShortageCalculator";
import { useCreatePurchaseOrder } from "@/hooks/usePurchaseOrders";

interface MaterialShortagesProps {
  shortages: MaterialShortage[];
  onCreatePO?: (vendorId: string, items: MaterialShortage[]) => void;
}

const MaterialShortages = ({ shortages, onCreatePO }: MaterialShortagesProps) => {
  const createPurchaseOrder = useCreatePurchaseOrder();
  const vendorGroups = groupShortagesByVendor(shortages);

  const handleCreatePO = async (vendorId: string, items: MaterialShortage[]) => {
    const orderData = {
      vendor_id: vendorId,
      items: items.map(item => ({
        raw_material_id: item.raw_material_id,
        quantity: item.shortage_quantity,
        unit_price: 0, // Will need to be set manually
      })),
      notes: `Auto-generated PO for material shortages`,
      expected_delivery_date: null,
    };

    createPurchaseOrder.mutate(orderData);
    
    if (onCreatePO) {
      onCreatePO(vendorId, items);
    }
  };

  if (shortages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            Material Shortages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No material shortages found</p>
            <p className="text-sm text-muted-foreground mt-1">
              All required materials are available in stock
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Material Shortages Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{shortages.length}</div>
              <div className="text-sm text-muted-foreground">Materials Short</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{vendorGroups.length}</div>
              <div className="text-sm text-muted-foreground">Vendors Affected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {shortages.reduce((sum, item) => sum + item.shortage_quantity, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Shortage Qty</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {vendorGroups.map((vendor) => (
        <Card key={vendor.vendor_id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {vendor.vendor_name}
                <Badge variant="secondary">{vendor.total_items} items</Badge>
              </CardTitle>
              <Button 
                onClick={() => handleCreatePO(vendor.vendor_id, vendor.items)}
                disabled={createPurchaseOrder.isPending}
                className="gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                Create PO
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Shortage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendor.items.map((item) => (
                  <TableRow key={item.raw_material_id}>
                    <TableCell className="font-medium">{item.material_code}</TableCell>
                    <TableCell>{item.material_name}</TableCell>
                    <TableCell>{item.required_quantity}</TableCell>
                    <TableCell>{item.available_quantity}</TableCell>
                    <TableCell>
                      <span className="text-orange-600 font-medium">
                        {item.shortage_quantity}
                      </span>
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

export default MaterialShortages;
