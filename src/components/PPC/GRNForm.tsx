
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, RefreshCw } from "lucide-react";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GRNItem {
  raw_material_id: string;
  material_code: string;
  material_name: string;
  po_quantity: number;
  received_quantity: number;
}

const GRNForm = () => {
  const [selectedPO, setSelectedPO] = useState<string>("");
  const [billNumber, setBillNumber] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [grnItems, setGRNItems] = useState<GRNItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: purchaseOrders, refetch: refetchPOs, isLoading } = usePurchaseOrders();
  const { toast } = useToast();

  const handlePOSelection = (poId: string) => {
    setSelectedPO(poId);
    const po = purchaseOrders?.find(p => p.id === poId);
    if (po?.purchase_order_items) {
      const items: GRNItem[] = po.purchase_order_items.map(item => ({
        raw_material_id: item.raw_material_id,
        material_code: item.raw_materials?.material_code || '',
        material_name: item.raw_materials?.name || '',
        po_quantity: item.quantity,
        received_quantity: 0
      }));
      setGRNItems(items);
    }
  };

  const updateReceivedQuantity = (index: number, quantity: number) => {
    const updatedItems = [...grnItems];
    updatedItems[index].received_quantity = quantity;
    setGRNItems(updatedItems);
  };

  const handleSubmit = async () => {
    if (!selectedPO || !billNumber || grnItems.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select PO, enter bill number and add items",
        variant: "destructive",
      });
      return;
    }

    // Check if any items have been received
    const hasReceivedItems = grnItems.some(item => item.received_quantity > 0);
    
    if (!hasReceivedItems) {
      toast({
        title: "No items received",
        description: "Please enter received quantities for at least one item",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create GRN - let the trigger generate the grn_number
      const selectedPOData = purchaseOrders?.find(p => p.id === selectedPO);
      const { data: grn, error: grnError } = await supabase
        .from('grn')
        .insert({
          grn_number: '', // Empty string will be replaced by trigger
          purchase_order_id: selectedPO,
          vendor_id: selectedPOData?.vendor_id || '',
          received_date: receivedDate,
          status: 'RECEIVED',
          notes: `Bill Number: ${billNumber}`
        })
        .select()
        .single();

      if (grnError) throw grnError;

      // Create GRN items only for items that were actually received
      const receivedItems = grnItems.filter(item => item.received_quantity > 0);
      const grnItemsData = receivedItems.map(item => ({
        grn_id: grn.id,
        raw_material_id: item.raw_material_id,
        po_quantity: item.po_quantity,
        received_quantity: item.received_quantity,
        iqc_status: 'PENDING'
      }));

      const { error: itemsError } = await supabase
        .from('grn_items')
        .insert(grnItemsData);

      if (itemsError) throw itemsError;

      toast({
        title: "GRN Created",
        description: `GRN ${grn.grn_number} created successfully`,
      });

      // Reset form
      setSelectedPO("");
      setBillNumber("");
      setGRNItems([]);
      setReceivedDate(new Date().toISOString().split('T')[0]);

    } catch (error) {
      console.error('Error creating GRN:', error);
      toast({
        title: "Error",
        description: "Failed to create GRN",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter for purchase orders that can have GRNs created
  const availablePOs = purchaseOrders?.filter(po => 
    po.status === 'PENDING' || po.status === 'SENT' || po.status === 'APPROVED'
  ) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create GRN (Goods Receipt Note)
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPOs()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh POs
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="po-select">Purchase Order</Label>
            <Select value={selectedPO} onValueChange={handlePOSelection}>
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
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder="Enter bill number"
            />
          </div>

          <div>
            <Label htmlFor="received-date">Received Date</Label>
            <Input
              id="received-date"
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
          </div>
        </div>

        {grnItems.length > 0 && (
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
                        onChange={(e) => updateReceivedQuantity(index, parseInt(e.target.value) || 0)}
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
                onClick={handleSubmit}
                disabled={isSubmitting || !billNumber || grnItems.every(item => item.received_quantity === 0)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {isSubmitting ? "Creating..." : "Create GRN"}
              </Button>
            </div>
          </div>
        )}

        {selectedPO && grnItems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No items found for selected PO
          </div>
        )}

        {!selectedPO && (
          <div className="text-center py-8 text-muted-foreground">
            {availablePOs.length === 0 
              ? "No purchase orders available for GRN creation"
              : "Select a Purchase Order to begin creating GRN"
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GRNForm;
