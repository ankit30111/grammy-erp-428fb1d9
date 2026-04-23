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
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger
} from "@/components/ui/sheet";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Search, Plus, Building2, Edit, Trash2, FileText } from "lucide-react";
import { useVendors } from "@/hooks/useVendors";
import { VendorForm } from "@/components/forms/VendorForm";
import { SignedStorageLink } from "@/components/ui/signed-storage-link";

const Vendors = () => {
  const { vendors, isLoading, deleteVendor } = useVendors();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);

  const filteredVendors = vendors.filter(vendor => 
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    vendor.vendor_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (vendor.email && vendor.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
    setIsEditDialogOpen(true);
  };

  const handleAddSuccess = () => {
    setIsAddDialogOpen(false);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setEditingVendor(null);
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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
              <VendorForm onSuccess={handleAddSuccess} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingVendor(null);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Vendor</DialogTitle>
            </DialogHeader>
            <VendorForm 
              editingVendor={editingVendor}
              onSuccess={handleEditSuccess}
            />
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
            <CardTitle>Vendors List ({filteredVendors.length})</CardTitle>
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
                                      <SignedStorageLink
                                        bucket="vendor-documents"
                                        path={vendor.gst_certificate_url}
                                        variant="ghost"
                                        size="sm"
                                        className="flex items-center justify-start space-x-2 text-blue-600 hover:text-blue-800 px-0 h-auto"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>GST Certificate</span>
                                      </SignedStorageLink>
                                    )}
                                    {vendor.msme_certificate_url && (
                                      <SignedStorageLink
                                        bucket="vendor-documents"
                                        path={vendor.msme_certificate_url}
                                        variant="ghost"
                                        size="sm"
                                        className="flex items-center justify-start space-x-2 text-blue-600 hover:text-blue-800 px-0 h-auto"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>MSME/UDYAM Certificate</span>
                                      </SignedStorageLink>
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
