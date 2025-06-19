
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface GRNItemsTableProps {
  grnItems: any[];
  physicalQuantities: Record<string, number>;
  onPhysicalQuantityChange: (itemId: string, quantity: string) => void;
  onConfirmReceipt: (item: any) => void;
  isPending: boolean;
}

export const GRNItemsTable = ({
  grnItems,
  physicalQuantities,
  onPhysicalQuantityChange,
  onConfirmReceipt,
  isPending
}: GRNItemsTableProps) => {
  const getAcceptedQuantity = (item: any) => {
    // For SEGREGATED items, show the accepted quantity, for APPROVED items show received quantity
    return item.iqc_status === 'SEGREGATED' ? item.accepted_quantity : item.received_quantity;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>GRN Number</TableHead>
          <TableHead>Material Code</TableHead>
          <TableHead>Material Name</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead>Received Date</TableHead>
          <TableHead>IQC Status</TableHead>
          <TableHead>Qty Forwarded by IQC</TableHead>
          <TableHead>Physical Qty Verified</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grnItems.map((item) => {
          const acceptedQty = getAcceptedQuantity(item);
          const physicalQty = physicalQuantities[item.id];
          
          return (
            <TableRow key={item.id}>
              <TableCell className="font-mono">{item.grn?.grn_number}</TableCell>
              <TableCell className="font-mono text-blue-600">
                {item.raw_materials?.material_code}
              </TableCell>
              <TableCell>{item.raw_materials?.name}</TableCell>
              <TableCell>{item.grn?.vendors?.name}</TableCell>
              <TableCell>
                {item.grn?.received_date ? format(new Date(item.grn.received_date), 'MMM dd, yyyy') : 'N/A'}
              </TableCell>
              <TableCell>
                <Badge 
                  variant={item.iqc_status === 'APPROVED' ? 'default' : 'secondary'}
                  className={item.iqc_status === 'APPROVED' ? 'bg-green-100 text-green-800' : ''}
                >
                  {item.iqc_status}
                </Badge>
              </TableCell>
              <TableCell className="font-medium text-lg">
                {acceptedQty}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  max={acceptedQty}
                  value={physicalQty || ''}
                  onChange={(e) => onPhysicalQuantityChange(item.id, e.target.value)}
                  placeholder="Enter physical count"
                  className="w-32"
                />
                {physicalQty !== undefined && physicalQty !== acceptedQty && (
                  <div className="text-xs mt-1">
                    {physicalQty < acceptedQty ? (
                      <span className="text-red-600">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        Shortage: {acceptedQty - physicalQty}
                      </span>
                    ) : (
                      <span className="text-orange-600">
                        Excess: {physicalQty - acceptedQty}
                      </span>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Button
                  onClick={() => onConfirmReceipt(item)}
                  disabled={physicalQty === undefined || isPending}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Confirm Receipt
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
