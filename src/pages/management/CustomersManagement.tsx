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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, MapPin, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCustomerForm } from "@/hooks/useCustomerForm";

interface Customer {
  id: string;
  customer_code: string;
  name: string;
  brand_name?: string;
  contact_person_name?: string;
  email: string;
  contact_number: string;
  address: string;
  gst_number?: string;
  bank_account_number?: string;
  ifsc_code?: string;
  gst_certificate_url?: string;
  msme_certificate_url?: string;
  brand_authorization_url?: string;
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
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { toast } = useToast();

  // Use the new customer form hook
  const {
    formData,
    validationErrors,
    isSubmitting,
    handleSubmit,
    handleUpdate,
    updateFormField,
    setFormData,
    resetForm
  } = useCustomerForm();

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
    } else {
      setWarehouses([]);
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
    const result = await handleSubmit();
    if (result.success) {
      setIsAddingCustomer(false);
      fetchCustomers();
    }
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return;
    
    const result = await handleUpdate(editingCustomer.id);
    if (result.success) {
      setIsEditingCustomer(false);
      setEditingCustomer(null);
      fetchCustomers();
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', customerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer deleted successfully"
      });
      
      fetchCustomers();
      if (selectedCustomerId === customerId) {
        setSelectedCustomerId("");
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive"
      });
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

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      brand_name: customer.brand_name || "",
      contact_person_name: customer.contact_person_name || "",
      email: customer.email,
      contact_number: customer.contact_number,
      address: customer.address,
      gst_number: customer.gst_number || "",
      bank_account_number: customer.bank_account_number || "",
      ifsc_code: customer.ifsc_code || "",
      gst_certificate: null,
      msme_certificate: null,
      brand_authorization: null
    });
    setIsEditingCustomer(true);
  };

  const CustomerFormFields = () => (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Customer Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateFormField('name', e.target.value)}
            placeholder="Enter customer name"
            className={validationErrors.name ? "border-destructive" : ""}
          />
          {validationErrors.name && (
            <p className="text-sm text-destructive">{validationErrors.name}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand_name">Brand Name</Label>
          <Input
            id="brand_name"
            value={formData.brand_name}
            onChange={(e) => updateFormField('brand_name', e.target.value)}
            placeholder="Enter brand name"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact_person_name">Contact Person Name</Label>
          <Input
            id="contact_person_name"
            value={formData.contact_person_name}
            onChange={(e) => updateFormField('contact_person_name', e.target.value)}
            placeholder="Enter contact person name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_number">Contact Number</Label>
          <Input
            id="contact_number"
            value={formData.contact_number}
            onChange={(e) => updateFormField('contact_number', e.target.value)}
            placeholder="+91-9876543210"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Contact Email ID</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => updateFormField('email', e.target.value)}
          placeholder="customer@example.com"
          className={validationErrors.email ? "border-destructive" : ""}
        />
        {validationErrors.email && (
          <p className="text-sm text-destructive">{validationErrors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          value={formData.address}
          onChange={(e) => updateFormField('address', e.target.value)}
          placeholder="Enter complete address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gst_number">GST Number *</Label>
          <Input
            id="gst_number"
            value={formData.gst_number}
            onChange={(e) => updateFormField('gst_number', e.target.value)}
            placeholder="27ABCDE1234F1Z5"
            className={validationErrors.gst_number ? "border-destructive" : ""}
          />
          {validationErrors.gst_number && (
            <p className="text-sm text-destructive">{validationErrors.gst_number}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bank_account_number">Bank Account Number</Label>
          <Input
            id="bank_account_number"
            value={formData.bank_account_number}
            onChange={(e) => updateFormField('bank_account_number', e.target.value)}
            placeholder="1234567890"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ifsc_code">IFSC Code</Label>
        <Input
          id="ifsc_code"
          value={formData.ifsc_code}
          onChange={(e) => updateFormField('ifsc_code', e.target.value)}
          placeholder="HDFC0001234"
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="gst_certificate">GST Certificate (PDF)</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="gst_certificate"
              type="file"
              accept=".pdf"
              onChange={(e) => updateFormField('gst_certificate', e.target.files?.[0] || null)}
            />
            <Upload className="h-4 w-4" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="msme_certificate">MSME/UDYAM Certificate (PDF)</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="msme_certificate"
              type="file"
              accept=".pdf"
              onChange={(e) => updateFormField('msme_certificate', e.target.files?.[0] || null)}
            />
            <Upload className="h-4 w-4" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand_authorization">Brand Authorization Letter (PDF)</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="brand_authorization"
              type="file"
              accept=".pdf"
              onChange={(e) => updateFormField('brand_authorization', e.target.files?.[0] || null)}
            />
            <Upload className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Customer Management</h1>
          <Dialog open={isAddingCustomer} onOpenChange={(open) => {
            setIsAddingCustomer(open);
            if (!open) {
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <CustomerFormFields />
              <Button 
                onClick={handleCreateCustomer} 
                className="w-full"
                disabled={isSubmitting || !formData.name.trim() || !formData.gst_number.trim()}
              >
                {isSubmitting ? "Creating..." : "Create Customer"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Customer Dialog */}
        <Dialog open={isEditingCustomer} onOpenChange={(open) => {
          setIsEditingCustomer(open);
          if (!open) {
            setEditingCustomer(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
            </DialogHeader>
            <CustomerFormFields />
            <Button 
              onClick={handleUpdateCustomer} 
              className="w-full"
              disabled={isSubmitting || !formData.name.trim() || !formData.gst_number.trim()}
            >
              {isSubmitting ? "Updating..." : "Update Customer"}
            </Button>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customers Table */}
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
                  {customers.filter(c => c.is_active).map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>{customer.customer_code}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          {customer.brand_name && (
                            <div className="text-sm text-muted-foreground">{customer.brand_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.is_active ? "default" : "secondary"}>
                          {customer.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(customer)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteCustomer(customer.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Warehouses Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Customer Warehouses</span>
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-select">Select Customer</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a customer to view warehouses" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.filter(c => c.is_active).map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.customer_code} - {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCustomerId ? (
                  warehouses.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Warehouse</TableHead>
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
                      <p>No warehouses found for this customer</p>
                    </div>
                  )
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a customer to view their warehouses</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CustomersManagement;
