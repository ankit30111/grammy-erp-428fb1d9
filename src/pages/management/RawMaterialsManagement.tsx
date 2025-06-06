import { useState, useRef } from "react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Layers, FileText, Package, Upload, Edit, Trash2, History, Download, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRawMaterials, useSpecificationHistory } from "@/hooks/useRawMaterials";
import { toast } from "sonner";

// Raw Material categories with their prefixes
const MATERIAL_CATEGORIES = [
  { name: "Packaging", prefix: "B" },
  { name: "Wire", prefix: "C" },
  { name: "Consumables", prefix: "D" },
  { name: "PCB", prefix: "E" },
  { name: "Gasket", prefix: "F" },
  { name: "Loudspeaker", prefix: "L" },
  { name: "Metal", prefix: "M" },
  { name: "Others", prefix: "O" },
  { name: "Plastic", prefix: "P" },
  { name: "Remote", prefix: "R" },
  { name: "Sticker", prefix: "S" },
  { name: "Transformer", prefix: "T" },
  { name: "Wooden", prefix: "W" },
  { name: "Connector", prefix: "Y" },
  { name: "Screw", prefix: "Z" }
];

const RawMaterialsManagement = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [viewMaterial, setViewMaterial] = useState<any>(null);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [primaryVendor, setPrimaryVendor] = useState<string>("");
  const [specificationFile, setSpecificationFile] = useState<File | null>(null);
  const [iqcChecklistFile, setIqcChecklistFile] = useState<File | null>(null);
  const [changesDescription, setChangesDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newMaterial, setNewMaterial] = useState({
    name: "",
    category: "",
    specification: ""
  });

  const { rawMaterials, isLoading, addRawMaterial, updateRawMaterial, deleteRawMaterial } = useRawMaterials();

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      return data || [];
    },
  });

  // Filter materials based on search and category
  const filteredMaterials = rawMaterials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         material.material_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || material.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddMaterial = async () => {
    if (selectedVendors.length === 0) {
      toast.error("Please select at least one vendor");
      return;
    }

    addRawMaterial.mutate({
      ...newMaterial,
      vendorIds: selectedVendors,
      primaryVendorId: primaryVendor,
      specificationFile: specificationFile || undefined,
      iqcChecklistFile: iqcChecklistFile || undefined,
    });

    // Reset form
    setNewMaterial({ name: "", category: "", specification: "" });
    setSelectedVendors([]);
    setPrimaryVendor("");
    setSpecificationFile(null);
    setIqcChecklistFile(null);
    setIsAddDialogOpen(false);
  };

  const handleEditMaterial = (material: any) => {
    setSelectedMaterial(material);
    setNewMaterial({
      name: material.name,
      category: material.category,
      specification: material.specification || ""
    });
    setSelectedVendors(material.raw_material_vendors?.map((rv: any) => rv.vendors.id) || []);
    setPrimaryVendor(material.raw_material_vendors?.find((rv: any) => rv.is_primary)?.vendors.id || "");
    setSpecificationFile(null);
    setIqcChecklistFile(null);
    setChangesDescription("");
    setIsEditDialogOpen(true);
  };

  const handleUpdateMaterial = async () => {
    if (!selectedMaterial) return;
    if (selectedVendors.length === 0) {
      toast.error("Please select at least one vendor");
      return;
    }

    console.log("Debug: Updating material with:", {
      id: selectedMaterial.id,
      ...newMaterial,
      vendorIds: selectedVendors,
      primaryVendorId: primaryVendor,
      specificationFile: specificationFile?.name,
      iqcChecklistFile: iqcChecklistFile?.name,
      changesDescription,
    });

    updateRawMaterial.mutate({
      id: selectedMaterial.id,
      ...newMaterial,
      vendorIds: selectedVendors,
      primaryVendorId: primaryVendor,
      specificationFile: specificationFile || undefined,
      iqcChecklistFile: iqcChecklistFile || undefined,
      changesDescription,
    });

    setIsEditDialogOpen(false);
    setSelectedMaterial(null);
  };

  const handleViewMaterial = (material: any) => {
    setViewMaterial(material);
    setIsViewDialogOpen(true);
  };

  const handleVendorChange = (vendorId: string, checked: boolean) => {
    if (checked) {
      setSelectedVendors([...selectedVendors, vendorId]);
      if (selectedVendors.length === 0) {
        setPrimaryVendor(vendorId);
      }
    } else {
      setSelectedVendors(selectedVendors.filter(id => id !== vendorId));
      if (primaryVendor === vendorId) {
        setPrimaryVendor(selectedVendors.filter(id => id !== vendorId)[0] || "");
      }
    }
  };

  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // For now, just show a message. Excel import functionality would need additional implementation
      toast.info("Excel import functionality will be implemented soon");
    }
  };

  const downloadDocument = async (fileName: string, originalName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("raw-material-documents")
        .download(fileName);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const getDocumentUrl = async (fileName: string) => {
    try {
      const { data } = await supabase.storage
        .from("raw-material-documents")
        .createSignedUrl(fileName, 60 * 60); // 1 hour expiry
      
      return data?.signedUrl;
    } catch (error) {
      console.error("Error getting document URL:", error);
      return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Layers className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Raw Materials Management</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelImport}
              className="hidden"
            />
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Raw Material
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Raw Material</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Part Name</Label>
                    <Input 
                      id="name" 
                      value={newMaterial.name} 
                      onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                      placeholder="Enter part name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="category">Part Category</Label>
                    <Select 
                      value={newMaterial.category} 
                      onValueChange={(value) => setNewMaterial({...newMaterial, category: value})}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIAL_CATEGORIES.map((category) => (
                          <SelectItem key={category.name} value={category.name}>
                            {category.name} ({category.prefix}-xxx)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Vendors (Select at least one)</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                      {vendors.map((vendor) => (
                        <div key={vendor.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={vendor.id}
                            checked={selectedVendors.includes(vendor.id)}
                            onCheckedChange={(checked) => handleVendorChange(vendor.id, checked as boolean)}
                          />
                          <Label htmlFor={vendor.id} className="text-sm">
                            {vendor.vendor_code} - {vendor.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedVendors.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="primary-vendor">Primary Vendor</Label>
                      <Select value={primaryVendor} onValueChange={setPrimaryVendor}>
                        <SelectTrigger id="primary-vendor">
                          <SelectValue placeholder="Select primary vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.filter(v => selectedVendors.includes(v.id)).map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.vendor_code} - {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="specification">Specification</Label>
                    <Textarea 
                      id="specification" 
                      value={newMaterial.specification} 
                      onChange={(e) => setNewMaterial({...newMaterial, specification: e.target.value})}
                      placeholder="Enter specification details"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="spec-file">Specification Sheet (PDF)</Label>
                      <Input
                        id="spec-file"
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setSpecificationFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="iqc-file">IQC Checklist (PDF)</Label>
                      <Input
                        id="iqc-file"
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setIqcChecklistFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" onClick={handleAddMaterial} disabled={addRawMaterial.isPending}>
                    {addRawMaterial.isPending ? "Adding..." : "Add Material"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search raw materials..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {MATERIAL_CATEGORIES.map((category) => (
                    <SelectItem key={category.name} value={category.name}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Materials Table */}
        <Card>
          <CardHeader>
            <CardTitle>Raw Materials List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Part Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendors</TableHead>
                  <TableHead>Specification</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6">
                      Loading materials...
                    </TableCell>
                  </TableRow>
                ) : filteredMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No materials found. Try adjusting your search or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {material.material_code}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewMaterial(material)}
                            title="View Material Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{material.name}</TableCell>
                      <TableCell>{material.category}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {material.raw_material_vendors?.map((rv: any) => (
                            <Badge 
                              key={rv.id} 
                              variant={rv.is_primary ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {rv.vendors.vendor_code}
                              {rv.is_primary && " (Primary)"}
                            </Badge>
                          )) || <span className="text-muted-foreground">No vendors</span>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{material.specification || "Not specified"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {material.specification_sheet_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadDocument(material.specification_sheet_url, "specification.pdf")}
                              title="Download Specification Sheet"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          {material.iqc_checklist_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadDocument(material.iqc_checklist_url, "iqc_checklist.pdf")}
                              title="Download IQC Checklist"
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditMaterial(material)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <SpecificationHistorySheet materialId={material.id} />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Raw Material</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{material.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteRawMaterial.mutate(material.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* View Material Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>View Material: {viewMaterial?.material_code}</DialogTitle>
            </DialogHeader>
            {viewMaterial && (
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Part Name</Label>
                    <p className="font-medium">{viewMaterial.name}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Category</Label>
                    <p>{viewMaterial.category}</p>
                  </div>
                </div>

                {viewMaterial.specification && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Specification</Label>
                    <p className="text-sm bg-muted p-3 rounded">{viewMaterial.specification}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <Label className="text-sm font-medium text-muted-foreground">Documents</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewMaterial.specification_sheet_url && (
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Specification Sheet</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadDocument(viewMaterial.specification_sheet_url, "specification.pdf")}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                        <div className="bg-muted rounded h-40 flex items-center justify-center">
                          <FileText className="h-12 w-12 text-muted-foreground" />
                        </div>
                      </div>
                    )}
                    
                    {viewMaterial.iqc_checklist_url && (
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">IQC Checklist</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadDocument(viewMaterial.iqc_checklist_url, "iqc_checklist.pdf")}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                        <div className="bg-muted rounded h-40 flex items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {!viewMaterial.specification_sheet_url && !viewMaterial.iqc_checklist_url && (
                    <p className="text-muted-foreground text-center py-8">No documents uploaded</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Vendors</Label>
                  <div className="flex flex-wrap gap-2">
                    {viewMaterial.raw_material_vendors?.map((rv: any) => (
                      <Badge 
                        key={rv.id} 
                        variant={rv.is_primary ? "default" : "secondary"}
                      >
                        {rv.vendors.vendor_code} - {rv.vendors.name}
                        {rv.is_primary && " (Primary)"}
                      </Badge>
                    )) || <span className="text-muted-foreground">No vendors assigned</span>}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Raw Material</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Part Name</Label>
                <Input 
                  id="edit-name" 
                  value={newMaterial.name} 
                  onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                  placeholder="Enter part name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-category">Part Category</Label>
                <Select 
                  value={newMaterial.category} 
                  onValueChange={(value) => setNewMaterial({...newMaterial, category: value})}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_CATEGORIES.map((category) => (
                      <SelectItem key={category.name} value={category.name}>
                        {category.name} ({category.prefix}-xxx)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vendors (Select at least one)</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                  {vendors.map((vendor) => (
                    <div key={vendor.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-${vendor.id}`}
                        checked={selectedVendors.includes(vendor.id)}
                        onCheckedChange={(checked) => handleVendorChange(vendor.id, checked as boolean)}
                      />
                      <Label htmlFor={`edit-${vendor.id}`} className="text-sm">
                        {vendor.vendor_code} - {vendor.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {selectedVendors.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="edit-primary-vendor">Primary Vendor</Label>
                  <Select value={primaryVendor} onValueChange={setPrimaryVendor}>
                    <SelectTrigger id="edit-primary-vendor">
                      <SelectValue placeholder="Select primary vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.filter(v => selectedVendors.includes(v.id)).map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.vendor_code} - {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-specification">Specification</Label>
                <Textarea 
                  id="edit-specification" 
                  value={newMaterial.specification} 
                  onChange={(e) => setNewMaterial({...newMaterial, specification: e.target.value})}
                  placeholder="Enter specification details"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-spec-file">New Specification Sheet (PDF)</Label>
                  <Input
                    id="edit-spec-file"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSpecificationFile(e.target.files?.[0] || null)}
                  />
                  {selectedMaterial?.specification_sheet_url && (
                    <p className="text-xs text-muted-foreground">Current file will be replaced if new file is uploaded</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-iqc-file">New IQC Checklist (PDF)</Label>
                  <Input
                    id="edit-iqc-file"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setIqcChecklistFile(e.target.files?.[0] || null)}
                  />
                  {selectedMaterial?.iqc_checklist_url && (
                    <p className="text-xs text-muted-foreground">Current file will be replaced if new file is uploaded</p>
                  )}
                </div>
              </div>

              {(specificationFile || iqcChecklistFile) && (
                <div className="space-y-2">
                  <Label htmlFor="changes-description">Changes Description</Label>
                  <Textarea 
                    id="changes-description" 
                    value={changesDescription} 
                    onChange={(e) => setChangesDescription(e.target.value)}
                    placeholder="Describe the changes made to specifications"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={handleUpdateMaterial} 
                disabled={updateRawMaterial.isPending}
              >
                {updateRawMaterial.isPending ? "Updating..." : "Update Material"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Specification History Component
const SpecificationHistorySheet = ({ materialId }: { materialId: string }) => {
  const { data: history = [] } = useSpecificationHistory(materialId);

  const downloadDocument = async (fileName: string, originalName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("raw-material-documents")
        .download(fileName);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" title="View Specification History">
          <History className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[600px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle>Specification History</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          {history.length === 0 ? (
            <p className="text-muted-foreground">No specification history found.</p>
          ) : (
            <div className="space-y-4">
              {history.map((spec) => (
                <Card key={spec.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Version {spec.version_number}</CardTitle>
                      <Badge variant="outline">
                        {new Date(spec.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {spec.changes_description && (
                      <p className="text-sm text-muted-foreground">{spec.changes_description}</p>
                    )}
                    <div className="flex gap-2">
                      {spec.specification_sheet_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDocument(spec.specification_sheet_url, `specification_v${spec.version_number}.pdf`)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Specification
                        </Button>
                      )}
                      {spec.iqc_checklist_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDocument(spec.iqc_checklist_url, `iqc_checklist_v${spec.version_number}.pdf`)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          IQC Checklist
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default RawMaterialsManagement;
