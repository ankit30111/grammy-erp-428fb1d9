
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, Truck, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const MaterialShortagesView = () => {
  // Fetch material requirements and shortages
  const { data: materialRequirements = [] } = useQuery({
    queryKey: ["material-requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_requirements_view")
        .select("*");
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch purchase order status for materials with shortages
  const { data: purchaseOrderStatus = [] } = useQuery({
    queryKey: ["purchase-order-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select(`
          *,
          purchase_orders!inner(
            po_number,
            status,
            delivery_target_date,
            vendors(name)
          ),
          raw_materials(material_code, name)
        `)
        .in("received_status", ["PENDING", "PARTIAL"]);
      
      if (error) throw error;
      return data;
    }
  });

  // Group shortages by material
  const materialShortages = materialRequirements.reduce((acc: any[], req: any) => {
    if (req.shortage_quantity > 0) {
      const existing = acc.find(item => item.raw_material_id === req.raw_material_id);
      if (existing) {
        existing.total_shortage += req.shortage_quantity;
        existing.projections.push(req);
      } else {
        acc.push({
          raw_material_id: req.raw_material_id,
          material_code: req.material_code,
          material_name: req.material_name,
          available_quantity: req.available_quantity,
          total_shortage: req.shortage_quantity,
          is_critical: req.is_critical,
          projections: [req]
        });
      }
    }
    return acc;
  }, []);

  const getPurchaseStatus = (materialId: string) => {
    return purchaseOrderStatus.filter(po => po.raw_material_id === materialId);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <div className="text-2xl font-bold">{materialShortages.length}</div>
                <div className="text-sm text-muted-foreground">Materials with Shortages</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Package className="h-8 w-8 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">
                  {materialShortages.filter(m => m.is_critical).length}
                </div>
                <div className="text-sm text-muted-foreground">Critical Shortages</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Truck className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{purchaseOrderStatus.length}</div>
                <div className="text-sm text-muted-foreground">Items Ordered</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">
                  {materialRequirements.filter(m => m.shortage_quantity === 0).length}
                </div>
                <div className="text-sm text-muted-foreground">Materials Available</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Material Shortages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Code</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Shortage</TableHead>
                <TableHead>Critical</TableHead>
                <TableHead>Purchase Status</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialShortages.map((shortage) => {
                const poItems = getPurchaseStatus(shortage.raw_material_id);
                
                return (
                  <TableRow key={shortage.raw_material_id}>
                    <TableCell className="font-medium">{shortage.material_code}</TableCell>
                    <TableCell>{shortage.material_name}</TableCell>
                    <TableCell>{shortage.available_quantity}</TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {shortage.total_shortage}
                    </TableCell>
                    <TableCell>
                      {shortage.is_critical && (
                        <Badge variant="destructive">Critical</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {poItems.length > 0 ? (
                        <div className="space-y-1">
                          {poItems.map((po, index) => (
                            <div key={index}>
                              <Badge variant="outline">
                                {po.purchase_orders.po_number}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {po.purchase_orders.status} - Qty: {po.quantity}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="secondary">Not Ordered</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {poItems.length > 0 && poItems[0].purchase_orders.delivery_target_date ? (
                        format(new Date(poItems[0].purchase_orders.delivery_target_date), "PPP")
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {poItems.length === 0 && (
                        <Button size="sm" variant="outline">
                          Create PO
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
