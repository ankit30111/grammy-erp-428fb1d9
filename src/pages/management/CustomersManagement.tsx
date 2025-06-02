
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { 
  Card, CardContent, CardHeader, CardTitle 
} from "@/components/ui/card";
import { 
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger
} from "@/components/ui/sheet";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Search, Plus, Users, Upload, FileText, Edit, Trash2 } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CustomersManagement = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [uploading, setUploading] = useState({ gst: false, msme: false, brand: false });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debug: Let's also fetch data directly to see what's happening
  const { data: debugCustomers, isLoading: debugLoading, error: debugError } = useQuery({
    queryKey: ["debug-customers"],
    queryFn: async () => {
      console.log("Debug: Fetching customers...");
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("is_active", true);
      
      console.log("Debug customers data:", data);
      console.log("Debug customers error:", error);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: customers = [], isLoading } = useCustomers();

  console.log("Hook customers:", customers);
  console.log("Debug customers:", debugCustomers);
  console.log("Is loading:", isLoading, debugLoading);
  console.log("Debug error:", debugError);

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    customer_code: "",
    brand_name: "",
    contact_person_name: "",
    email: "",
    contact_number: "",
    address: "",
    gst_number: "",
    bank_account_number: "",
    ifsc_code: "",
    gst_certificate: null as File | null,
    msme_certificate: null as File | null,
    brand_authorization: null as File | null
  });

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    customer.customer_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const generateCustomerCode = () => {
    const nextNumber = customers.length + 1;
    return `CUS${String(nextNumber).padStart(3, '0')}`;
  };

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file);

    if (error) throw error;
    return data;
  };

  const handleFileUpload = async (file: File, type: 'gst' | 'msme' | 'brand') => {
    if (!file) return null;

    setUploading(prev => ({ ...prev, [type]: true }));
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${type}-certificates/${fileName}`;

      await uploadFile(file, 'customer-documents', filePath);
      
      const { data } = supabase.storage
        .from('customer-documents')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error(`Error uploading ${type} certificate:`, error);
      toast({
        title: "Upload Error",
        description: `Failed to upload ${type.toUpperCase()} certificate`,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const addCustomer = useMutation({
    mutationFn: async (customerData: typeof newCustomer) => {
      let gstCertificateUrl = null;
      let msmeCertificateUrl = null;
      let brandAuthorizationUrl = null;

      if (customerData.gst_certificate) {
        gstCertificateUrl = await handleFileUpload(customerData.gst_certificate, 'gst');
      }

      if (customerData.msme_certificate) {
        msmeCertificateUrl = await handleFileUpload(customerData.msme_certificate, 'msme');
      }

      if (customerData.brand_authorization) {
        brandAuthorizationUrl = await handleFileUpload(customerData.brand_authorization, 'brand');
      }

      const { data, error } = await supabase
        .from('customers')
        .insert({
          customer_code: generateCustomerCode(),
          name: customerData.name,
          brand_name: customerData.brand_name,
          contact_person_name: customerData.contact_person_name,
          email: customerData.email,
          contact_number: customerData.contact_number,
          address: customerData.address,
          gst_number: customerData.gst_number,
          bank_account_number: customerData.bank_account_number,
          ifsc_code: customerData.ifsc_code,
          gst_certificate_url: gstCertificateUrl,
          msme_certificate_url: msmeCertificateUrl,
          brand_authorization_url: brandAuthorizationUrl,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["debug-customers"] });
      toast({
        title: "Success",
        description: "Customer added successfully",
      });
    },
    onError: (error) => {
      console.error('Error adding customer:', error);
      toast({
        title: "Error",
        description: "Failed to add customer",
        variant: "destructive",
      });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async (data: { id: string } & typeof newCustomer) => {
      let gstCertificateUrl = editingCustomer?.gst_certificate_url;
      let msmeCertificateUrl = editingCustomer?.msme_certificate_url;
      let brandAuthorizationUrl = editingCustomer?.brand_authorization_url;

      if (data.gst_certificate) {
        gstCertificateUrl = await handleFileUpload(data.gst_certificate, 'gst');
      }

      if (data.msme_certificate) {
        msmeCertificateUrl = await handleFileUpload(data.msme_certificate, 'msme');
      }

      if (data.brand_authorization) {
        brandAuthorizationUrl = await handleFileUpload(data.brand_authorization, 'brand');
      }

      const { data: updatedCustomer, error } = await supabase
        .from('customers')
        .update({
          name: data.name,
          brand_name: data.brand_name,
          contact_person_name: data.contact_person_name,
          email: data.email,
          contact_number: data.contact_number,
          address: data.address,
          gst_number: data.gst_number,
          bank_account_number: data.bank_account_number,
          ifsc_code: data.ifsc_code,
          gst_certificate_url: gstCertificateUrl,
          msme_certificate_url: msmeCertificateUrl,
          brand_authorization_url: brandAuthorizationUrl,
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return updatedCustomer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["debug-customers"] });
      toast({
        title: "Success",
        description: "Customer updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating customer:', error);
      toast({
        title: "Error",
        description: "Failed to update customer",
        variant: "destructive",
      });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', customerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["debug-customers"] });
      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive",
      });
    },
  });

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.email || !newCustomer.contact_number || !newCustomer.address) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await addCustomer.mutateAsync(newCustomer);
      setNewCustomer({
        name: "",
        customer_code: "",
        brand_name: "",
        contact_person_name: "",
        email: "",
        contact_number: "",
        address: "",
        gst_number: "",
        bank_account_number: "",
        ifsc_code: "",
        gst_certificate: null,
        msme_certificate: null,
        brand_authorization: null
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const handleEditCustomer = async () => {
    if (!editingCustomer || !newCustomer.name || !newCustomer.email || !newCustomer.contact_number || !newCustomer.address) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateCustomer.mutateAsync({
        id: editingCustomer.id,
        ...newCustomer,
      });
      setIsEditDialogOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      await deleteCustomer.mutateAsync(customerId);
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const openEditDialog = (customer: any) => {
    setEditingCustomer(customer);
    setNewCustomer({
      name: customer.name,
      customer_code: customer.customer_code,
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
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setNewCustomer({
      name: "",
      customer_code: "",
      brand_name: "",
      contact_person_name: "",
      email: "",
      contact_number: "",
      address: "",
      gst_number: "",
      bank_account_number: "",
      ifsc_code: "",
      gst_certificate: null,
      msme_certificate: null,
      brand_authorization: null
    });
  };

  if (isLoading && debugLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-lg">Loading customers...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Users className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Customer Management</h1>
          </div>
          
          {/* Debug Information */}
          <div className="text-sm text-gray-500">
            Hook: {customers.length} | Debug: {debugCustomers?.length || 0} customers
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add New Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Customer Name *</Label>
                    <Input 
                      id="name" 
                      value={newCustomer.name} 
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      placeholder="Enter customer name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand_name">Brand Name</Label>
                    <Input 
                      id="brand_name" 
                      value={newCustomer.brand_name} 
                      onChange={(e) => setNewCustomer({...newCustomer, brand_name: e.target.value})}
                      placeholder="Enter brand name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_person">Contact Person Name</Label>
                    <Input 
                      id="contact_person" 
                      value={newCustomer.contact_person_name} 
                      onChange={(e) => setNewCustomer({...newCustomer, contact_person_name: e.target.value})}
                      placeholder="Enter contact person name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact Number *</Label>
                    <Input 
                      id="contact" 
                      value={newCustomer.contact_number} 
                      onChange={(e) => setNewCustomer({...newCustomer, contact_number: e.target.value})}
                      placeholder="+91-9876543210"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Contact Email ID *</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={newCustomer.email} 
                    onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                    placeholder="customer@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Textarea 
                    id="address" 
                    value={newCustomer.address} 
                    onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                    placeholder="Enter complete address"
                    rows={3}
                    required
                  />
                </div>

                {/* GST and Banking Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gst">GST Number</Label>
                    <Input 
                      id="gst" 
                      value={newCustomer.gst_number} 
                      onChange={(e) => setNewCustomer({...newCustomer, gst_number: e.target.value})}
                      placeholder="27ABCDE1234F1Z5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account">Bank Account Number</Label>
                    <Input 
                      id="account" 
                      value={newCustomer.bank_account_number} 
                      onChange={(e) => setNewCustomer({...newCustomer, bank_account_number: e.target.value})}
                      placeholder="1234567890"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ifsc">IFSC Code</Label>
                  <Input 
                    id="ifsc" 
                    value={newCustomer.ifsc_code} 
                    onChange={(e) => setNewCustomer({...newCustomer, ifsc_code: e.target.value})}
                    placeholder="HDFC0001234"
                  />
                </div>

                {/* Document Uploads */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gst_cert">GST Certificate (PDF)</Label>
                    <div className="flex items-center space-x-2">
                      <Input 
                        id="gst_cert" 
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setNewCustomer({...newCustomer, gst_certificate: e.target.files?.[0] || null})}
                        className="flex-1"
                      />
                      {uploading.gst && <Upload className="h-4 w-4 animate-spin" />}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="msme_cert">MSME/UDYAM Certificate (PDF)</Label>
                    <div className="flex items-center space-x-2">
                      <Input 
                        id="msme_cert" 
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setNewCustomer({...newCustomer, msme_certificate: e.target.files?.[0] || null})}
                        className="flex-1"
                      />
                      {uploading.msme && <Upload className="h-4 w-4 animate-spin" />}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand_cert">Brand Authorization (PDF)</Label>
                    <div className="flex items-center space-x-2">
                      <Input 
                        id="brand_cert" 
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setNewCustomer({...newCustomer, brand_authorization: e.target.files?.[0] || null})}
                        className="flex-1"
                      />
                      {uploading.brand && <Upload className="h-4 w-4 animate-spin" />}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleAddCustomer}
                  disabled={!newCustomer.name || !newCustomer.email || !newCustomer.contact_number || !newCustomer.address || addCustomer.isPending}
                >
                  {addCustomer.isPending ? "Adding..." : "Add Customer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customers List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Code</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Brand Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      {isLoading ? "Loading..." : "No customers found. Try adjusting your search or add a new customer."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.customer_code}</TableCell>
                      <TableCell>{customer.name}</TableCell>
                      <TableCell>{customer.brand_name || '-'}</TableCell>
                      <TableCell>{customer.contact_person_name || '-'}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>{customer.contact_number}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEditDialog(customer)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will deactivate the customer "{customer.name}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCustomer(customer.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <Sheet>
                            <SheetTrigger asChild>
                              <Button variant="outline" size="sm">View Details</Button>
                            </SheetTrigger>
                            <SheetContent className="w-[600px]">
                              <SheetHeader>
                                <SheetTitle>{customer.name} Details</SheetTitle>
                              </SheetHeader>
                              <div className="py-4 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-muted-foreground text-sm">Customer Code:</span>
                                    <p className="font-medium">{customer.customer_code}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Brand Name:</span>
                                    <p>{customer.brand_name || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Contact Person:</span>
                                    <p>{customer.contact_person_name || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Email:</span>
                                    <p>{customer.email}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Contact:</span>
                                    <p>{customer.contact_number}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">GST Number:</span>
                                    <p>{customer.gst_number || '-'}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <span className="text-muted-foreground text-sm">Address:</span>
                                  <p className="mt-1">{customer.address}</p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-muted-foreground text-sm">Bank Account:</span>
                                    <p>{customer.bank_account_number || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">IFSC Code:</span>
                                    <p>{customer.ifsc_code || '-'}</p>
                                  </div>
                                </div>

                                {/* Document Links */}
                                <div className="space-y-2">
                                  <h4 className="font-medium">Documents</h4>
                                  <div className="flex flex-col space-y-2">
                                    {customer.gst_certificate_url && (
                                      <a 
                                        href={customer.gst_certificate_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>GST Certificate</span>
                                      </a>
                                    )}
                                    {customer.msme_certificate_url && (
                                      <a 
                                        href={customer.msme_certificate_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>MSME/UDYAM Certificate</span>
                                      </a>
                                    )}
                                    {customer.brand_authorization_url && (
                                      <a 
                                        href={customer.brand_authorization_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>Brand Authorization</span>
                                      </a>
                                    )}
                                    {!customer.gst_certificate_url && !customer.msme_certificate_url && !customer.brand_authorization_url && (
                                      <p className="text-muted-foreground">No documents uploaded</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <SheetFooter className="pt-2">
                                <SheetClose asChild>
                                  <Button variant="outline">Close</Button>
                                </SheetClose>
                              </SheetFooter>
                            </SheetContent>
                          </Sheet>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingCustomer(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Same form fields as Add Dialog */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_name">Customer Name *</Label>
                  <Input 
                    id="edit_name" 
                    value={newCustomer.name} 
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                    placeholder="Enter customer name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_brand_name">Brand Name</Label>
                  <Input 
                    id="edit_brand_name" 
                    value={newCustomer.brand_name} 
                    onChange={(e) => setNewCustomer({...newCustomer, brand_name: e.target.value})}
                    placeholder="Enter brand name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_contact_person">Contact Person Name</Label>
                  <Input 
                    id="edit_contact_person" 
                    value={newCustomer.contact_person_name} 
                    onChange={(e) => setNewCustomer({...newCustomer, contact_person_name: e.target.value})}
                    placeholder="Enter contact person name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_contact">Contact Number *</Label>
                  <Input 
                    id="edit_contact" 
                    value={newCustomer.contact_number} 
                    onChange={(e) => setNewCustomer({...newCustomer, contact_number: e.target.value})}
                    placeholder="+91-9876543210"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_email">Contact Email ID *</Label>
                <Input 
                  id="edit_email" 
                  type="email"
                  value={newCustomer.email} 
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                  placeholder="customer@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_address">Address *</Label>
                <Textarea 
                  id="edit_address" 
                  value={newCustomer.address} 
                  onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  placeholder="Enter complete address"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_gst">GST Number</Label>
                  <Input 
                    id="edit_gst" 
                    value={newCustomer.gst_number} 
                    onChange={(e) => setNewCustomer({...newCustomer, gst_number: e.target.value})}
                    placeholder="27ABCDE1234F1Z5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_account">Bank Account Number</Label>
                  <Input 
                    id="edit_account" 
                    value={newCustomer.bank_account_number} 
                    onChange={(e) => setNewCustomer({...newCustomer, bank_account_number: e.target.value})}
                    placeholder="1234567890"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_ifsc">IFSC Code</Label>
                <Input 
                  id="edit_ifsc" 
                  value={newCustomer.ifsc_code} 
                  onChange={(e) => setNewCustomer({...newCustomer, ifsc_code: e.target.value})}
                  placeholder="HDFC0001234"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_gst_cert">GST Certificate (PDF) - Upload new to replace</Label>
                  <div className="flex items-center space-x-2">
                    <Input 
                      id="edit_gst_cert" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewCustomer({...newCustomer, gst_certificate: e.target.files?.[0] || null})}
                      className="flex-1"
                    />
                    {uploading.gst && <Upload className="h-4 w-4 animate-spin" />}
                  </div>
                  {editingCustomer?.gst_certificate_url && (
                    <p className="text-sm text-gray-500">Current: GST Certificate uploaded</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_msme_cert">MSME/UDYAM Certificate (PDF) - Upload new to replace</Label>
                  <div className="flex items-center space-x-2">
                    <Input 
                      id="edit_msme_cert" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewCustomer({...newCustomer, msme_certificate: e.target.files?.[0] || null})}
                      className="flex-1"
                    />
                    {uploading.msme && <Upload className="h-4 w-4 animate-spin" />}
                  </div>
                  {editingCustomer?.msme_certificate_url && (
                    <p className="text-sm text-gray-500">Current: MSME Certificate uploaded</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_brand_cert">Brand Authorization (PDF) - Upload new to replace</Label>
                  <div className="flex items-center space-x-2">
                    <Input 
                      id="edit_brand_cert" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewCustomer({...newCustomer, brand_authorization: e.target.files?.[0] || null})}
                      className="flex-1"
                    />
                    {uploading.brand && <Upload className="h-4 w-4 animate-spin" />}
                  </div>
                  {editingCustomer?.brand_authorization_url && (
                    <p className="text-sm text-gray-500">Current: Brand Authorization uploaded</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                onClick={handleEditCustomer}
                disabled={!newCustomer.name || !newCustomer.email || !newCustomer.contact_number || !newCustomer.address || updateCustomer.isPending}
              >
                {updateCustomer.isPending ? "Updating..." : "Update Customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CustomersManagement;
