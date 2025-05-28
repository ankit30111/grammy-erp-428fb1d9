
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
import { Plus, Truck, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  customer_code: string;
  name: string;
}

interface CustomerWarehouse {
  id: string;
  warehouse_name: string;
  address: string;
  contact_person?: string;
}

interface Product {
  id: string;
  product_code: string;
  name: string;
}

interface DispatchOrder {
  id: string;
  dispatch_order_number: string;
  customer_id: string;
  customer_warehouse_id: string;
  dispatch_date: string;
  status: string;
  notes?: string;
  customers: Customer;
  customer_warehouses: CustomerWarehouse;
  dispatch_order_items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    lot_number?: string;
    products: Product;
  }>;
}

const Dispatch = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<CustomerWarehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dispatchOrders, setDispatchOrders] = useState<DispatchOrder[]>([]);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const { toast } = useToast();

  const [orderForm, setOrderForm] = useState({
    customer_id: "",
    customer_warehouse_id: "",
    dispatch_date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  const [orderItems, setOrderItems] = useState<Array<{
    product_id: string;
    quantity: number;
    lot_number: string;
  }>>([]);

  const [currentItem, setCurrentItem] = useState({
    product_id: "",
    quantity: 1,
    lot_number: ""
  });

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchDispatchOrders();
  }, []);

  useEffect(() => {
    if (orderForm.customer_id) {
      fetchWarehouses(orderForm.customer_id);
    }
  }, [orderForm.customer_id]);

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

  const fetchWarehouses = async (customerId: string) => {
    const { data, error } = await supabase
      .from('customer_warehouses')
      .select('id, warehouse_name, address, contact_person')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('warehouse_name');
    
    if (error) {
      console.error('Error fetching warehouses:', error);
    } else {
      setWarehouses(data || []);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_code, name')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setProducts(data || []);
    }
  };

  const fetchDispatchOrders = async () => {
    const { data, error } = await supabase
      .from('dispatch_orders')
      .select(`
        id,
        dispatch_order_number,
        customer_id,
        customer_warehouse_id,
        dispatch_date,
        status,
        notes,
        customers:customer_id (
          id,
          customer_code,
          name
        ),
        customer_warehouses:customer_warehouse_id (
          id,
          warehouse_name,
          address,
          contact_person
        ),
        dispatch_order_items (
          id,
          product_id,
          quantity,
          lot_number,
          products:product_id (
            id,
            product_code,
            name
          )
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching dispatch orders:', error);
    } else {
      setDispatchOrders(data || []);
    }
  };

  const addItemToOrder = () => {
    if (!currentItem.product_id || currentItem.quantity <= 0) {
      toast({
        title: "Error",
        description: "Please select a product and enter a valid quantity",
        variant: "destructive"
      });
      return;
    }

    const existingItemIndex = orderItems.findIndex(item => item.product_id === currentItem.product_id);
    
    if (existingItemIndex >= 0) {
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += currentItem.quantity;
      setOrderItems(updatedItems);
    } else {
      setOrderItems([...orderItems, currentItem]);
    }

    setCurrentItem({
      product_id: "",
      quantity: 1,
      lot_number: ""
    });
  };

  const removeItemFromOrder = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleCreateDispatchOrder = async () => {
    if (!orderForm.customer_id || !orderForm.customer_warehouse_id || orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields and add at least one item",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create dispatch order - let the trigger generate the dispatch_order_number
      const { data: dispatchOrder, error: orderError } = await supabase
        .from('dispatch_orders')
        .insert({
          customer_id: orderForm.customer_id,
          customer_warehouse_id: orderForm.customer_warehouse_id,
          dispatch_date: orderForm.dispatch_date,
          notes: orderForm.notes,
          dispatch_order_number: '' // This will be auto-generated by trigger
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create dispatch order items
      const itemsToInsert = orderItems.map(item => ({
        dispatch_order_id: dispatchOrder.id,
        ...item
      }));

      const { error: itemsError } = await supabase
        .from('dispatch_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: "Dispatch order created successfully"
      });

      setIsCreatingOrder(false);
      setOrderForm({
        customer_id: "",
        customer_warehouse_id: "",
        dispatch_date: new Date().toISOString().split('T')[0],
        notes: ""
      });
      setOrderItems([]);
      fetchDispatchOrders();

    } catch (error) {
      console.error('Error creating dispatch order:', error);
      toast({
        title: "Error",
        description: "Failed to create dispatch order",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'DISPATCHED': return 'bg-blue-100 text-blue-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dispatch Management</h1>
          <Dialog open={isCreatingOrder} onOpenChange={setIsCreatingOrder}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Dispatch Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Dispatch Order</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer *</Label>
                    <Select value={orderForm.customer_id} onValueChange={(value) => setOrderForm({...orderForm, customer_id: value, customer_warehouse_id: ""})}>
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
                    <Label htmlFor="warehouse">Warehouse *</Label>
                    <Select value={orderForm.customer_warehouse_id} onValueChange={(value) => setOrderForm({...orderForm, customer_warehouse_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.warehouse_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dispatch_date">Dispatch Date *</Label>
                    <Input
                      id="dispatch_date"
                      type="date"
                      value={orderForm.dispatch_date}
                      onChange={(e) => setOrderForm({...orderForm, dispatch_date: e.target.value})}
                    />
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
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-4">Add Products</h3>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Product *</Label>
                      <Select value={currentItem.product_id} onValueChange={(value) => setCurrentItem({...currentItem, product_id: value})}>
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
                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={currentItem.quantity}
                        onChange={(e) => setCurrentItem({...currentItem, quantity: parseInt(e.target.value) || 1})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lot Number</Label>
                      <Input
                        value={currentItem.lot_number}
                        onChange={(e) => setCurrentItem({...currentItem, lot_number: e.target.value})}
                        placeholder="Optional"
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
                            <TableHead>Product</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Lot Number</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems.map((item, index) => {
                            const product = products.find(p => p.id === item.product_id);
                            return (
                              <TableRow key={index}>
                                <TableCell>{product?.name} ({product?.product_code})</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{item.lot_number || '-'}</TableCell>
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

                <Button onClick={handleCreateDispatchOrder} className="w-full">
                  Create Dispatch Order
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Dispatch Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Dispatch Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatchOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono">{order.dispatch_order_number}</TableCell>
                    <TableCell>{order.customers.name}</TableCell>
                    <TableCell>{order.customer_warehouses.warehouse_name}</TableCell>
                    <TableCell>{new Date(order.dispatch_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {order.dispatch_order_items.length} items
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

export default Dispatch;
