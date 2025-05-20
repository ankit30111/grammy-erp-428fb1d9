
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRNItem } from "@/types/store";
import { Check, AlertTriangle, Search } from "lucide-react";
import { format } from "date-fns";

interface GRNReceivingProps {
  grns: GRNItem[];
  onReceiveGRN: (id: string, quantity: number) => void;
}

export default function GRNReceiving({ grns, onReceiveGRN }: GRNReceivingProps) {
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [filteredGRNs, setFilteredGRNs] = useState(grns.filter(grn => grn.status === "PENDING"));
  const [searchTerm, setSearchTerm] = useState("");

  const handleQuantityChange = (id: string, value: string) => {
    setQuantityInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleReceiveGRN = (id: string) => {
    const quantity = parseInt(quantityInputs[id] || "0");
    onReceiveGRN(id, quantity);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">IQC-Passed GRN Receiving</h3>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by GRN or Part Code..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>GRN No</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Part Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Expected Qty</TableHead>
            <TableHead>Received Qty</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredGRNs
            .filter(grn => 
              grn.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
              grn.partCode.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((grn) => (
              <TableRow key={grn.id}>
                <TableCell className="font-medium">{grn.grnNumber}</TableCell>
                <TableCell>{format(new Date(grn.date), "MMM dd, yyyy")}</TableCell>
                <TableCell className="font-mono">{grn.partCode}</TableCell>
                <TableCell>{grn.description}</TableCell>
                <TableCell>{grn.vendor}</TableCell>
                <TableCell>{grn.expectedQuantity}</TableCell>
                <TableCell>
                  {grn.status === "PENDING" ? (
                    <Input
                      type="number"
                      size={5}
                      className="w-20"
                      value={quantityInputs[grn.id] || ""}
                      onChange={(e) => handleQuantityChange(grn.id, e.target.value)}
                    />
                  ) : (
                    <span className={grn.hasDiscrepancy ? "text-red-600 font-medium" : ""}>
                      {grn.receivedQuantity}
                      {grn.hasDiscrepancy && (
                        <AlertTriangle className="inline ml-1 h-4 w-4 text-red-600" />
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {grn.status === "PENDING" ? (
                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                      Pending
                    </span>
                  ) : grn.status === "RECEIVED" ? (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      Received
                    </span>
                  ) : (
                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                      Discrepancy
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {grn.status === "PENDING" && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleReceiveGRN(grn.id)}
                      disabled={!quantityInputs[grn.id]}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Receive
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {filteredGRNs.filter(grn => 
        grn.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
        grn.partCode.toLowerCase().includes(searchTerm.toLowerCase())
      ).length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No GRNs found matching your search criteria
        </div>
      )}
    </div>
  );
}
