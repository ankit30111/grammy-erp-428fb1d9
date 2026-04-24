
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Wrench, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RawMaterialDropdown } from "@/components/PPC/RawMaterialDropdown";

interface Customer {
  id: string;
  customer_code: string;
  name: string;
}

interface RawMaterial {
  id: string;
  material_code: string;
  name: string;
  category: string;
}

interface SpareOrder {
  id: string;
  spare_order_number: string;
  customer_id: string;
  order_date: string;
  status: string;
  notes?: string;
  customers: Customer;
  spare_order_items: Array<{
    id: string;
    raw_material_id: string;
    quantity: number;
    raw_materials: RawMaterial;
  }>;
}

const SpareOrders = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [spareOrders, setSpareOrders] = useState<SpareOrder[]>([]);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const { toast } = useToast();

  const [orderForm, setOrderForm] = useState({
    customer_id: "",
    order_date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  const [orderItems, setOrderItems] = useState<Array<{
    raw_material_id: string;
    quantity: number;
  }>>([]);

  const [currentItem, setCurrentItem] = useState({
    raw_material_id: "",
    quantity: 1
  });

  useEffect(() => {
    fetchCustomers();
    fetchRawMaterials();
    fetchSpareOrders();
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, customer_code, name')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching customers:', error);
    } else {
      setCustomers(data || []);
    }
  };

  const fetchRawMaterials = async () => {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('id, material_code, name, category')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching raw materials:', error);
    } else {
      setRawMaterials(data || []);
    }
  };

  const fetchSpareOrders = async () => {
    const { data, error } = await supabase
      .from('spare_orders')
      .select(`
        id,
        spare_order_number,
        customer_id,
        order_date,
        status,
        notes,
        customers:customer_id (
          id,
          customer_code,
          name
        ),
        spare_order_items (
          id,
          raw_material_id,
          quantity,
          raw_materials:raw_material_id (
            id,
            material_code,
            name,
            category
          )
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching spare orders:', error);
    } else {
      setSpareOrders(data || []);
    }
  };

  const addItemToOrder = () => {
    if (!currentItem.raw_material_id || currentItem.quantity <= 0) {
      toast({
        title: "Error",
        description: "Please select a raw material and enter a valid quantity",
        variant: "destructive"
      });
      return;
    }

    const existingItemIndex = orderItems.findIndex(item => item.raw_material_id === currentItem.raw_material_id);
    
    if (existingItemIndex >= 0) {
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += currentItem.quantity;
      setOrderItems(updatedItems);
    } else {
      setOrderItems([...orderItems, currentItem]);
    }

    setCurrentItem({
      raw_material_id: "",
      quantity: 1
    });
  };

  const removeItemFromOrder = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleCreateSpareOrder = async () => {
    if (!orderForm.customer_id || orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields and add at least one item",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create spare order without product_id
      const { data: spareOrder, error: orderError } = await supabase
        .from('spare_orders')
        .insert({
          customer_id: orderForm.customer_id,
          order_date: orderForm.order_date,
          notes: orderForm.notes,
          spare_order_number: '' // This will be auto-generated by trigger
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create spare order items
      const itemsToInsert = orderItems.map(item => ({
        spare_order_id: spareOrder.id,
        ...item
      }));

      const { error: itemsError } = await supabase
        .from('spare_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: "Spare order created successfully"
      });

      setIsCreatingOrder(false);
      setOrderForm({
        customer_id: "",
        order_date: new Date().toISOString().split('T')[0],
        notes: ""
      });
      setOrderItems([]);
      fetchSpareOrders();

    } catch (error) {
      console.error('Error creating spare order:', error);
      toast({
        title: "Error",
        description: "Failed to create spare order",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'PACKED': return 'bg-blue-100 text-blue-800';
      case 'DISPATCHED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Spare Orders Management</h1>
          <Dialog open={isCreatingOrder} onOpenChange={setIsCreatingOrder}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Spare Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Spare Order</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer *</Label>
                    <Select value={orderForm.customer_id} onValueChange={(value) => setOrderForm({...orderForm, customer_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} ({customer.customer_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order_date">Order Date *</Label>
                    <Input
                      id="order_date"
                      type="date"
                      value={orderForm.order_date}
                      onChange={(e) => setOrderForm({...orderForm, order_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm({...orderForm, notes: e.target.value})}
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-4">Add Spare Parts</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Raw Material / Spare Part *</Label>
                      <RawMaterialDropdown
                        value={currentItem.raw_material_id}
                        onValueChange={(value) => setCurrentItem({ ...currentItem, raw_material_id: value })}
                        placeholder="Search by part name or code..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={currentItem.quantity}
                        onChange={(e) => setCurrentItem({...currentItem, quantity: parseInt(e.target.value) || 1})}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={addItemToOrder} className="w-full">
                        Add Item
                      </Button>
                    </div>
                  </div>

                  {orderItems.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Order Items</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Spare Part</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems.map((item, index) => {
                            const material = rawMaterials.find(m => m.id === item.raw_material_id);
                            return (
                              <TableRow key={index}>
                                <TableCell>
                                  {material ? `${material.name} (${material.material_code})` : 'Material not found'}
                                </TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItemFromOrder(index)}
                                  >
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <Button onClick={handleCreateSpareOrder} className="w-full">
                  Create Spare Order
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Spare Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spareOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono">{order.spare_order_number}</TableCell>
                    <TableCell>{order.customers?.name || 'Unknown Customer'}</TableCell>
                    <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {order.spare_order_items?.length || 0} items
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SpareOrders;
