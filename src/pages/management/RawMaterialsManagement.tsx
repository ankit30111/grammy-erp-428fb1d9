
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const queryClient = useQueryClient();

  const [newMaterial, setNewMaterial] = useState({
    name: "",
    material_code: "",
    category: "",
    unit_of_measure: "",
    specification: ""
  });

  // Fetch raw materials
  const { data: rawMaterials = [], isLoading } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select(`
          *,
          raw_material_vendors(
            id,
            is_primary,
            vendor_id,
            vendors(
              id,
              name,
              vendor_code
            )
          )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Add raw material mutation
  const addRawMaterial = useMutation({
    mutationFn: async (materialData: typeof newMaterial & {
      vendorIds?: string[];
      primaryVendorId?: string;
      specificationFile?: File;
      iqcChecklistFile?: File;
    }) => {
      let specificationUrl = null;
      let iqcChecklistUrl = null;

      // Upload specification sheet if provided
      if (materialData.specificationFile) {
        const fileName = `specifications/${Date.now()}_${materialData.specificationFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("raw-material-documents")
          .upload(fileName, materialData.specificationFile);
        
        if (uploadError) throw uploadError;
        specificationUrl = fileName;
      }

      // Upload IQC checklist if provided
      if (materialData.iqcChecklistFile) {
        const fileName = `iqc_checklists/${Date.now()}_${materialData.iqcChecklistFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("raw-material-documents")
          .upload(fileName, materialData.iqcChecklistFile);
        
        if (uploadError) throw uploadError;
        iqcChecklistUrl = fileName;
      }

      // Insert raw material
      const { data: material, error: materialError } = await supabase
        .from("raw_materials")
        .insert({
          name: materialData.name,
          material_code: materialData.material_code,
          category: materialData.category,
          unit_of_measure: materialData.unit_of_measure,
          specification: materialData.specification || "",
          specification_sheet_url: specificationUrl,
          iqc_checklist_url: iqcChecklistUrl,
        })
        .select()
        .single();

      if (materialError) throw materialError;

      // Add vendor relationships if vendors are provided
      if (materialData.vendorIds && materialData.vendorIds.length > 0) {
        const vendorRelations = materialData.vendorIds.map(vendorId => ({
          raw_material_id: material.id,
          vendor_id: vendorId,
          is_primary: vendorId === materialData.primaryVendorId,
        }));

        const { error: vendorError } = await supabase
          .from("raw_material_vendors")
          .insert(vendorRelations);

        if (vendorError) throw vendorError;
      }

      return material;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success("Raw material added successfully");
    },
    onError: (error) => {
      console.error("Error adding raw material:", error);
      toast.error("Failed to add raw material");
    },
  });

  // Update raw material mutation
  const updateRawMaterial = useMutation({
    mutationFn: async (data: {
      id: string;
    } & typeof newMaterial & {
      vendorIds?: string[];
      primaryVendorId?: string;
      specificationFile?: File;
      iqcChecklistFile?: File;
    }) => {
      let specificationUrl = null;
      let iqcChecklistUrl = null;

      // Upload new specification sheet if provided
      if (data.specificationFile) {
        const fileName = `specifications/${data.id}_${Date.now()}_${data.specificationFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("raw-material-documents")
          .upload(fileName, data.specificationFile);
        
        if (uploadError) throw uploadError;
        specificationUrl = fileName;
      }

      // Upload new IQC checklist if provided
      if (data.iqcChecklistFile) {
        const fileName = `iqc_checklists/${data.id}_${Date.now()}_${data.iqcChecklistFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("raw-material-documents")
          .upload(fileName, data.iqcChecklistFile);
        
        if (uploadError) throw uploadError;
        iqcChecklistUrl = fileName;
      }

      // Update raw material
      const updateData: any = {
        name: data.name,
        material_code: data.material_code,
        category: data.category,
        unit_of_measure: data.unit_of_measure,
        specification: data.specification || "",
        updated_at: new Date().toISOString(),
      };

      if (specificationUrl) updateData.specification_sheet_url = specificationUrl;
      if (iqcChecklistUrl) updateData.iqc_checklist_url = iqcChecklistUrl;

      const { error: materialError } = await supabase
        .from("raw_materials")
        .update(updateData)
        .eq("id", data.id);

      if (materialError) throw materialError;

      // Update vendor relationships
      // First delete existing relationships
      const { error: deleteError } = await supabase
        .from("raw_material_vendors")
        .delete()
        .eq("raw_material_id", data.id);

      if (deleteError) throw deleteError;

      // Add new vendor relationships if vendors are provided
      if (data.vendorIds && data.vendorIds.length > 0) {
        const vendorRelations = data.vendorIds.map(vendorId => ({
          raw_material_id: data.id,
          vendor_id: vendorId,
          is_primary: vendorId === data.primaryVendorId,
        }));

        const { error: vendorError } = await supabase
          .from("raw_material_vendors")
          .insert(vendorRelations);

        if (vendorError) throw vendorError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success("Raw material updated successfully");
    },
    onError: (error: any) => {
      console.error("Error updating raw material:", error);
      toast.error("Failed to update raw material");
    },
  });

  // Delete raw material mutation
  const deleteRawMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("raw_materials")
        .update({ is_active: false })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      toast.success("Raw material deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting raw material:", error);
      toast.error("Failed to delete raw material");
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
    if (!newMaterial.name.trim()) {
      toast.error("Part Name is required");
      return;
    }

    if (!newMaterial.category.trim()) {
      toast.error("Part Category is required");
      return;
    }

    setIsUploading(true);
    try {
      await addRawMaterial.mutateAsync({
        ...newMaterial,
        vendorIds: selectedVendors,
        primaryVendorId: primaryVendor,
        specificationFile: specificationFile || undefined,
        iqcChecklistFile: iqcChecklistFile || undefined,
      });

      // Reset form
      setNewMaterial({ name: "", material_code: "", category: "", unit_of_measure: "", specification: "" });
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
      material_code: material.material_code,
      category: material.category,
      unit_of_measure: material.unit_of_measure || "",
      specification: material.specification || ""
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
        ...newMaterial,
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
                    <Label htmlFor="material_code">Part Code</Label>
                    <Input 
                      id="material_code" 
                      value={newMaterial.material_code} 
                      onChange={(e) => setNewMaterial({...newMaterial, material_code: e.target.value})}
                      placeholder="Enter part code (leave empty for auto-generation)"
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
                    disabled={isUploading || addRawMaterial.isPending || !newMaterial.name.trim() || !newMaterial.category.trim()}
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
                  <TableHead>Unit</TableHead>
                  <TableHead>Vendors</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6">
                      Loading materials...
                    </TableCell>
                  </TableRow>
                ) : filteredMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No materials found. Try adjusting your search or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium">{material.material_code}</TableCell>
                      <TableCell>{material.name}</TableCell>
                      <TableCell>{material.category}</TableCell>
                      <TableCell>{material.unit_of_measure || "N/A"}</TableCell>
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
                    <p>{viewMaterial.unit_of_measure || "N/A"}</p>
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
                <Label htmlFor="edit-material_code">Part Code</Label>
                <Input 
                  id="edit-material_code" 
                  value={newMaterial.material_code} 
                  onChange={(e) => setNewMaterial({...newMaterial, material_code: e.target.value})}
                  placeholder="Enter part code"
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
