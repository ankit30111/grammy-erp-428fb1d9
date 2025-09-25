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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { 
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from "@/components/ui/command";
import { 
  Popover, PopoverContent, PopoverTrigger 
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Layers, FileText, Package, Upload, Edit, Trash2, Download, Eye, ExternalLink, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import { useVendors } from "@/hooks/useVendors";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Unit of Measure options
const UNIT_OPTIONS = [
  "PCS", "KG", "METER", "LITER", "SET", "PACK", "ROLL", "SHEET", "BOX"
];

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
  const [isUploading, setIsUploading] = useState(false);
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [vendorSearchValue, setVendorSearchValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newMaterial, setNewMaterial] = useState({
    name: "",
    material_code: "",
    category: "",
    unit_of_measure: "",
    specification: "",
    sourcing_type: "LOCAL" as 'IMPORTED' | 'LOCAL',
    currency: "",
    unit_price: "",
    cbm_per_unit: "",
    supplier_country: ""
  });

  // Use the existing hooks
  const { rawMaterials, isLoading, addRawMaterial, updateRawMaterial, deleteRawMaterial } = useRawMaterials();
  const { vendors = [] } = useVendors();

  // Filter materials based on search and category
  const filteredMaterials = rawMaterials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         material.material_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || material.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddMaterial = async () => {
    if (!newMaterial.name.trim()) {
      toast.error("Part Name is required");
      return;
    }

    if (!newMaterial.material_code.trim()) {
      toast.error("Material Code is required");
      return;
    }

    if (!newMaterial.category.trim()) {
      toast.error("Part Category is required");
      return;
    }

    setIsUploading(true);
    try {
      await addRawMaterial.mutateAsync({
        name: newMaterial.name,
        material_code: newMaterial.material_code,
        category: newMaterial.category,
        specification: newMaterial.specification,
        sourcing_type: newMaterial.sourcing_type,
        currency: newMaterial.sourcing_type === 'IMPORTED' ? newMaterial.currency : undefined,
        unit_price: newMaterial.unit_price ? parseFloat(newMaterial.unit_price) : undefined,
        cbm_per_unit: newMaterial.cbm_per_unit ? parseFloat(newMaterial.cbm_per_unit) : undefined,
        supplier_country: newMaterial.sourcing_type === 'IMPORTED' ? newMaterial.supplier_country : undefined,
        vendorIds: selectedVendors,
        primaryVendorId: primaryVendor,
        specificationFile: specificationFile || undefined,
        iqcChecklistFile: iqcChecklistFile || undefined,
      });

      // Reset form
      setNewMaterial({ 
        name: "", 
        material_code: "", 
        category: "", 
        unit_of_measure: "", 
        specification: "",
        sourcing_type: "LOCAL",
        currency: "",
        unit_price: "",
        cbm_per_unit: "",
        supplier_country: ""
      });
      setSelectedVendors([]);
      setPrimaryVendor("");
      setSpecificationFile(null);
      setIqcChecklistFile(null);
      setVendorSearchValue("");
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Add material error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditMaterial = (material: any) => {
    setSelectedMaterial(material);
    setNewMaterial({
      name: material.name,
      material_code: material.material_code || "",
      category: material.category,
      unit_of_measure: material.unit_of_measure || "",
      specification: material.specification || "",
      sourcing_type: material.sourcing_type || "LOCAL",
      currency: material.currency || "",
      unit_price: material.unit_price?.toString() || "",
      cbm_per_unit: material.cbm_per_unit?.toString() || "",
      supplier_country: material.supplier_country || ""
    });
    setSelectedVendors(material.raw_material_vendors?.map((rv: any) => rv.vendors.id) || []);
    setPrimaryVendor(material.raw_material_vendors?.find((rv: any) => rv.is_primary)?.vendors.id || "");
    setSpecificationFile(null);
    setIqcChecklistFile(null);
    setIsEditDialogOpen(true);
  };

  const handleUpdateMaterial = async () => {
    if (!selectedMaterial) return;

    setIsUploading(true);
    try {
      await updateRawMaterial.mutateAsync({
        id: selectedMaterial.id,
        name: newMaterial.name,
        material_code: newMaterial.material_code,
        category: newMaterial.category,
        specification: newMaterial.specification,
        sourcing_type: newMaterial.sourcing_type,
        currency: newMaterial.sourcing_type === 'IMPORTED' ? newMaterial.currency : undefined,
        unit_price: newMaterial.unit_price ? parseFloat(newMaterial.unit_price) : undefined,
        cbm_per_unit: newMaterial.cbm_per_unit ? parseFloat(newMaterial.cbm_per_unit) : undefined,
        supplier_country: newMaterial.sourcing_type === 'IMPORTED' ? newMaterial.supplier_country : undefined,
        vendorIds: selectedVendors,
        primaryVendorId: primaryVendor,
        specificationFile: specificationFile || undefined,
        iqcChecklistFile: iqcChecklistFile || undefined,
      });

      setIsEditDialogOpen(false);
      setSelectedMaterial(null);
    } catch (error) {
      console.error("Update material error:", error);
    } finally {
      setIsUploading(false);
    }
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

  const downloadDocument = async (fileName: string, originalName: string) => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
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

  const openDocument = async (fileName: string) => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.storage
        .from("raw-material-documents")
        .createSignedUrl(fileName, 60 * 60); // 1 hour expiry
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        toast.error("Failed to open document");
      }
    } catch (error) {
      console.error("Error opening document:", error);
      toast.error("Failed to open document");
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
                    <Label htmlFor="name">Part Name *</Label>
                    <Input 
                      id="name" 
                      value={newMaterial.name} 
                      onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                      placeholder="Enter part name"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="material_code">Material Code *</Label>
                    <Input 
                      id="material_code" 
                      value={newMaterial.material_code} 
                      onChange={(e) => setNewMaterial({...newMaterial, material_code: e.target.value.toUpperCase()})}
                      placeholder="Enter material code (e.g., B-001, C-002)"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="category">Part Category *</Label>
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
                    <Label htmlFor="unit_of_measure">Unit of Measure</Label>
                    <Select 
                      value={newMaterial.unit_of_measure} 
                      onValueChange={(value) => setNewMaterial({...newMaterial, unit_of_measure: value})}
                    >
                      <SelectTrigger id="unit_of_measure">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sourcing Type */}
                  <div className="space-y-2">
                    <Label htmlFor="sourcing_type">Sourcing Type *</Label>
                    <Select 
                      value={newMaterial.sourcing_type} 
                      onValueChange={(value: 'IMPORTED' | 'LOCAL') => setNewMaterial({
                        ...newMaterial, 
                        sourcing_type: value,
                        // Reset currency fields when switching to LOCAL
                        currency: value === 'LOCAL' ? '' : newMaterial.currency,
                        cbm_per_unit: value === 'LOCAL' ? '' : newMaterial.cbm_per_unit,
                        supplier_country: value === 'LOCAL' ? '' : newMaterial.supplier_country
                      })}
                    >
                      <SelectTrigger id="sourcing_type">
                        <SelectValue placeholder="Select sourcing type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOCAL">Local</SelectItem>
                        <SelectItem value="IMPORTED">Imported</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Currency - Only for imported materials */}
                  {newMaterial.sourcing_type === 'IMPORTED' && (
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency *</Label>
                      <Select 
                        value={newMaterial.currency} 
                        onValueChange={(value) => setNewMaterial({...newMaterial, currency: value})}
                      >
                        <SelectTrigger id="currency">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="RMB">RMB (¥)</SelectItem>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Unit Price */}
                  <div className="space-y-2">
                    <Label htmlFor="unit_price">
                      Unit Price {newMaterial.sourcing_type === 'IMPORTED' && newMaterial.currency && `(${newMaterial.currency})`}
                    </Label>
                    <Input 
                      id="unit_price" 
                      type="number"
                      step="0.01"
                      value={newMaterial.unit_price} 
                      onChange={(e) => setNewMaterial({...newMaterial, unit_price: e.target.value})}
                      placeholder="Enter unit price"
                    />
                  </div>

                  {/* CBM per unit - Only for imported materials */}
                  {newMaterial.sourcing_type === 'IMPORTED' && (
                    <div className="space-y-2">
                      <Label htmlFor="cbm_per_unit">CBM per Unit</Label>
                      <Input 
                        id="cbm_per_unit" 
                        type="number"
                        step="0.0001"
                        value={newMaterial.cbm_per_unit} 
                        onChange={(e) => setNewMaterial({...newMaterial, cbm_per_unit: e.target.value})}
                        placeholder="Cubic meters per unit"
                      />
                      <p className="text-sm text-muted-foreground">
                        Used for container space calculation and cost allocation
                      </p>
                    </div>
                  )}

                  {/* Supplier Country - Only for imported materials */}
                  {newMaterial.sourcing_type === 'IMPORTED' && (
                    <div className="space-y-2">
                      <Label htmlFor="supplier_country">Supplier Country</Label>
                      <Input 
                        id="supplier_country" 
                        value={newMaterial.supplier_country} 
                        onChange={(e) => setNewMaterial({...newMaterial, supplier_country: e.target.value})}
                        placeholder="Enter supplier country"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Vendors (Optional)</Label>
                    <Popover open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={vendorSearchOpen}
                          className="w-full justify-between"
                        >
                          {selectedVendors.length > 0
                            ? `${selectedVendors.length} vendor(s) selected`
                            : "Search and select vendors..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput 
                            placeholder="Search vendors..." 
                            value={vendorSearchValue}
                            onValueChange={setVendorSearchValue}
                          />
                          <CommandList>
                            <CommandEmpty>No vendors found.</CommandEmpty>
                            <CommandGroup>
                              {vendors
                                .filter(vendor => 
                                  vendor.name.toLowerCase().includes(vendorSearchValue.toLowerCase()) ||
                                  vendor.vendor_code.toLowerCase().includes(vendorSearchValue.toLowerCase())
                                )
                                .map((vendor) => (
                                <CommandItem
                                  key={vendor.id}
                                  onSelect={() => {
                                    const isSelected = selectedVendors.includes(vendor.id);
                                    handleVendorChange(vendor.id, !isSelected);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedVendors.includes(vendor.id) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{vendor.vendor_code} - {vendor.name}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    
                    {selectedVendors.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedVendors.map(vendorId => {
                          const vendor = vendors.find(v => v.id === vendorId);
                          if (!vendor) return null;
                          return (
                            <Badge 
                              key={vendorId} 
                              variant={vendorId === primaryVendor ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {vendor.vendor_code}
                              {vendorId === primaryVendor && " (Primary)"}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
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
                  <Button 
                    type="submit" 
                    onClick={handleAddMaterial} 
                    disabled={isUploading || addRawMaterial.isPending || !newMaterial.name.trim() || !newMaterial.material_code.trim() || !newMaterial.category.trim()}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : addRawMaterial.isPending ? (
                      "Adding..."
                    ) : (
                      "Add Material"
                    )}
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
                  <TableHead>Sourcing</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Vendors</TableHead>
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
                      <TableCell className="font-medium">{material.material_code}</TableCell>
                      <TableCell>{material.name}</TableCell>
                      <TableCell>{material.category}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant={(material as any).sourcing_type === 'IMPORTED' ? "default" : "secondary"}
                            className="w-fit text-xs"
                          >
                            {(material as any).sourcing_type || 'LOCAL'}
                          </Badge>
                          {(material as any).sourcing_type === 'IMPORTED' && (material as any).supplier_country && (
                            <span className="text-xs text-muted-foreground">
                              {(material as any).supplier_country}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(material as any).unit_price ? (
                          <div className="text-sm">
                            <span className="font-medium">
                              {(material as any).currency || 'INR'} {(material as any).unit_price}
                            </span>
                            {(material as any).cbm_per_unit && (
                              <div className="text-xs text-muted-foreground">
                                CBM: {(material as any).cbm_per_unit}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No price</span>
                        )}
                      </TableCell>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewMaterial(material)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditMaterial(material)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
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
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Unit</Label>
                    <p>{(viewMaterial as any).unit_of_measure || "N/A"}</p>
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
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDocument(viewMaterial.specification_sheet_url)}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadDocument(viewMaterial.specification_sheet_url, "specification.pdf")}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </div>
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
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDocument(viewMaterial.iqc_checklist_url)}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadDocument(viewMaterial.iqc_checklist_url, "iqc_checklist.pdf")}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </div>
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
                <Label htmlFor="edit-material-code">Material Code</Label>
                <Input 
                  id="edit-material-code" 
                  value={newMaterial.material_code} 
                  onChange={(e) => setNewMaterial({...newMaterial, material_code: e.target.value.toUpperCase()})}
                  placeholder="Enter material code (e.g., B-001, C-002)"
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
                <Label htmlFor="edit-unit_of_measure">Unit of Measure</Label>
                <Select 
                  value={newMaterial.unit_of_measure} 
                  onValueChange={(value) => setNewMaterial({...newMaterial, unit_of_measure: value})}
                >
                  <SelectTrigger id="edit-unit_of_measure">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Edit Sourcing Type */}
              <div className="space-y-2">
                <Label htmlFor="edit-sourcing_type">Sourcing Type *</Label>
                <Select 
                  value={newMaterial.sourcing_type} 
                  onValueChange={(value: 'IMPORTED' | 'LOCAL') => setNewMaterial({
                    ...newMaterial, 
                    sourcing_type: value,
                    // Reset currency fields when switching to LOCAL
                    currency: value === 'LOCAL' ? '' : newMaterial.currency,
                    cbm_per_unit: value === 'LOCAL' ? '' : newMaterial.cbm_per_unit,
                    supplier_country: value === 'LOCAL' ? '' : newMaterial.supplier_country
                  })}
                >
                  <SelectTrigger id="edit-sourcing_type">
                    <SelectValue placeholder="Select sourcing type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCAL">Local</SelectItem>
                    <SelectItem value="IMPORTED">Imported</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Edit Currency - Only for imported materials */}
              {newMaterial.sourcing_type === 'IMPORTED' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-currency">Currency *</Label>
                  <Select 
                    value={newMaterial.currency} 
                    onValueChange={(value) => setNewMaterial({...newMaterial, currency: value})}
                  >
                    <SelectTrigger id="edit-currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="RMB">RMB (¥)</SelectItem>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Edit Unit Price */}
              <div className="space-y-2">
                <Label htmlFor="edit-unit_price">
                  Unit Price {newMaterial.sourcing_type === 'IMPORTED' && newMaterial.currency && `(${newMaterial.currency})`}
                </Label>
                <Input 
                  id="edit-unit_price" 
                  type="number"
                  step="0.01"
                  value={newMaterial.unit_price} 
                  onChange={(e) => setNewMaterial({...newMaterial, unit_price: e.target.value})}
                  placeholder="Enter unit price"
                />
              </div>

              {/* Edit CBM per unit - Only for imported materials */}
              {newMaterial.sourcing_type === 'IMPORTED' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-cbm_per_unit">CBM per Unit</Label>
                  <Input 
                    id="edit-cbm_per_unit" 
                    type="number"
                    step="0.0001"
                    value={newMaterial.cbm_per_unit} 
                    onChange={(e) => setNewMaterial({...newMaterial, cbm_per_unit: e.target.value})}
                    placeholder="Cubic meters per unit"
                  />
                  <p className="text-sm text-muted-foreground">
                    Used for container space calculation and cost allocation
                  </p>
                </div>
              )}

              {/* Edit Supplier Country - Only for imported materials */}
              {newMaterial.sourcing_type === 'IMPORTED' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-supplier_country">Supplier Country</Label>
                  <Input 
                    id="edit-supplier_country" 
                    value={newMaterial.supplier_country} 
                    onChange={(e) => setNewMaterial({...newMaterial, supplier_country: e.target.value})}
                    placeholder="Enter supplier country"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Vendors</Label>
                <Popover open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={vendorSearchOpen}
                      className="w-full justify-between"
                    >
                      {selectedVendors.length > 0
                        ? `${selectedVendors.length} vendor(s) selected`
                        : "Search and select vendors..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput 
                        placeholder="Search vendors..." 
                        value={vendorSearchValue}
                        onValueChange={setVendorSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty>No vendors found.</CommandEmpty>
                        <CommandGroup>
                          {vendors
                            .filter(vendor => 
                              vendor.name.toLowerCase().includes(vendorSearchValue.toLowerCase()) ||
                              vendor.vendor_code.toLowerCase().includes(vendorSearchValue.toLowerCase())
                            )
                            .map((vendor) => (
                            <CommandItem
                              key={vendor.id}
                              onSelect={() => {
                                const isSelected = selectedVendors.includes(vendor.id);
                                handleVendorChange(vendor.id, !isSelected);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedVendors.includes(vendor.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{vendor.vendor_code} - {vendor.name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {selectedVendors.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedVendors.map(vendorId => {
                      const vendor = vendors.find(v => v.id === vendorId);
                      if (!vendor) return null;
                      return (
                        <Badge 
                          key={vendorId} 
                          variant={vendorId === primaryVendor ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {vendor.vendor_code}
                          {vendorId === primaryVendor && " (Primary)"}
                        </Badge>
                      );
                    })}
                  </div>
                )}
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
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={handleUpdateMaterial} 
                disabled={isUploading || updateRawMaterial.isPending}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : updateRawMaterial.isPending ? (
                  "Updating..."
                ) : (
                  "Update Material"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default RawMaterialsManagement;
