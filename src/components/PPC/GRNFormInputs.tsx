
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="po-select">Purchase Order</Label>
          <div className="flex gap-2">
            <Select value={selectedPO} onValueChange={onPOSelection}>
              <SelectTrigger>
                <SelectValue placeholder={
                  availablePOs.length === 0 
                    ? "No POs available" 
                    : "Select PO"
                } />
              </SelectTrigger>
              <SelectContent>
                {availablePOs.map((po) => {
                  const pendingItemsCount = po.purchase_order_items?.filter((item: any) => 
                    (item.pending_quantity || item.quantity) > 0
                  ).length || 0;
                  
                  return (
                    <SelectItem key={po.id} value={po.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{po.po_number} - {po.vendors?.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {pendingItemsCount} pending item(s) • Status: {po.status}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh purchase orders"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {availablePOs.length === 0 && !isLoading && (
            <div className="flex items-center gap-1 text-xs text-orange-600">
              <AlertCircle className="h-3 w-3" />
              <span>No receivable POs found</span>
            </div>
          )}
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
            <div className="text-sm space-y-1">
              <div className="text-muted-foreground">
                Selected PO: <span className="font-medium text-foreground">
                  {availablePOs.find(po => po.id === selectedPO)?.po_number}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Vendor: {availablePOs.find(po => po.id === selectedPO)?.vendors?.name}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GRNFormInputs;
