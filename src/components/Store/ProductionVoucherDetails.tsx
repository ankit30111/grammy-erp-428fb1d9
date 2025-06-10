
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package } from "lucide-react";
import { useProductionOrders } from "@/hooks/useProductionOrders";
import { format } from "date-fns";
import ProductionVoucherBOMDisplay from "./ProductionVoucherBOMDisplay";

interface ProductionVoucherDetailsProps {
  voucherId: string;
  onBack: () => void;
}

const ProductionVoucherDetails = ({ voucherId, onBack }: ProductionVoucherDetailsProps) => {
  const { data: productionOrders } = useProductionOrders();
  
  const voucher = productionOrders?.find(order => order.id === voucherId);

  if (!voucher) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Voucher not found</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Production Voucher Details</h2>
            <p className="text-muted-foreground">Voucher: {voucher.voucher_number}</p>
          </div>
        </div>
        <Badge variant="outline">
          {voucher.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Voucher Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Product</label>
            <p className="font-medium">
              {voucher.production_schedules?.projections?.products?.name}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Customer</label>
            <p className="font-medium">
              {voucher.production_schedules?.projections?.customers?.name}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Quantity</label>
            <p className="font-medium">{voucher.quantity}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Scheduled Date</label>
            <p className="font-medium">{format(new Date(voucher.scheduled_date), 'PPP')}</p>
          </div>
        </CardContent>
      </Card>

      <ProductionVoucherBOMDisplay 
        productId={voucher.product_id}
        requiredQuantity={voucher.quantity}
      />
    </div>
  );
};

export default ProductionVoucherDetails;
