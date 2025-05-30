
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Plus, Trash2 } from "lucide-react";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GRNItem {
  raw_material_id: string;
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
  
  const { data: purchaseOrders } = usePurchaseOrders();
  const { toast } = useToast();

  const handlePOSelection = (poId: string) => {
    setSelectedPO(poId);
    const po = purchaseOrders?.find(p => p.id === poId);
    if (po?.purchase_order_items) {
      const items: GRNItem[] = po.purchase_order_items.map(item => ({
        raw_material_id: item.raw_material_id,
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

    setIsSubmitting(true);
    try {
      // Create GRN
      const selectedPOData = purchaseOrders?.find(p => p.id === selectedPO);
      const { data: grn, error: grnError } = await supabase
        .from('grn')
        .insert({
          purchase_order_id: selectedPO,
          vendor_id: selectedPOData?.vendor_id,
          received_date: receivedDate,
          status: 'RECEIVED',
          notes: `Bill Number: ${billNumber}`
        })
        .select()
        .single();

      if (grnError) throw grnError;

      // Create GRN items
      const grnItemsData = grnItems.map(item => ({
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

  const pendingPOs = purchaseOrders?.filter(po => po.status !== 'COMPLETED') || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Create GRN (Goods Receipt Note)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="po-select">Purchase Order</Label>
            <Select value={selectedPO} onValueChange={handlePOSelection}>
              <SelectTrigger>
                <SelectValue placeholder="Select PO" />
              </SelectTrigger>
              <SelectContent>
                {pendingPOs.map((po) => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.po_number} - {po.vendors?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <h3 className="text-lg font-medium mb-4">GRN Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>PO Quantity</TableHead>
                  <TableHead>Received Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grnItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.material_name}</TableCell>
                    <TableCell>{item.po_quantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max={item.po_quantity}
                        value={item.received_quantity}
                        onChange={(e) => updateReceivedQuantity(index, parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end mt-4">
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !billNumber}
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
      </CardContent>
    </Card>
  );
};

export default GRNForm;
