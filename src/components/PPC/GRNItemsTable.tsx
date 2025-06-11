
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GRNItem {
  raw_material_id: string;
  material_code: string;
  material_name: string;
  po_quantity: number;
  received_quantity: number;
  pending_quantity: number;
}

interface GRNItemsTableProps {
  grnItems: GRNItem[];
  onQuantityUpdate: (index: number, quantity: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  invoiceNumber: string;
}

const GRNItemsTable = ({
  grnItems,
  onQuantityUpdate,
  onSubmit,
  isSubmitting,
  invoiceNumber
}: GRNItemsTableProps) => {
  const canSubmit = grnItems.some(item => item.received_quantity > 0) && invoiceNumber.trim() !== '';

  return (
    <div className="space-y-4">
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material Code</TableHead>
              <TableHead>Material Name</TableHead>
              <TableHead>PO Quantity</TableHead>
              <TableHead>Pending Quantity</TableHead>
              <TableHead>Received Quantity</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grnItems.map((item, index) => (
              <TableRow key={item.raw_material_id}>
                <TableCell className="font-mono text-sm">{item.material_code}</TableCell>
                <TableCell className="font-medium">{item.material_name}</TableCell>
                <TableCell>{item.po_quantity.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    {item.pending_quantity.toLocaleString()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    max={item.pending_quantity}
                    value={item.received_quantity || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      onQuantityUpdate(index, value);
                    }}
                    className="w-32"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  {item.received_quantity > 0 ? (
                    <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                      To Receive
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      Pending
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Total items to receive: {grnItems.filter(item => item.received_quantity > 0).length} of {grnItems.length}
        </div>
        <Button 
          onClick={onSubmit} 
          disabled={!canSubmit || isSubmitting}
          className="min-w-32"
        >
          {isSubmitting ? "Creating GRN..." : "Create GRN"}
        </Button>
      </div>
    </div>
  );
};

export default GRNItemsTable;
