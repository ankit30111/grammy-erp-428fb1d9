
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
import { Search, Plus, Building2 } from "lucide-react";

// Sample data for demonstration
const SAMPLE_VENDORS = [
  {
    id: "1",
    vendor_code: "VND001",
    name: "Electronics Suppliers Ltd",
    email: "contact@electronicsuppliers.com",
    contact_number: "+91-9876543210",
    address: "123 Industrial Area, Mumbai, Maharashtra 400001",
    gst_number: "27ABCDE1234F1Z5",
    bank_account_number: "1234567890",
    ifsc_code: "HDFC0001234",
    is_active: true
  },
  {
    id: "2",
    vendor_code: "VND002",
    name: "Plastic Components Co",
    email: "info@plasticcomponents.com",
    contact_number: "+91-9876543211",
    address: "456 Manufacturing Hub, Pune, Maharashtra 411001",
    gst_number: "27FGHIJ5678K2L6",
    bank_account_number: "0987654321",
    ifsc_code: "ICICI0005678",
    is_active: true
  }
];

const Vendors = () => {
  const [vendors, setVendors] = useState(SAMPLE_VENDORS);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newVendor, setNewVendor] = useState({
    name: "",
    email: "",
    contact_number: "",
    address: "",
    gst_number: "",
    bank_account_number: "",
    ifsc_code: ""
  });

  const filteredVendors = vendors.filter(vendor => 
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    vendor.vendor_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const generateVendorCode = () => {
    const nextNumber = vendors.length + 1;
    return `VND${String(nextNumber).padStart(3, '0')}`;
  };

  const handleAddVendor = () => {
    const vendor = {
      id: String(vendors.length + 1),
      vendor_code: generateVendorCode(),
      ...newVendor,
      is_active: true
    };
    
    setVendors([...vendors, vendor]);
    setNewVendor({
      name: "",
      email: "",
      contact_number: "",
      address: "",
      gst_number: "",
      bank_account_number: "",
      ifsc_code: ""
    });
    setIsAddDialogOpen(false);
  };

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
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Vendor Name</Label>
                    <Input 
                      id="name" 
                      value={newVendor.name} 
                      onChange={(e) => setNewVendor({...newVendor, name: e.target.value})}
                      placeholder="Enter vendor name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={newVendor.email} 
                      onChange={(e) => setNewVendor({...newVendor, email: e.target.value})}
                      placeholder="vendor@example.com"
                    />
                  </div>
                </div>
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
                    <Label htmlFor="gst">GST Number</Label>
                    <Input 
                      id="gst" 
                      value={newVendor.gst_number} 
                      onChange={(e) => setNewVendor({...newVendor, gst_number: e.target.value})}
                      placeholder="27ABCDE1234F1Z5"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea 
                    id="address" 
                    value={newVendor.address} 
                    onChange={(e) => setNewVendor({...newVendor, address: e.target.value})}
                    placeholder="Enter complete address"
                    rows={3}
                  />
                </div>
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
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddVendor}>Add Vendor</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

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
                  <TableHead>Email</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>GST Number</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No vendors found. Try adjusting your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.vendor_code}</TableCell>
                      <TableCell>{vendor.name}</TableCell>
                      <TableCell>{vendor.email}</TableCell>
                      <TableCell>{vendor.contact_number}</TableCell>
                      <TableCell>{vendor.gst_number}</TableCell>
                      <TableCell className="text-right">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button variant="outline" size="sm">View Details</Button>
                          </SheetTrigger>
                          <SheetContent>
                            <SheetHeader>
                              <SheetTitle>{vendor.name} Details</SheetTitle>
                            </SheetHeader>
                            <div className="py-4 space-y-4">
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-muted-foreground">Vendor Code:</span>
                                <span className="font-medium">{vendor.vendor_code}</span>
                                <span className="text-muted-foreground">Name:</span>
                                <span>{vendor.name}</span>
                                <span className="text-muted-foreground">Email:</span>
                                <span>{vendor.email}</span>
                                <span className="text-muted-foreground">Contact:</span>
                                <span>{vendor.contact_number}</span>
                                <span className="text-muted-foreground">GST Number:</span>
                                <span>{vendor.gst_number}</span>
                              </div>
                              
                              <div className="space-y-2">
                                <span className="text-muted-foreground">Address:</span>
                                <p className="text-sm">{vendor.address}</p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <span className="text-muted-foreground">Bank Account:</span>
                                <span>{vendor.bank_account_number}</span>
                                <span className="text-muted-foreground">IFSC Code:</span>
                                <span>{vendor.ifsc_code}</span>
                              </div>
                            </div>
                            <SheetFooter className="pt-2">
                              <SheetClose asChild>
                                <Button variant="outline">Close</Button>
                              </SheetClose>
                            </SheetFooter>
                          </SheetContent>
                        </Sheet>
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
