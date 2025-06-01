
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

interface GRNItem {
  raw_material_id: string;
  material_code: string;
  material_name: string;
  po_quantity: number;
  received_quantity: number;
}

interface GRNItemsTableProps {
  grnItems: GRNItem[];
  onQuantityUpdate: (index: number, quantity: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  billNumber: string;
}

const GRNItemsTable = ({
  grnItems,
  onQuantityUpdate,
  onSubmit,
  isSubmitting,
  billNumber
}: GRNItemsTableProps) => {
  if (grnItems.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">GRN Items - Enter Received Quantities</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material Code</TableHead>
            <TableHead>Material Name</TableHead>
            <TableHead>PO Quantity</TableHead>
            <TableHead>Received Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grnItems.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono">{item.material_code}</TableCell>
              <TableCell>{item.material_name}</TableCell>
              <TableCell>
                <Badge variant="outline">{item.po_quantity}</Badge>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  max={item.po_quantity}
                  value={item.received_quantity}
                  onChange={(e) => onQuantityUpdate(index, parseInt(e.target.value) || 0)}
                  className="w-32"
                  placeholder="Enter qty"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end mt-4">
        <Button 
          onClick={onSubmit}
          disabled={isSubmitting || !billNumber || grnItems.every(item => item.received_quantity === 0)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {isSubmitting ? "Creating..." : "Create GRN"}
        </Button>
      </div>
    </div>
  );
};

export default GRNItemsTable;
