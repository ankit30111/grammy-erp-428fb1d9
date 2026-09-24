import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
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
import { useVendors, useVendorFinance, useVendorContacts } from "@/hooks/useVendors";
import { VendorForm } from "@/components/forms/VendorForm";
import { SignedStorageLink } from "@/components/ui/signed-storage-link";
import { usePermissions } from "@/hooks/usePermissions";
import { ApprovalBadge } from "@/components/Approvals/ApprovalBadge";

/** Admin-only finance section. Fetches bank + certificate URLs via RPC. */
/** Everyone at the vendor beyond the main contact. */
const VendorContactsSection = ({ vendorId }: { vendorId: string }) => {
  const { data: contacts = [] } = useVendorContacts(vendorId);
  if (!contacts.length) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other contacts</h4>
      <div className="divide-y rounded-md border">
        {contacts.map((c) => (
          // Name | phone | email, with the email given the most room: names are
          // short, addresses are long and must stay on one line where they fit.
          <div key={c.id}
               className="grid grid-cols-1 gap-x-4 gap-y-0.5 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,2fr)] sm:items-baseline">
            <span className="font-medium">
              {c.name || "-"}
              {c.designation && <span className="font-normal text-muted-foreground"> · {c.designation}</span>}
            </span>
            <span className="whitespace-nowrap tabular-nums text-muted-foreground">{c.phone || ""}</span>
            <span className="text-muted-foreground [overflow-wrap:anywhere]">{c.email || ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const VendorFinanceSection = ({ vendorId }: { vendorId: string }) => {
  const { canApprove: isAdmin } = usePermissions();
  const { data: finance, isLoading, error } = useVendorFinance(vendorId, isAdmin);

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Bank details and certificates are visible to Management and Admin only.
      </p>
    );
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">Unable to load sensitive details.</p>;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-muted-foreground text-sm">Bank:</span>
          <p>{finance?.bank_name || '-'}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-sm">Account Holder:</span>
          <p>{finance?.account_holder_name || '-'}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-sm">PAN:</span>
          <p>{finance?.pan_number || '-'}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-sm">Bank Account:</span>
          <p>{finance?.bank_account_number || '-'}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-sm">IFSC Code:</span>
          <p>{finance?.ifsc_code || '-'}</p>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-medium">Documents</h4>
        <div className="flex flex-col space-y-2">
          {finance?.gst_certificate_url && (
            <SignedStorageLink
              bucket="vendor-documents"
              path={finance.gst_certificate_url}
              variant="ghost"
              size="sm"
              className="flex items-center justify-start space-x-2 text-primary hover:text-primary px-0 h-auto"
            >
              <FileText className="h-4 w-4" />
              <span>GST Certificate</span>
            </SignedStorageLink>
          )}
          {finance?.msme_certificate_url && (
            <SignedStorageLink
              bucket="vendor-documents"
              path={finance.msme_certificate_url}
              variant="ghost"
              size="sm"
              className="flex items-center justify-start space-x-2 text-primary hover:text-primary px-0 h-auto"
            >
              <FileText className="h-4 w-4" />
              <span>MSME/UDYAM Certificate</span>
            </SignedStorageLink>
          )}
          {!finance?.gst_certificate_url && !finance?.msme_certificate_url && (
            <p className="text-muted-foreground">No documents uploaded</p>
          )}
        </div>
      </div>
    </>
  );
};

const Vendors = () => {
  const { vendors, isLoading, deleteVendor } = useVendors();
  const { canEditMasters, canApprove } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);

  const filteredVendors = vendors.filter(vendor => 
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    vendor.vendor_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (vendor.email && vendor.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (vendor.supplies && vendor.supplies.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (vendor.gst_number && vendor.gst_number.toLowerCase().includes(searchQuery.toLowerCase()))
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
      <PageHeader
        title="Vendors"
        actions={canEditMasters && (
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
        )}
      />
      <div className="pt-4">


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
            <CardTitle>Vendors List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="table-auto w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Code</TableHead>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead className="hidden md:table-cell">Contact Person</TableHead>
                  <TableHead className="hidden lg:table-cell">Contact</TableHead>
                  <TableHead className="hidden xl:table-cell">GST Number</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No vendors found. Try adjusting your search or add a new vendor.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-mono whitespace-nowrap">{vendor.vendor_code}</TableCell>
                      <TableCell className="break-words">{vendor.name}<ApprovalBadge status={vendor.approval_status} reason={vendor.rejection_reason} /></TableCell>
                      <TableCell className="hidden md:table-cell">{vendor.contact_person_name || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell whitespace-nowrap">{vendor.contact_number || '-'}</TableCell>
                      <TableCell className="hidden xl:table-cell font-mono whitespace-nowrap">{vendor.gst_number || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {canEditMasters && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEditDialog(vendor)}
                          >
                            <Edit />
                            Edit
                          </Button>
                          )}

                          {canApprove && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 />
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
                          )}

                          <Sheet>
                            <SheetTrigger asChild>
                              <Button variant="outline" size="sm">View Details</Button>
                            </SheetTrigger>
                            <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
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
                                    <span className="text-muted-foreground text-sm">Supplies:</span>
                                    <p>{vendor.supplies || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Area / City:</span>
                                    <p>{vendor.location || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Contact Person:</span>
                                    <p>{[vendor.contact_person_name, vendor.contact_designation].filter(Boolean).join(' · ') || '-'}</p>
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

                                <VendorContactsSection vendorId={vendor.id} />

                                <VendorFinanceSection vendorId={vendor.id} />
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
