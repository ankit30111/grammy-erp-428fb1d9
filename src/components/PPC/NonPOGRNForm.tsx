import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus } from 'lucide-react';
import { VendorDropdown } from './VendorDropdown';
import { RawMaterialDropdown } from './RawMaterialDropdown';
import { useCreateGRN } from '@/hooks/useGRN';
import { useToast } from '@/hooks/use-toast';
import { useRawMaterials } from '@/hooks/useRawMaterials';

interface NonPOGRNItem {
  id: string;
  raw_material_id: string;
  expected_quantity: number;
  received_quantity: number;
}

export const NonPOGRNForm = () => {
  const [vendorId, setVendorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<NonPOGRNItem[]>([]);
  const [newItem, setNewItem] = useState({
    raw_material_id: '',
    expected_quantity: 0,
    received_quantity: 0,
  });

  const { mutate: createGRN, isPending } = useCreateGRN();
  const { toast } = useToast();
  const { rawMaterials } = useRawMaterials();

  const addItem = () => {
    if (!newItem.raw_material_id || newItem.expected_quantity <= 0) {
      toast({
        title: "Invalid Item",
        description: "Please select a material and enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    const materialExists = items.some(item => item.raw_material_id === newItem.raw_material_id);
    if (materialExists) {
      toast({
        title: "Duplicate Material",
        description: "This material has already been added",
        variant: "destructive",
      });
      return;
    }

    const item: NonPOGRNItem = {
      id: Date.now().toString(),
      raw_material_id: newItem.raw_material_id,
      expected_quantity: newItem.expected_quantity,
      received_quantity: newItem.received_quantity || newItem.expected_quantity,
    };

    setItems(prev => [...prev, item]);
    setNewItem({
      raw_material_id: '',
      expected_quantity: 0,
      received_quantity: 0,
    });
  };

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const updateItemQuantity = (itemId: string, field: 'expected_quantity' | 'received_quantity', value: number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async () => {
    if (!vendorId) {
      toast({
        title: "Missing Vendor",
        description: "Please select a vendor",
        variant: "destructive",
      });
      return;
    }

    if (!invoiceNumber) {
      toast({
        title: "Missing Invoice",
        description: "Please enter an invoice number",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "No Items",
        description: "Please add at least one material item",
        variant: "destructive",
      });
      return;
    }

    const hasReceivedItems = items.some(item => item.received_quantity > 0);
    if (!hasReceivedItems) {
      toast({
        title: "No Received Items",
        description: "Please enter received quantities for at least one item",
        variant: "destructive",
      });
      return;
    }

    const grnData = {
      vendor_id: vendorId,
      received_date: receivedDate,
      notes: `Invoice Number: ${invoiceNumber} (Non-PO GRN)`,
      items: items.filter(item => item.received_quantity > 0).map(item => ({
        raw_material_id: item.raw_material_id,
        expected_quantity: item.expected_quantity,
        received_quantity: item.received_quantity,
      })),
    };

    createGRN(grnData, {
      onSuccess: () => {
        // Reset form
        setVendorId('');
        setInvoiceNumber('');
        setReceivedDate(new Date().toISOString().split('T')[0]);
        setItems([]);
        setNewItem({
          raw_material_id: '',
          expected_quantity: 0,
          received_quantity: 0,
        });
      },
    });
  };

  const getMaterialInfo = (materialId: string) => {
    return rawMaterials.find(m => m.id === materialId);
  };

  const selectedMaterialIds = items.map(item => item.raw_material_id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create GRN Without Purchase Order</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor *</Label>
            <VendorDropdown
              value={vendorId}
              onValueChange={setVendorId}
              placeholder="Select vendor"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice">Invoice Number *</Label>
            <Input
              id="invoice"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Enter invoice number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Received Date *</Label>
            <Input
              id="date"
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
          </div>
        </div>

        {/* Add New Item */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Material</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Material *</Label>
                <RawMaterialDropdown
                  value={newItem.raw_material_id}
                  onValueChange={(value) => setNewItem(prev => ({ ...prev, raw_material_id: value }))}
                  excludeIds={selectedMaterialIds}
                  placeholder="Select material"
                />
              </div>
              <div className="space-y-2">
                <Label>Expected Qty *</Label>
                <Input
                  type="number"
                  min="1"
                  value={newItem.expected_quantity || ''}
                  onChange={(e) => setNewItem(prev => ({ 
                    ...prev, 
                    expected_quantity: parseInt(e.target.value) || 0 
                  }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Received Qty</Label>
                <Input
                  type="number"
                  min="0"
                  value={newItem.received_quantity || ''}
                  onChange={(e) => setNewItem(prev => ({ 
                    ...prev, 
                    received_quantity: parseInt(e.target.value) || 0 
                  }))}
                  placeholder="Auto-fill from expected"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Table */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Materials ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Expected Qty</TableHead>
                    <TableHead>Received Qty</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const material = getMaterialInfo(item.raw_material_id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{material?.material_code}</TableCell>
                        <TableCell>{material?.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.expected_quantity}
                            onChange={(e) => updateItemQuantity(item.id, 'expected_quantity', parseInt(e.target.value) || 0)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={item.expected_quantity}
                            value={item.received_quantity}
                            onChange={(e) => updateItemQuantity(item.id, 'received_quantity', parseInt(e.target.value) || 0)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex justify-end mt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={isPending || items.length === 0}
                  className="min-w-[120px]"
                >
                  {isPending ? "Creating..." : "Create GRN"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No materials added yet</p>
            <p className="text-sm">Add materials above to create the GRN</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};