import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Package } from "lucide-react";
import { format } from "date-fns";
import { useProductionOrders } from "@/hooks/useProductionOrders";
import { useToast } from "@/hooks/use-toast";
import ProductionVoucherDetails from "./ProductionVoucherDetails";

interface VoucherKitManagementProps {
  voucherStatuses: any[];
}

const VoucherKitManagement = ({ 
  voucherStatuses 
}: VoucherKitManagementProps) => {
  const { toast } = useToast();
  const { data: productionOrders } = useProductionOrders();
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [isDetailsViewOpen, setIsDetailsViewOpen] = useState(false);

  const getKitStatusColor = (status: string) => {
    switch (status) {
      case 'Ready': return 'default';
      case 'Not Ready': return 'destructive';
      case 'COMPLETE KIT SENT': return 'default';
      case 'ACCESSORY COMPONENTS SENT': return 'warning';
      case 'SUB ASSEMBLY COMPONENTS SENT': return 'warning';
      case 'MAIN ASSEMBLY COMPONENTS SENT': return 'warning';
      case 'PARTIAL KIT SENT': return 'warning';
      default: return 'secondary';
    }
  };

  const handleViewProductionVoucher = (order: any) => {
    setSelectedVoucherId(order.id);
    setIsDetailsViewOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsViewOpen(false);
    setSelectedVoucherId(null);
  };

  if (isDetailsViewOpen && selectedVoucherId) {
    return (
      <ProductionVoucherDetails
        voucherId={selectedVoucherId}
        onBack={handleCloseDetails}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Voucher & Kit Management ({productionOrders?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {productionOrders?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher No.</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Scheduled Production Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Voucher Status</TableHead>
                <TableHead>Production Voucher</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productionOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono">{order.voucher_number}</TableCell>
                  <TableCell className="font-medium">
                    {order.production_schedules?.projections?.products?.name}
                  </TableCell>
                  <TableCell>{format(new Date(order.scheduled_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{order.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={getKitStatusColor(voucherStatuses[order.voucher_number] || "Unknown") as any}>
                      {voucherStatuses[order.voucher_number] || "Loading..."}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => handleViewProductionVoucher(order)}
                    >
                      <Eye className="h-4 w-4" />
                      Production Voucher
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No production vouchers found
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VoucherKitManagement;
