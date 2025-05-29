
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, ShoppingCart, Building } from "lucide-react";
import { MaterialShortage, groupShortagesByVendor } from "@/utils/materialShortageCalculator";
import { useCreatePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface MaterialShortagesProps {
  shortages: MaterialShortage[];
  onCreatePO?: () => void;
}

const MaterialShortages = ({ shortages, onCreatePO }: MaterialShortagesProps) => {
  const [creatingPO, setCreatingPO] = useState<string | null>(null);
  const createPurchaseOrder = useCreatePurchaseOrder();
  const { toast } = useToast();

  const vendorGroups = groupShortagesByVendor(shortages);
  const materialsWithoutVendors = shortages.filter(s => !s.vendor_info);

  const handleCreatePO = async (vendorId: string, items: MaterialShortage[]) => {
    setCreatingPO(vendorId);
    try {
      const poItems = items.map(item => ({
        raw_material_id: item.raw_material_id,
        quantity: item.shortage_quantity,
        unit_price: 0, // Default price, can be updated later
      }));

      await createPurchaseOrder.mutateAsync({
        vendor_id: vendorId,
        items: poItems,
        notes: `Auto-generated PO for material shortages`,
        expected_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      });

      toast({
        title: "Purchase Order Created",
        description: `PO created for ${items.length} materials`,
      });

      onCreatePO?.();
    } catch (error) {
      console.error('Error creating PO:', error);
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    } finally {
      setCreatingPO(null);
    }
  };

  if (shortages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <div className="text-2xl font-bold">{shortages.length}</div>
                <div className="text-sm text-muted-foreground">Materials Short</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Building className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{vendorGroups.length}</div>
                <div className="text-sm text-muted-foreground">Vendors Needed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{materialsWithoutVendors.length}</div>
                <div className="text-sm text-muted-foreground">No Vendor Set</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor-wise Shortages */}
      {vendorGroups.map((vendorGroup) => (
        <Card key={vendorGroup.vendor_id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {vendorGroup.vendor_name} ({vendorGroup.vendor_code})
              </CardTitle>
              <Button
                onClick={() => handleCreatePO(vendorGroup.vendor_id, vendorGroup.items)}
                disabled={creatingPO === vendorGroup.vendor_id}
                className="gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                {creatingPO === vendorGroup.vendor_id ? "Creating..." : "Create PO"}
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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorGroup.items.map((shortage) => (
                  <TableRow key={shortage.raw_material_id}>
                    <TableCell className="font-medium">{shortage.material_code}</TableCell>
                    <TableCell>{shortage.material_name}</TableCell>
                    <TableCell>{shortage.required_quantity}</TableCell>
                    <TableCell>{shortage.available_quantity}</TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {shortage.shortage_quantity}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        Short
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Materials without vendors */}
      {materialsWithoutVendors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Materials Without Primary Vendors
            </CardTitle>
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
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialsWithoutVendors.map((shortage) => (
                  <TableRow key={shortage.raw_material_id}>
                    <TableCell className="font-medium">{shortage.material_code}</TableCell>
                    <TableCell>{shortage.material_name}</TableCell>
                    <TableCell>{shortage.required_quantity}</TableCell>
                    <TableCell>{shortage.available_quantity}</TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {shortage.shortage_quantity}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        Set Vendor Required
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Action Required:</strong> These materials need primary vendors assigned before purchase orders can be created.
                Please update the raw materials with vendor information.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MaterialShortages;
