
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  vendors?: { name: string };
  total_amount?: number;
  status: string;
  purchase_order_items?: any[];
}

interface GRNFormInputsProps {
  selectedPO: string;
  onPOSelection: (poId: string) => void;
  invoiceNumber: string;
  onInvoiceNumberChange: (invoice: string) => void;
  receivedDate: string;
  onReceivedDateChange: (date: string) => void;
  availablePOs: PurchaseOrder[];
  onRefresh: () => void;
  isLoading: boolean;
}

const GRNFormInputs = ({
  selectedPO,
  onPOSelection,
  invoiceNumber,
  onInvoiceNumberChange,
  receivedDate,
  onReceivedDateChange,
  availablePOs,
  onRefresh,
  isLoading
}: GRNFormInputsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="space-y-2">
        <Label htmlFor="po-select">Purchase Order</Label>
        <div className="flex gap-2">
          <Select value={selectedPO} onValueChange={onPOSelection}>
            <SelectTrigger>
              <SelectValue placeholder="Select PO" />
            </SelectTrigger>
            <SelectContent>
              {availablePOs.map((po) => (
                <SelectItem key={po.id} value={po.id}>
                  {po.po_number} - {po.vendors?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invoice-number">Invoice Number</Label>
        <Input
          id="invoice-number"
          type="text"
          value={invoiceNumber}
          onChange={(e) => onInvoiceNumberChange(e.target.value)}
          placeholder="Enter invoice number"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="received-date">Date of Receiving</Label>
        <Input
          id="received-date"
          type="date"
          value={receivedDate}
          onChange={(e) => onReceivedDateChange(e.target.value)}
        />
      </div>

      <div className="flex items-end">
        {selectedPO && (
          <div className="text-sm text-muted-foreground">
            Selected PO: {availablePOs.find(po => po.id === selectedPO)?.po_number}
          </div>
        )}
      </div>
    </div>
  );
};

export default GRNFormInputs;
