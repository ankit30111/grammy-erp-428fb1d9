import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useToast } from "@/hooks/use-toast";
import { useCreateGRN } from "@/hooks/useGRN";
import GRNFormHeader from "./GRNFormHeader";
import GRNFormInputs from "./GRNFormInputs";
import GRNItemsTable from "./GRNItemsTable";

interface GRNItem {
  /** The PO line this receipt is against. Without it the PO's received/pending
   *  tracking cannot update - recalc_po_item_received returns early on NULL. */
  purchase_order_item_id: string;
  part_id: string;
  part_code: string;
  material_name: string;
  po_quantity: number;
  received_quantity: number;
  pending_quantity: number;
}

const GRNForm = () => {
  const [selectedPO, setSelectedPO] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [grnItems, setGRNItems] = useState<GRNItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: purchaseOrders, refetch: refetchPOs, isLoading } = usePurchaseOrders();
  const { toast } = useToast();
  const createGRNMutation = useCreateGRN();

  const handlePOSelection = (poId: string) => {
    setSelectedPO(poId);
    const po = purchaseOrders?.find(p => p.id === poId);
    if (po?.purchase_order_items) {
      const items: GRNItem[] = po.purchase_order_items
        .filter(item => (item.pending_quantity || item.quantity) > 0) // Only show items with pending quantities
        .map(item => ({
          purchase_order_item_id: item.id,
          part_id: item.part_id,
          part_code: item.parts?.part_code || '',
          material_name: item.parts?.name || '',
          po_quantity: item.quantity,
          received_quantity: 0,
          pending_quantity: item.pending_quantity || item.quantity
        }));
      setGRNItems(items);
      
      if (items.length === 0) {
        toast({
          title: "No Pending Items",
          description: "All items in this purchase order have been fully received.",
          variant: "destructive",
        });
      }
    }
  };

  const updateReceivedQuantity = (index: number, quantity: number) => {
    const updatedItems = [...grnItems];
    const maxReceivable = updatedItems[index].pending_quantity;
    
    if (quantity > maxReceivable) {
      toast({
        title: "Invalid Quantity",
        description: `Cannot receive more than ${maxReceivable} items. Only ${maxReceivable} items are pending for this material.`,
        variant: "destructive",
      });
      return;
    }
    
    updatedItems[index].received_quantity = quantity;
    setGRNItems(updatedItems);
  };

  const handleSubmit = async () => {
    if (!selectedPO || !invoiceNumber || grnItems.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select PO, enter invoice number and add items",
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
      const selectedPOData = purchaseOrders?.find(p => p.id === selectedPO);
      
      // Prepare data for the mutation
      const grnData = {
        purchase_order_id: selectedPO,
        vendor_id: selectedPOData?.vendor_id || '',
        received_date: receivedDate,
        notes: `Invoice Number: ${invoiceNumber}`,
        items: grnItems.filter(item => item.received_quantity > 0).map(item => ({
          purchase_order_item_id: item.purchase_order_item_id,
          part_id: item.part_id,
          received_quantity: item.received_quantity
        }))
      };

      console.log('Submitting GRN data:', grnData);
      
      await createGRNMutation.mutateAsync(grnData);

      // Reset form on success
      setSelectedPO("");
      setInvoiceNumber("");
      setGRNItems([]);
      setReceivedDate(new Date().toISOString().split('T')[0]);

      // Refresh PO data to update pending quantities
      refetchPOs();

    } catch (error) {
      console.error('Error in GRN submission:', error);
      // Error handling is done by the mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enhanced filtering for available POs - only show APPROVED POs that have items with pending quantities > 0
  const availablePOs = purchaseOrders?.filter(po => {
    // Check if PO status is APPROVED (removed SENT from the list)
    const validStatus = po.status === 'APPROVED';
    
    // Check if PO has any items with pending quantities
    const hasPendingItems = po.purchase_order_items?.some((item: any) => {
      const pending = item.pending_quantity || item.quantity;
      return pending > 0;
    });
    
    return validStatus && hasPendingItems;
  }) || [];

  console.log('Available POs for GRN:', availablePOs);
  console.log('Total Available PO count:', availablePOs.length);
  console.log('All POs:', purchaseOrders?.length);

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
          invoiceNumber={invoiceNumber}
          onInvoiceNumberChange={setInvoiceNumber}
          receivedDate={receivedDate}
          onReceivedDateChange={setReceivedDate}
          availablePOs={availablePOs}
          onRefresh={() => refetchPOs()}
          isLoading={isLoading}
        />

        {grnItems.length > 0 && (
          <GRNItemsTable
            grnItems={grnItems}
            onQuantityUpdate={updateReceivedQuantity}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            invoiceNumber={invoiceNumber}
          />
        )}

        {selectedPO && grnItems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="bg-warning-wash border border-warning/30 rounded-lg p-4">
              <p className="text-warning font-medium">No pending items found for selected PO</p>
              <p className="text-warning text-sm mt-1">All items in this purchase order may have been fully received.</p>
            </div>
          </div>
        )}

        {!selectedPO && (
          <div className="text-center py-8 text-muted-foreground">
            {isLoading ? (
              <div className="bg-accent border border-primary/30 rounded-lg p-4">
                <p className="text-primary">Loading purchase orders...</p>
              </div>
            ) : availablePOs.length === 0 ? (
              <div className="bg-warning-wash border border-warning/30 rounded-lg p-4">
                <p className="text-warning font-medium">No approved purchase orders available for GRN creation</p>
                <p className="text-warning text-sm mt-1">
                  Purchase orders must be approved and have pending items to receive.
                </p>
                <p className="text-warning text-sm">
                  Total POs in system: {purchaseOrders?.length || 0} | 
                  Go to <strong>Approvals</strong> page to approve pending purchase orders.
                </p>
              </div>
            ) : (
              <div className="bg-muted border border-border rounded-lg p-4">
                <p className="text-foreground font-medium">Select a Purchase Order to begin creating GRN</p>
                <p className="text-muted-foreground text-sm mt-1">{availablePOs.length} approved purchase orders available</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GRNForm;
