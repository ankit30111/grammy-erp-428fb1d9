
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  customer_code: string;
  name: string;
  email: string;
  contact_number: string;
  address: string;
  gst_number?: string;
  is_active: boolean;
}

interface CustomerWarehouse {
  id: string;
  customer_id: string;
  warehouse_name: string;
  address: string;
  contact_person?: string;
  contact_number?: string;
  is_active: boolean;
}

const CustomersManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<CustomerWarehouse[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);
  const { toast } = useToast();

  const [customerForm, setCustomerForm] = useState({
    customer_code: "",
    name: "",
    email: "",
    contact_number: "",
    address: "",
    gst_number: ""
  });

  const [warehouseForm, setWarehouseForm] = useState({
    warehouse_name: "",
    address: "",
    contact_person: "",
    contact_number: ""
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchWarehouses(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive"
      });
    } else {
      setCustomers(data || []);
    }
  };

  const fetchWarehouses = async (customerId: string) => {
    const { data, error } = await supabase
      .from('customer_warehouses')
      .select('*')
      .eq('customer_id', customerId)
      .order('warehouse_name');
    
    if (error) {
      console.error('Error fetching warehouses:', error);
    } else {
      setWarehouses(data || []);
    }
  };

  const handleCreateCustomer = async () => {
    if (!customerForm.customer_code || !customerForm.name || !customerForm.email) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from('customers')
      .insert([customerForm]);

    if (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "Failed to create customer",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Customer created successfully"
      });
      setIsAddingCustomer(false);
      setCustomerForm({
        customer_code: "",
        name: "",
        email: "",
        contact_number: "",
        address: "",
        gst_number: ""
      });
      fetchCustomers();
    }
  };

  const handleCreateWarehouse = async () => {
    if (!warehouseForm.warehouse_name || !warehouseForm.address || !selectedCustomerId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from('customer_warehouses')
      .insert([{
        ...warehouseForm,
        customer_id: selectedCustomerId
      }]);

    if (error) {
      console.error('Error creating warehouse:', error);
      toast({
        title: "Error",
        description: "Failed to create warehouse",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Warehouse created successfully"
      });
      setIsAddingWarehouse(false);
      setWarehouseForm({
        warehouse_name: "",
        address: "",
        contact_person: "",
        contact_number: ""
      });
      fetchWarehouses(selectedCustomerId);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Customer Management</h1>
          <Dialog open={isAddingCustomer} onOpenChange={setIsAddingCustomer}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_code">Customer Code *</Label>
                  <Input
                    id="customer_code"
                    value={customerForm.customer_code}
                    onChange={(e) => setCustomerForm({...customerForm, customer_code: e.target.value})}
                    placeholder="CUST001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({...customerForm, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({...customerForm, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_number">Contact Number</Label>
                  <Input
                    id="contact_number"
                    value={customerForm.contact_number}
                    onChange={(e) => setCustomerForm({...customerForm, contact_number: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({...customerForm, address: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst_number">GST Number</Label>
                  <Input
                    id="gst_number"
                    value={customerForm.gst_number}
                    onChange={(e) => setCustomerForm({...customerForm, gst_number: e.target.value})}
                  />
                </div>
                <Button onClick={handleCreateCustomer} className="w-full">
                  Create Customer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow 
                      key={customer.id}
                      className={selectedCustomerId === customer.id ? "bg-muted" : "cursor-pointer"}
                      onClick={() => setSelectedCustomerId(customer.id)}
                    >
                      <TableCell>{customer.customer_code}</TableCell>
                      <TableCell>{customer.name}</TableCell>
                      <TableCell>
                        <Badge variant={customer.is_active ? "default" : "secondary"}>
                          {customer.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Warehouses</span>
                {selectedCustomerId && (
                  <Dialog open={isAddingWarehouse} onOpenChange={setIsAddingWarehouse}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Warehouse
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New Warehouse</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="warehouse_name">Warehouse Name *</Label>
                          <Input
                            id="warehouse_name"
                            value={warehouseForm.warehouse_name}
                            onChange={(e) => setWarehouseForm({...warehouseForm, warehouse_name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="warehouse_address">Address *</Label>
                          <Textarea
                            id="warehouse_address"
                            value={warehouseForm.address}
                            onChange={(e) => setWarehouseForm({...warehouseForm, address: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact_person">Contact Person</Label>
                          <Input
                            id="contact_person"
                            value={warehouseForm.contact_person}
                            onChange={(e) => setWarehouseForm({...warehouseForm, contact_person: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="warehouse_contact">Contact Number</Label>
                          <Input
                            id="warehouse_contact"
                            value={warehouseForm.contact_number}
                            onChange={(e) => setWarehouseForm({...warehouseForm, contact_number: e.target.value})}
                          />
                        </div>
                        <Button onClick={handleCreateWarehouse} className="w-full">
                          Create Warehouse
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCustomerId ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouses.map((warehouse) => (
                      <TableRow key={warehouse.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{warehouse.warehouse_name}</div>
                            <div className="text-sm text-muted-foreground">{warehouse.address}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{warehouse.contact_person}</div>
                            <div className="text-muted-foreground">{warehouse.contact_number}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={warehouse.is_active ? "default" : "secondary"}>
                            {warehouse.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a customer to view their warehouses</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CustomersManagement;
