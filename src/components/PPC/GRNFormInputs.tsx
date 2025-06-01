
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  vendors?: {
    name: string;
  };
}

interface GRNFormInputsProps {
  selectedPO: string;
  onPOSelection: (poId: string) => void;
  billNumber: string;
  onBillNumberChange: (value: string) => void;
  receivedDate: string;
  onReceivedDateChange: (value: string) => void;
  availablePOs: PurchaseOrder[];
}

const GRNFormInputs = ({
  selectedPO,
  onPOSelection,
  billNumber,
  onBillNumberChange,
  receivedDate,
  onReceivedDateChange,
  availablePOs
}: GRNFormInputsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <Label htmlFor="po-select">Purchase Order</Label>
        <Select value={selectedPO} onValueChange={onPOSelection}>
          <SelectTrigger>
            <SelectValue placeholder={availablePOs.length === 0 ? "No purchase orders available" : "Select PO"} />
          </SelectTrigger>
          <SelectContent>
            {availablePOs.map((po) => (
              <SelectItem key={po.id} value={po.id}>
                {po.po_number} - {po.vendors?.name} ({po.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {availablePOs.length === 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            Create purchase orders first to generate GRNs
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="bill-number">Bill Number</Label>
        <Input
          id="bill-number"
          value={billNumber}
          onChange={(e) => onBillNumberChange(e.target.value)}
          placeholder="Enter bill number"
        />
      </div>

      <div>
        <Label htmlFor="received-date">Received Date</Label>
        <Input
          id="received-date"
          type="date"
          value={receivedDate}
          onChange={(e) => onReceivedDateChange(e.target.value)}
        />
      </div>
    </div>
  );
};

export default GRNFormInputs;
