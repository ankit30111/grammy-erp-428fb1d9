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
import { Search, Plus, Building2, Upload, FileText, Edit, Trash2 } from "lucide-react";
import { useVendors } from "@/hooks/useVendors";

const Vendors = () => {
  const { vendors, isLoading, addVendor, updateVendor, deleteVendor } = useVendors();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [uploading, setUploading] = useState({ gst: false, msme: false });
  const [newVendor, setNewVendor] = useState({
    name: "",
    contact_person_name: "",
    email: "",
    contact_number: "",
    address: "",
    gst_number: "",
    bank_account_number: "",
    ifsc_code: "",
    gst_certificate: null as File | null,
    msme_certificate: null as File | null
  });

  const filteredVendors = vendors.filter(vendor => 
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    vendor.vendor_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (vendor.email && vendor.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddVendor = async () => {
    // Only validate required fields: name and gst_number
    if (!newVendor.name.trim() || !newVendor.gst_number.trim()) {
      console.error("Validation failed: Name and GST Number are required");
      return;
    }

    console.log("Adding vendor with data:", newVendor);

    try {
      // Prepare data with proper null handling
      const vendorData = {
        name: newVendor.name.trim(),
        contact_person_name: newVendor.contact_person_name.trim() || undefined,
        email: newVendor.email.trim() || undefined,
        contact_number: newVendor.contact_number.trim() || undefined,
        address: newVendor.address.trim() || undefined,
        gst_number: newVendor.gst_number.trim(),
        bank_account_number: newVendor.bank_account_number.trim() || undefined,
        ifsc_code: newVendor.ifsc_code.trim() || undefined,
        gst_certificate: newVendor.gst_certificate || undefined,
        msme_certificate: newVendor.msme_certificate || undefined
      };

      await addVendor.mutateAsync(vendorData);

      console.log("Vendor added successfully");
      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error adding vendor:", error);
    }
  };

  const handleEditVendor = async () => {
    if (!editingVendor) return;

    // Only validate required fields: name and gst_number
    if (!newVendor.name.trim() || !newVendor.gst_number.trim()) {
      console.error("Validation failed: Name and GST Number are required");
      return;
    }

    console.log("Updating vendor with data:", newVendor);

    try {
      // Prepare data with proper null handling
      const vendorData = {
        id: editingVendor.id,
        name: newVendor.name.trim(),
        contact_person_name: newVendor.contact_person_name.trim() || undefined,
        email: newVendor.email.trim() || undefined,
        contact_number: newVendor.contact_number.trim() || undefined,
        address: newVendor.address.trim() || undefined,
        gst_number: newVendor.gst_number.trim(),
        bank_account_number: newVendor.bank_account_number.trim() || undefined,
        ifsc_code: newVendor.ifsc_code.trim() || undefined,
        gst_certificate: newVendor.gst_certificate || undefined,
        msme_certificate: newVendor.msme_certificate || undefined
      };

      await updateVendor.mutateAsync(vendorData);

      console.log("Vendor updated successfully");
      setIsEditDialogOpen(false);
      setEditingVendor(null);
      resetForm();
    } catch (error) {
      console.error("Error updating vendor:", error);
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    console.log("Deleting vendor with ID:", vendorId);
    try {
      await deleteVendor.mutateAsync(vendorId);
      console.log("Vendor deleted successfully");
    } catch (error) {
      console.error("Error deleting vendor:", error);
    }
  };

  const openEditDialog = (vendor: any) => {
    setEditingVendor(vendor);
    setNewVendor({
      name: vendor.name || "",
      contact_person_name: vendor.contact_person_name || "",
      email: vendor.email || "",
      contact_number: vendor.contact_number || "",
      address: vendor.address || "",
      gst_number: vendor.gst_number || "",
      bank_account_number: vendor.bank_account_number || "",
      ifsc_code: vendor.ifsc_code || "",
      gst_certificate: null,
      msme_certificate: null
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setNewVendor({
      name: "",
      contact_person_name: "",
      email: "",
      contact_number: "",
      address: "",
      gst_number: "",
      bank_account_number: "",
      ifsc_code: "",
      gst_certificate: null,
      msme_certificate: null
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-lg">Loading vendors...</div>
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
            <Building2 className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Vendor Management</h1>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add New Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Vendor Name *</Label>
                    <Input 
                      id="name" 
                      value={newVendor.name} 
                      onChange={(e) => setNewVendor({...newVendor, name: e.target.value})}
                      placeholder="Enter vendor name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_person">Contact Person Name</Label>
                    <Input 
                      id="contact_person" 
                      value={newVendor.contact_person_name} 
                      onChange={(e) => setNewVendor({...newVendor, contact_person_name: e.target.value})}
                      placeholder="Enter contact person name"
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact Number</Label>
                    <Input 
                      id="contact" 
                      value={newVendor.contact_number} 
                      onChange={(e) => setNewVendor({...newVendor, contact_number: e.target.value})}
                      placeholder="+91-9876543210"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email ID</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={newVendor.email} 
                      onChange={(e) => setNewVendor({...newVendor, email: e.target.value})}
                      placeholder="vendor@example.com"
                    />
                  </div>
                </div>

                {/* GST and Address */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gst">GST Number *</Label>
                    <Input 
                      id="gst" 
                      value={newVendor.gst_number} 
                      onChange={(e) => setNewVendor({...newVendor, gst_number: e.target.value})}
                      placeholder="27ABCDE1234F1Z5"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea 
                      id="address" 
                      value={newVendor.address} 
                      onChange={(e) => setNewVendor({...newVendor, address: e.target.value})}
                      placeholder="Enter complete address"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Banking Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account">Bank Account Number</Label>
                    <Input 
                      id="account" 
                      value={newVendor.bank_account_number} 
                      onChange={(e) => setNewVendor({...newVendor, bank_account_number: e.target.value})}
                      placeholder="1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ifsc">IFSC Code</Label>
                    <Input 
                      id="ifsc" 
                      value={newVendor.ifsc_code} 
                      onChange={(e) => setNewVendor({...newVendor, ifsc_code: e.target.value})}
                      placeholder="HDFC0001234"
                    />
                  </div>
                </div>

                {/* Document Uploads */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gst_cert">GST Certificate (PDF)</Label>
                    <div className="flex items-center space-x-2">
                      <Input 
                        id="gst_cert" 
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setNewVendor({...newVendor, gst_certificate: e.target.files?.[0] || null})}
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
                        onChange={(e) => setNewVendor({...newVendor, msme_certificate: e.target.files?.[0] || null})}
                        className="flex-1"
                      />
                      {uploading.msme && <Upload className="h-4 w-4 animate-spin" />}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleAddVendor}
                  disabled={!newVendor.name.trim() || !newVendor.gst_number.trim() || addVendor.isPending}
                >
                  {addVendor.isPending ? "Adding..." : "Add Vendor"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingVendor(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Vendor</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Same form fields as Add Dialog */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_name">Vendor Name *</Label>
                  <Input 
                    id="edit_name" 
                    value={newVendor.name} 
                    onChange={(e) => setNewVendor({...newVendor, name: e.target.value})}
                    placeholder="Enter vendor name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_contact_person">Contact Person Name</Label>
                  <Input 
                    id="edit_contact_person" 
                    value={newVendor.contact_person_name} 
                    onChange={(e) => setNewVendor({...newVendor, contact_person_name: e.target.value})}
                    placeholder="Enter contact person name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_contact">Contact Number</Label>
                  <Input 
                    id="edit_contact" 
                    value={newVendor.contact_number} 
                    onChange={(e) => setNewVendor({...newVendor, contact_number: e.target.value})}
                    placeholder="+91-9876543210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_email">Contact Email ID</Label>
                  <Input 
                    id="edit_email" 
                    type="email"
                    value={newVendor.email} 
                    onChange={(e) => setNewVendor({...newVendor, email: e.target.value})}
                    placeholder="vendor@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_gst">GST Number *</Label>
                  <Input 
                    id="edit_gst" 
                    value={newVendor.gst_number} 
                    onChange={(e) => setNewVendor({...newVendor, gst_number: e.target.value})}
                    placeholder="27ABCDE1234F1Z5"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_address">Address</Label>
                  <Textarea 
                    id="edit_address" 
                    value={newVendor.address} 
                    onChange={(e) => setNewVendor({...newVendor, address: e.target.value})}
                    placeholder="Enter complete address"
                    rows={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_account">Bank Account Number</Label>
                  <Input 
                    id="edit_account" 
                    value={newVendor.bank_account_number} 
                    onChange={(e) => setNewVendor({...newVendor, bank_account_number: e.target.value})}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_ifsc">IFSC Code</Label>
                  <Input 
                    id="edit_ifsc" 
                    value={newVendor.ifsc_code} 
                    onChange={(e) => setNewVendor({...newVendor, ifsc_code: e.target.value})}
                    placeholder="HDFC0001234"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_gst_cert">GST Certificate (PDF) - Upload new to replace</Label>
                  <div className="flex items-center space-x-2">
                    <Input 
                      id="edit_gst_cert" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewVendor({...newVendor, gst_certificate: e.target.files?.[0] || null})}
                      className="flex-1"
                    />
                    {uploading.gst && <Upload className="h-4 w-4 animate-spin" />}
                  </div>
                  {editingVendor?.gst_certificate_url && (
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
                      onChange={(e) => setNewVendor({...newVendor, msme_certificate: e.target.files?.[0] || null})}
                      className="flex-1"
                    />
                    {uploading.msme && <Upload className="h-4 w-4 animate-spin" />}
                  </div>
                  {editingVendor?.msme_certificate_url && (
                    <p className="text-sm text-gray-500">Current: MSME Certificate uploaded</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                onClick={handleEditVendor}
                disabled={!newVendor.name.trim() || !newVendor.gst_number.trim() || updateVendor.isPending}
              >
                {updateVendor.isPending ? "Updating..." : "Update Vendor"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendors List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor Code</TableHead>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>GST Number</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No vendors found. Try adjusting your search or add a new vendor.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.vendor_code}</TableCell>
                      <TableCell>{vendor.name}</TableCell>
                      <TableCell>{vendor.contact_person_name || '-'}</TableCell>
                      <TableCell>{vendor.email || '-'}</TableCell>
                      <TableCell>{vendor.contact_number || '-'}</TableCell>
                      <TableCell>{vendor.gst_number || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEditDialog(vendor)}
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
                                  This will deactivate the vendor "{vendor.name}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteVendor(vendor.id)}>
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
                                <SheetTitle>{vendor.name} Details</SheetTitle>
                              </SheetHeader>
                              <div className="py-4 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-muted-foreground text-sm">Vendor Code:</span>
                                    <p className="font-medium">{vendor.vendor_code}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Name:</span>
                                    <p>{vendor.name}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Contact Person:</span>
                                    <p>{vendor.contact_person_name || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Email:</span>
                                    <p>{vendor.email || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Contact:</span>
                                    <p>{vendor.contact_number || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">GST Number:</span>
                                    <p>{vendor.gst_number || '-'}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <span className="text-muted-foreground text-sm">Address:</span>
                                  <p className="mt-1">{vendor.address || '-'}</p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-muted-foreground text-sm">Bank Account:</span>
                                    <p>{vendor.bank_account_number || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">IFSC Code:</span>
                                    <p>{vendor.ifsc_code || '-'}</p>
                                  </div>
                                </div>

                                {/* Document Links */}
                                <div className="space-y-2">
                                  <h4 className="font-medium">Documents</h4>
                                  <div className="flex flex-col space-y-2">
                                    {vendor.gst_certificate_url && (
                                      <a 
                                        href={vendor.gst_certificate_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>GST Certificate</span>
                                      </a>
                                    )}
                                    {vendor.msme_certificate_url && (
                                      <a 
                                        href={vendor.msme_certificate_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>MSME/UDYAM Certificate</span>
                                      </a>
                                    )}
                                    {!vendor.gst_certificate_url && !vendor.msme_certificate_url && (
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
      </div>
    </DashboardLayout>
  );
};

export default Vendors;
