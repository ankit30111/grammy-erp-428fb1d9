import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Package, FileText, Wrench } from "lucide-react";

interface BatchItem {
  id: string;
  product_id?: string;
  brand_name: string;
  quantity_received: number;
  item_type: 'PRODUCT' | 'DATA' | 'PART';
  part_description?: string;
  notes?: string;
}

const BatchReceiptEntry = () => {
  const [formData, setFormData] = useState({
    customer_id: "",
    bill_number: "",
    receipt_date: new Date().toISOString().split('T')[0],
    purchase_date: "",
    receipt_type: "COMPLETE_PRODUCTS" as "COMPLETE_PRODUCTS" | "DATA_ONLY" | "FAULTY_PARTS_ONLY",
    notes: ""
  });

  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: "",
    brand_name: "",
    quantity_received: 1,
    item_type: "PRODUCT" as "PRODUCT" | "DATA" | "PART",
    part_description: "",
    notes: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, product_code")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Create batch mutation
  const createBatchMutation = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      // Create batch
      const { data: batch, error: batchError } = await supabase
        .from("customer_complaint_batches")
        .insert({
          customer_id: formData.customer_id,
          bill_number: formData.bill_number,
          receipt_date: formData.receipt_date,
          purchase_date: formData.purchase_date || null,
          receipt_type: formData.receipt_type,
          notes: formData.notes || null,
          created_by: user.data.user.id,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Create batch items
      const itemsData = batchItems.map(item => ({
        batch_id: batch.id,
        product_id: item.product_id || null,
        brand_name: item.brand_name,
        quantity_received: item.quantity_received,
        item_type: item.item_type,
        part_description: item.part_description || null,
        notes: item.notes || null
      }));

      const { error: itemsError } = await supabase
        .from("customer_complaint_batch_items")
        .insert(itemsData);

      if (itemsError) throw itemsError;

      // Create individual complaints using the database function
      const { error: complaintsError } = await supabase.rpc('create_complaints_from_batch', {
        p_batch_id: batch.id
      });

      if (complaintsError) throw complaintsError;

      return batch;
    },
    onSuccess: (batch) => {
      toast({
        title: "Success",
        description: `Receipt created successfully with ${batchItems.reduce((acc, item) => acc + item.quantity_received, 0)} individual complaints`,
      });
      queryClient.invalidateQueries({ queryKey: ["customer-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["complaint-batches"] });
      
      // Reset form
      setFormData({
        customer_id: "",
        bill_number: "",
        receipt_date: new Date().toISOString().split('T')[0],
        purchase_date: "",
        receipt_type: "COMPLETE_PRODUCTS",
        notes: ""
      });
      setBatchItems([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create batch",
        variant: "destructive",
      });
    },
  });

  const addBatchItem = () => {
    if (!currentItem.brand_name || currentItem.quantity_received <= 0) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    if (currentItem.item_type === 'PRODUCT' && !currentItem.product_id) {
      toast({
        title: "Error",
        description: "Please select a product",
        variant: "destructive",
      });
      return;
    }

    if (currentItem.item_type === 'PART' && !currentItem.part_description) {
      toast({
        title: "Error",
        description: "Please provide part description",
        variant: "destructive",
      });
      return;
    }

    const newItem: BatchItem = {
      id: Date.now().toString(),
      ...currentItem,
      product_id: currentItem.item_type === 'PRODUCT' ? currentItem.product_id : undefined
    };

    setBatchItems(prev => [...prev, newItem]);
    setCurrentItem({
      product_id: "",
      brand_name: "",
      quantity_received: 1,
      item_type: formData.receipt_type === 'COMPLETE_PRODUCTS' ? 'PRODUCT' : 
                formData.receipt_type === 'DATA_ONLY' ? 'DATA' : 'PART',
      part_description: "",
      notes: ""
    });
  };

  const removeBatchItem = (id: string) => {
    setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (batchItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the batch",
        variant: "destructive",
      });
      return;
    }

    createBatchMutation.mutate();
  };

  const getReceiptTypeIcon = (type: string) => {
    switch (type) {
      case 'COMPLETE_PRODUCTS':
        return <Package className="h-4 w-4" />;
      case 'DATA_ONLY':
        return <FileText className="h-4 w-4" />;
      case 'FAULTY_PARTS_ONLY':
        return <Wrench className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getItemTypeDisplay = (item: BatchItem) => {
    if (item.item_type === 'PRODUCT') {
      const product = products.find(p => p.id === item.product_id);
      return product ? `${product.name} (${product.product_code})` : 'Unknown Product';
    }
    if (item.item_type === 'PART') {
      return item.part_description || 'Part';
    }
    return 'Data Only';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getReceiptTypeIcon(formData.receipt_type)}
            Batch Receipt Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Name *</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Bill Number *</Label>
                <Input
                  value={formData.bill_number}
                  onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Receipt Date *</Label>
                <Input
                  type="date"
                  value={formData.receipt_date}
                  onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Receipt Type *</Label>
                <Select
                  value={formData.receipt_type}
                  onValueChange={(value: any) => {
                    setFormData({ ...formData, receipt_type: value });
                    // Reset current item type based on receipt type
                    setCurrentItem(prev => ({
                      ...prev,
                      item_type: value === 'COMPLETE_PRODUCTS' ? 'PRODUCT' : 
                                value === 'DATA_ONLY' ? 'DATA' : 'PART'
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLETE_PRODUCTS">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Complete Products
                      </div>
                    </SelectItem>
                    <SelectItem value="DATA_ONLY">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Data Only
                      </div>
                    </SelectItem>
                    <SelectItem value="FAULTY_PARTS_ONLY">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Faulty Parts Only
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this batch..."
              />
            </div>

            {/* Add Items Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Add Items to Batch</h3>
              <div className="grid grid-cols-12 gap-4 items-end">
                {formData.receipt_type === 'COMPLETE_PRODUCTS' && (
                  <div className="col-span-3">
                    <Label>Product *</Label>
                    <Select
                      value={currentItem.product_id}
                      onValueChange={(value) => setCurrentItem({ ...currentItem, product_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.product_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.receipt_type === 'FAULTY_PARTS_ONLY' && (
                  <div className="col-span-3">
                    <Label>Part Description *</Label>
                    <Input
                      value={currentItem.part_description}
                      onChange={(e) => setCurrentItem({ ...currentItem, part_description: e.target.value })}
                      placeholder="Describe the faulty part"
                    />
                  </div>
                )}

                <div className="col-span-3">
                  <Label>Brand Name *</Label>
                  <Input
                    value={currentItem.brand_name}
                    onChange={(e) => setCurrentItem({ ...currentItem, brand_name: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={currentItem.quantity_received}
                    onChange={(e) => setCurrentItem({ ...currentItem, quantity_received: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Input
                    value={currentItem.notes}
                    onChange={(e) => setCurrentItem({ ...currentItem, notes: e.target.value })}
                    placeholder="Item notes"
                  />
                </div>

                <div className="col-span-2">
                  <Button type="button" onClick={addBatchItem} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>
            </div>

            {/* Items List */}
            {batchItems.length > 0 && (
              <div>
                <h4 className="font-semibold mb-4">
                  Batch Items ({batchItems.length} items, {batchItems.reduce((acc, item) => acc + item.quantity_received, 0)} total quantity)
                </h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Product/Part</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Badge variant="outline">
                              {item.item_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{getItemTypeDisplay(item)}</TableCell>
                          <TableCell>{item.brand_name}</TableCell>
                          <TableCell>{item.quantity_received}</TableCell>
                          <TableCell className="max-w-xs truncate">{item.notes || '-'}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeBatchItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                type="submit" 
                disabled={createBatchMutation.isPending || batchItems.length === 0}
                className="gap-2"
              >
                {createBatchMutation.isPending ? "Creating..." : "Create Batch & Generate Complaints"}
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setFormData({
                  customer_id: "",
                  bill_number: "",
                  receipt_date: new Date().toISOString().split('T')[0],
                  purchase_date: "",
                  receipt_type: "COMPLETE_PRODUCTS",
                  notes: ""
                });
                setBatchItems([]);
              }}>
                Clear All
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchReceiptEntry;