
import { useState, useEffect } from "react";
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
import { Search, Plus, Building2, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Vendor {
  id: string;
  vendor_code: string;
  name: string;
  contact_person_name?: string;
  email: string;
  contact_number: string;
  address: string;
  gst_number?: string;
  bank_account_number: string;
  ifsc_code: string;
  gst_certificate_url?: string;
  msme_certificate_url?: string;
  is_active: boolean;
  created_at: string;
}

const Vendors = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({ gst: false, msme: false });
  const { toast } = useToast();
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

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({
        title: "Error",
        description: "Failed to fetch vendors",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = vendors.filter(vendor => 
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    vendor.vendor_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const generateVendorCode = () => {
    const nextNumber = vendors.length + 1;
    return `VND${String(nextNumber).padStart(3, '0')}`;
  };

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file);

    if (error) throw error;
    return data;
  };

  const handleFileUpload = async (file: File, type: 'gst' | 'msme') => {
    if (!file) return null;

    setUploading(prev => ({ ...prev, [type]: true }));
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${type}-certificates/${fileName}`;

      await uploadFile(file, 'vendor-documents', filePath);
      
      const { data } = supabase.storage
        .from('vendor-documents')
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

  const handleAddVendor = async () => {
    try {
      let gstCertificateUrl = null;
      let msmeCertificateUrl = null;

      // Upload files if provided
      if (newVendor.gst_certificate) {
        gstCertificateUrl = await handleFileUpload(newVendor.gst_certificate, 'gst');
      }

      if (newVendor.msme_certificate) {
        msmeCertificateUrl = await handleFileUpload(newVendor.msme_certificate, 'msme');
      }

      const vendorData = {
        vendor_code: generateVendorCode(),
        name: newVendor.name,
        contact_person_name: newVendor.contact_person_name,
        email: newVendor.email,
        contact_number: newVendor.contact_number,
        address: newVendor.address,
        gst_number: newVendor.gst_number,
        bank_account_number: newVendor.bank_account_number,
        ifsc_code: newVendor.ifsc_code,
        gst_certificate_url: gstCertificateUrl,
        msme_certificate_url: msmeCertificateUrl,
        is_active: true
      };

      const { data, error } = await supabase
        .from('vendors')
        .insert([vendorData])
        .select()
        .single();

      if (error) throw error;

      setVendors([data, ...vendors]);
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
      setIsAddDialogOpen(false);

      toast({
        title: "Success",
        description: "Vendor added successfully",
      });
    } catch (error) {
      console.error('Error adding vendor:', error);
      toast({
        title: "Error",
        description: "Failed to add vendor",
        variant: "destructive",
      });
    }
  };

  if (loading) {
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
                    <Label htmlFor="contact">Contact Number *</Label>
                    <Input 
                      id="contact" 
                      value={newVendor.contact_number} 
                      onChange={(e) => setNewVendor({...newVendor, contact_number: e.target.value})}
                      placeholder="+91-9876543210"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email ID *</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={newVendor.email} 
                      onChange={(e) => setNewVendor({...newVendor, email: e.target.value})}
                      placeholder="vendor@example.com"
                      required
                    />
                  </div>
                </div>

                {/* GST and Address */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gst">GST Number</Label>
                    <Input 
                      id="gst" 
                      value={newVendor.gst_number} 
                      onChange={(e) => setNewVendor({...newVendor, gst_number: e.target.value})}
                      placeholder="27ABCDE1234F1Z5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address *</Label>
                    <Textarea 
                      id="address" 
                      value={newVendor.address} 
                      onChange={(e) => setNewVendor({...newVendor, address: e.target.value})}
                      placeholder="Enter complete address"
                      rows={2}
                      required
                    />
                  </div>
                </div>

                {/* Banking Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account">Bank Account Number *</Label>
                    <Input 
                      id="account" 
                      value={newVendor.bank_account_number} 
                      onChange={(e) => setNewVendor({...newVendor, bank_account_number: e.target.value})}
                      placeholder="1234567890"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ifsc">IFSC Code *</Label>
                    <Input 
                      id="ifsc" 
                      value={newVendor.ifsc_code} 
                      onChange={(e) => setNewVendor({...newVendor, ifsc_code: e.target.value})}
                      placeholder="HDFC0001234"
                      required
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
                  disabled={!newVendor.name || !newVendor.email || !newVendor.contact_number || !newVendor.address || !newVendor.bank_account_number || !newVendor.ifsc_code}
                >
                  Add Vendor
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
                      <TableCell>{vendor.email}</TableCell>
                      <TableCell>{vendor.contact_number}</TableCell>
                      <TableCell>{vendor.gst_number || '-'}</TableCell>
                      <TableCell className="text-right">
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
                                  <p>{vendor.email}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-sm">Contact:</span>
                                  <p>{vendor.contact_number}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-sm">GST Number:</span>
                                  <p>{vendor.gst_number || '-'}</p>
                                </div>
                              </div>
                              
                              <div>
                                <span className="text-muted-foreground text-sm">Address:</span>
                                <p className="mt-1">{vendor.address}</p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-muted-foreground text-sm">Bank Account:</span>
                                  <p>{vendor.bank_account_number}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-sm">IFSC Code:</span>
                                  <p>{vendor.ifsc_code}</p>
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
