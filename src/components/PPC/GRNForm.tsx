
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GRNFormHeader from "./GRNFormHeader";
import GRNFormInputs from "./GRNFormInputs";
import GRNItemsTable from "./GRNItemsTable";

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

  // Show ALL purchase orders, not just filtered ones
  const availablePOs = purchaseOrders || [];

  console.log('Available POs:', availablePOs);
  console.log('Total PO count:', availablePOs.length);

  return (
    <Card>
      <GRNFormHeader
        onRefresh={() => refetchPOs()}
        isLoading={isLoading}
      />
      <CardContent className="space-y-6">
        <GRNFormInputs
          selectedPO={selectedPO}
          onPOSelection={handlePOSelection}
          billNumber={billNumber}
          onBillNumberChange={setBillNumber}
          receivedDate={receivedDate}
          onReceivedDateChange={setReceivedDate}
          availablePOs={availablePOs}
        />

        {grnItems.length > 0 && (
          <GRNItemsTable
            grnItems={grnItems}
            onQuantityUpdate={updateReceivedQuantity}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            billNumber={billNumber}
          />
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
