
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreatePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { useToast } from "@/hooks/use-toast";

interface SelectedMaterial {
  id: string;
  material_code: string;
  name: string;
  quantity: number;
  current_stock: number;
}

export const ManualPOCreationDialog = () => {
  const [open, setOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [materialSearchTerm, setMaterialSearchTerm] = useState("");
  
  const createPO = useCreatePurchaseOrder();
  const { toast } = useToast();

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch raw materials with current inventory
  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['raw-materials-with-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_materials')
        .select(`
          *,
          inventory (
            quantity
          )
        `)
        .order('material_code');
      
      if (error) throw error;
      return data.map(material => ({
        ...material,
        current_stock: material.inventory?.[0]?.quantity || 0
      }));
    },
  });

  // Filter materials based on search term
  const filteredMaterials = rawMaterials.filter(material =>
    material.material_code.toLowerCase().includes(materialSearchTerm.toLowerCase()) ||
    material.name.toLowerCase().includes(materialSearchTerm.toLowerCase())
  );

  const handleAddMaterial = (material: any) => {
    if (selectedMaterials.find(m => m.id === material.id)) {
      toast({
        title: "Material Already Added",
        description: "This material is already in the PO",
        variant: "destructive",
      });
      return;
    }

    setSelectedMaterials([...selectedMaterials, {
      id: material.id,
      material_code: material.material_code,
      name: material.name,
      quantity: 1,
      current_stock: material.current_stock
    }]);
    setMaterialSearchTerm("");
  };

  const handleRemoveMaterial = (materialId: string) => {
    setSelectedMaterials(selectedMaterials.filter(m => m.id !== materialId));
  };

  const handleQuantityChange = (materialId: string, quantity: number) => {
    setSelectedMaterials(selectedMaterials.map(m =>
      m.id === materialId ? { ...m, quantity: Math.max(1, quantity) } : m
    ));
  };

  const handleCreatePO = async () => {
    if (!selectedVendor || selectedMaterials.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select vendor and at least one material",
        variant: "destructive",
      });
      return;
    }

    const items = selectedMaterials.map(material => ({
      raw_material_id: material.id,
      quantity: material.quantity,
      unit_price: 0,
    }));

    try {
      await createPO.mutateAsync({
        vendor_id: selectedVendor,
        items,
        notes: notes || 'Manual PO Creation',
        expected_delivery_date: deliveryDate,
      });

      // Reset form
      setOpen(false);
      setSelectedVendor("");
      setSelectedMaterials([]);
      setDeliveryDate("");
      setNotes("");
      setMaterialSearchTerm("");
    } catch (error) {
      console.error('Error creating manual PO:', error);
    }
  };

  const resetForm = () => {
    setSelectedVendor("");
    setSelectedMaterials([]);
    setDeliveryDate("");
    setNotes("");
    setMaterialSearchTerm("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Create Manual PO
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Create Manual Purchase Order
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Vendor and Delivery Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Vendor *</Label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name} ({vendor.vendor_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          {/* Material Search and Selection */}
          <div>
            <Label>Add Materials</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="Search materials by code or name..."
                value={materialSearchTerm}
                onChange={(e) => setMaterialSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            
            {/* Material Search Results */}
            {materialSearchTerm && (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
                {filteredMaterials.slice(0, 10).map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleAddMaterial(material)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{material.material_code}</div>
                      <div className="text-sm text-gray-600">{material.name}</div>
                      <div className="text-xs text-gray-500">
                        Current Stock: {material.current_stock}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {filteredMaterials.length === 0 && materialSearchTerm && (
                  <div className="p-3 text-center text-gray-500">
                    No materials found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Materials Table */}
          {selectedMaterials.length > 0 && (
            <div>
              <Label>Selected Materials ({selectedMaterials.length})</Label>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="w-16">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-mono">{material.material_code}</TableCell>
                      <TableCell>{material.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {material.current_stock}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={material.quantity}
                          onChange={(e) => handleQuantityChange(material.id, parseInt(e.target.value) || 1)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveMaterial(material.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the PO (optional)"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreatePO} 
              disabled={createPO.isPending || !selectedVendor || selectedMaterials.length === 0}
            >
              {createPO.isPending ? "Creating..." : `Create PO (${selectedMaterials.length} items)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
