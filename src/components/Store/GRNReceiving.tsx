
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { GRNItemsTable } from "./GRNReceiving/GRNItemsTable";
import { GRNEmptyState } from "./GRNReceiving/GRNEmptyState";
import { useGRNReceiving } from "./GRNReceiving/hooks/useGRNReceiving";

const GRNReceiving = () => {
  const {
    grnItems,
    isLoading,
    physicalQuantities,
    handlePhysicalQuantityChange,
    handleConfirmReceipt,
    isPending
  } = useGRNReceiving();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-muted-foreground">Loading GRN items for receipt...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          Materials Ready for Store Receipt
          {grnItems.length > 0 && (
            <Badge variant="secondary">{grnItems.length} items</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {grnItems.length > 0 ? (
          <GRNItemsTable
            grnItems={grnItems}
            physicalQuantities={physicalQuantities}
            onPhysicalQuantityChange={handlePhysicalQuantityChange}
            onConfirmReceipt={handleConfirmReceipt}
            isPending={isPending}
          />
        ) : (
          <GRNEmptyState
            title="No Items Ready for Receipt"
            description="All materials forwarded by IQC have been received to store."
          />
        )}
      </CardContent>
    </Card>
  );
};

export default GRNReceiving;
