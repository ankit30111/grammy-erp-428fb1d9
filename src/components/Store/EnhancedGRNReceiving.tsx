
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRNItem } from "@/types/store";
import { Check, AlertTriangle, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface EnhancedGRNReceivingProps {
  grns: GRNItem[];
  onReceiveGRN: (id: string, quantity: number) => void;
  onDiscrepancyReport: (grnId: string, expectedQty: number, receivedQty: number, poNumber: string) => void;
}

export default function EnhancedGRNReceiving({ 
  grns, 
  onReceiveGRN, 
  onDiscrepancyReport 
}: EnhancedGRNReceivingProps) {
  const { toast } = useToast();
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");

  const handleQuantityChange = (id: string, value: string) => {
    setQuantityInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleReceiveGRN = (grn: GRNItem) => {
    const receivedQuantity = parseInt(quantityInputs[grn.id] || "0");
    
    if (receivedQuantity < grn.expectedQuantity) {
      // Report discrepancy to purchase
      onDiscrepancyReport(grn.id, grn.expectedQuantity, receivedQuantity, grn.poNumber);
      
      toast({
        title: "Discrepancy Reported",
        description: `Purchase team notified about quantity mismatch for PO: ${grn.poNumber}. Vendor payment will be held.`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Material Received Successfully",
        description: `${receivedQuantity} units of ${grn.partCode} received and added to inventory`,
      });
    }
    
    onReceiveGRN(grn.id, receivedQuantity);
  };

  const filteredGRNs = grns
    .filter(grn => grn.status === "PENDING")
    .filter(grn => 
      grn.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      grn.partCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grn.poNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">IQC-Passed Material Receiving</h3>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search GRN, Part Code, or PO..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">Material Receiving Process</p>
            <p className="text-xs text-blue-700">
              Enter the actual quantity received. If less than expected, Purchase team will be notified and vendor payment will be held.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GRN No</TableHead>
              <TableHead>PO No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Part Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Expected Qty</TableHead>
              <TableHead>Received Qty</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGRNs.map((grn) => (
              <TableRow key={grn.id}>
                <TableCell className="font-medium">{grn.grnNumber}</TableCell>
                <TableCell className="font-medium text-blue-600">{grn.poNumber}</TableCell>
                <TableCell>{format(new Date(grn.date), "MMM dd, yyyy")}</TableCell>
                <TableCell className="font-mono">{grn.partCode}</TableCell>
                <TableCell>{grn.description}</TableCell>
                <TableCell>{grn.vendor}</TableCell>
                <TableCell className="font-medium">{grn.expectedQuantity}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    max={grn.expectedQuantity}
                    className="w-24"
                    value={quantityInputs[grn.id] || ""}
                    onChange={(e) => handleQuantityChange(grn.id, e.target.value)}
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleReceiveGRN(grn)}
                    disabled={!quantityInputs[grn.id] || parseInt(quantityInputs[grn.id]) <= 0}
                    className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Receive
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredGRNs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="mx-auto h-12 w-12 opacity-50 mb-4" />
          <p>No pending GRNs found matching your search criteria</p>
          <p className="text-sm">All materials have been received or are still in IQC</p>
        </div>
      )}
    </div>
  );
}
