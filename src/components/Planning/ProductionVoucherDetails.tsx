
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ProductionVoucherDetailsProps {
  scheduleId: string | null;
  voucherNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

const ProductionVoucherDetails = ({ scheduleId, voucherNumber, isOpen, onClose }: ProductionVoucherDetailsProps) => {
  const { data: materialRequirements = [] } = useQuery({
    queryKey: ["production-material-requirements", scheduleId],
    queryFn: async () => {
      if (!scheduleId) return [];
      
      const { data, error } = await supabase
        .from("material_requirements_view")
        .select("*")
        .eq("projection_id", scheduleId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!scheduleId && isOpen
  });

  const { data: purchaseOrderStatus = [] } = useQuery({
    queryKey: ["material-purchase-status", scheduleId],
    queryFn: async () => {
      if (!scheduleId || !materialRequirements.length) return [];
      
      const materialIds = materialRequirements.map(req => req.raw_material_id);
      
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
        .in("raw_material_id", materialIds)
        .in("received_status", ["PENDING", "PARTIAL"]);
      
      if (error) throw error;
      return data;
    },
    enabled: !!scheduleId && isOpen && materialRequirements.length > 0
  });

  const getMaterialStatus = (materialId: string, shortageQty: number) => {
    if (shortageQty === 0) return { status: "Available", color: "secondary", icon: CheckCircle };
    
    const hasPO = purchaseOrderStatus.some(po => po.raw_material_id === materialId);
    if (hasPO) return { status: "PO Raised", color: "warning", icon: Clock };
    
    return { status: "Short", color: "destructive", icon: AlertTriangle };
  };

  const getPODetails = (materialId: string) => {
    return purchaseOrderStatus.filter(po => po.raw_material_id === materialId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Production Voucher {voucherNumber} - Raw Material Status
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Code</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Required Qty</TableHead>
                <TableHead>Available Qty</TableHead>
                <TableHead>Shortage Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PO Details</TableHead>
                <TableHead>Delivery Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialRequirements.map((req) => {
                const materialStatus = getMaterialStatus(req.raw_material_id, req.shortage_quantity);
                const poDetails = getPODetails(req.raw_material_id);
                const StatusIcon = materialStatus.icon;
                
                return (
                  <TableRow key={req.raw_material_id}>
                    <TableCell className="font-medium">{req.material_code}</TableCell>
                    <TableCell>{req.material_name}</TableCell>
                    <TableCell>{req.total_required}</TableCell>
                    <TableCell>{req.available_quantity}</TableCell>
                    <TableCell className={req.shortage_quantity > 0 ? "text-red-600 font-medium" : ""}>
                      {req.shortage_quantity}
                    </TableCell>
                    <TableCell>
                      <Badge variant={materialStatus.color as any} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {materialStatus.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {poDetails.length > 0 ? (
                        <div className="space-y-1">
                          {poDetails.map((po, index) => (
                            <div key={index} className="text-sm">
                              <Badge variant="outline" className="text-xs">
                                {po.purchase_orders.po_number}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                Qty: {po.quantity} | {po.purchase_orders.status}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        req.shortage_quantity > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            No PO
                          </Badge>
                        ) : "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {poDetails.length > 0 && poDetails[0].purchase_orders.delivery_target_date ? (
                        format(new Date(poDetails[0].purchase_orders.delivery_target_date), "PPP")
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {materialRequirements.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No material requirements found for this production voucher
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionVoucherDetails;
