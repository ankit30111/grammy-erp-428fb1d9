
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, AlertTriangle, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EnhancedGRNReceivingProps {
  onReceiveGRN?: (id: string, quantity: number) => void;
  onDiscrepancyReport?: (grnId: string, expectedQty: number, receivedQty: number, poNumber: string) => void;
}

export default function EnhancedGRNReceiving({ 
  onReceiveGRN, 
  onDiscrepancyReport 
}: EnhancedGRNReceivingProps) {
  const { toast } = useToast();
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch IQC approved materials pending store acceptance
  const { data: pendingGRNItems = [], isLoading } = useQuery({
    queryKey: ["pending-store-grn"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grn_items")
        .select(`
          *,
          grn!inner(
            grn_number,
            vendors(name),
            purchase_orders(po_number)
          ),
          raw_materials!inner(material_code, name)
        `)
        .eq("iqc_status", "ACCEPTED")
        .eq("store_confirmed", false);
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleQuantityChange = (id: string, value: string) => {
    setQuantityInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleReceiveGRN = async (item: any) => {
    const receivedQuantity = parseInt(quantityInputs[item.id] || "0");
    
    if (receivedQuantity <= 0 || receivedQuantity > item.accepted_quantity) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity within approved limits",
        variant: "destructive"
      });
      return;
    }

    try {
      // Update GRN item to mark as store confirmed
      const { error: grnError } = await supabase
        .from("grn_items")
        .update({
          store_confirmed: true,
          store_confirmed_by: (await supabase.auth.getUser()).data.user?.id,
          store_confirmed_at: new Date().toISOString()
        })
        .eq("id", item.id);

      if (grnError) throw grnError;

      // Check if inventory record exists for this material
      const { data: existingInventory } = await supabase
        .from("inventory")
        .select("*")
        .eq("raw_material_id", item.raw_material_id)
        .maybeSingle();

      if (existingInventory) {
        // Update existing inventory
        const { error: inventoryError } = await supabase
          .from("inventory")
          .update({
            quantity: existingInventory.quantity + receivedQuantity,
            last_updated: new Date().toISOString()
          })
          .eq("raw_material_id", item.raw_material_id);

        if (inventoryError) throw inventoryError;
      } else {
        // Create new inventory record
        const { error: inventoryError } = await supabase
          .from("inventory")
          .insert({
            raw_material_id: item.raw_material_id,
            quantity: receivedQuantity,
            last_updated: new Date().toISOString()
          });

        if (inventoryError) throw inventoryError;
      }

      toast({
        title: "Material Received Successfully",
        description: `${receivedQuantity} units of ${item.raw_materials.material_code} received and added to inventory`,
      });

      // Clear the input and trigger refetch
      setQuantityInputs(prev => ({ ...prev, [item.id]: "" }));
      
      // Call the callback if provided
      if (onReceiveGRN) {
        onReceiveGRN(item.id, receivedQuantity);
      }

    } catch (error) {
      console.error("Error receiving material:", error);
      toast({
        title: "Error",
        description: "Failed to receive material",
        variant: "destructive",
      });
    }
  };

  const filteredGRNItems = pendingGRNItems.filter(item => 
    item.grn?.grn_number?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.raw_materials?.material_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.grn?.purchase_orders?.po_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          Loading IQC approved materials...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">IQC-Approved Material Receiving</h3>
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
              These materials have passed IQC inspection. Verify and confirm receipt to update inventory.
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
              <TableHead>Part Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Approved Qty</TableHead>
              <TableHead>Received Qty</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGRNItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.grn?.grn_number}</TableCell>
                <TableCell className="font-medium text-blue-600">{item.grn?.purchase_orders?.po_number}</TableCell>
                <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                <TableCell>{item.raw_materials?.name}</TableCell>
                <TableCell>{item.grn?.vendors?.name}</TableCell>
                <TableCell className="font-medium text-green-600">{item.accepted_quantity}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="1"
                    max={item.accepted_quantity}
                    className="w-24"
                    value={quantityInputs[item.id] || ""}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    placeholder={item.accepted_quantity?.toString()}
                  />
                </TableCell>
                <TableCell>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleReceiveGRN(item)}
                    disabled={!quantityInputs[item.id] || parseInt(quantityInputs[item.id]) <= 0}
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

      {filteredGRNItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="mx-auto h-12 w-12 opacity-50 mb-4" />
          <p>No IQC approved materials pending store acceptance</p>
          <p className="text-sm">All materials have been received or are still in IQC</p>
        </div>
      )}
    </div>
  );
}
