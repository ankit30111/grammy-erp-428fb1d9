
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
import { Search, Plus, Package, Upload, FileText, Edit, Trash2 } from "lucide-react";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Vendor {
  id: string;
  name: string;
  vendor_code: string;
}

const RawMaterialsManagement = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const { toast } = useToast();

  // Debug: Let's also fetch data directly to see what's happening
  const { data: debugRawMaterials, isLoading: debugLoading, error: debugError } = useQuery({
    queryKey: ["debug-raw-materials"],
    queryFn: async () => {
      console.log("Debug: Fetching raw materials...");
      const { data, error } = await supabase
        .from("raw_materials")
        .select("*")
        .eq("is_active", true);
      
      console.log("Debug raw materials data:", data);
      console.log("Debug raw materials error:", error);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-for-materials"],
    queryFn: async () => {
      console.log("Debug: Fetching vendors...");
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, vendor_code")
        .eq("is_active", true);
      
      console.log("Debug vendors data:", data);
      console.log("Debug vendors error:", error);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { rawMaterials, isLoading, addRawMaterial, updateRawMaterial, deleteRawMaterial } = useRawMaterials();

  console.log("Hook raw materials:", rawMaterials);
  console.log("Debug raw materials:", debugRawMaterials);
  console.log("Is loading:", isLoading, debugLoading);
  console.log("Debug error:", debugError);

  const [newMaterial, setNewMaterial] = useState({
    name: "",
    category: "Others",
    specification: "",
    vendorIds: [] as string[],
    primaryVendorId: "",
    specificationFile: null as File | null,
    iqcChecklistFile: null as File | null,
    changesDescription: ""
  });

  const filteredMaterials = rawMaterials.filter(material => 
    material.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    material.material_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    material.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = [
    "Packaging", "Wire", "Consumables", "PCB", "Gasket", 
    "Loudspeaker", "Metal", "Others", "Plastic", "Remote", 
    "Sticker", "Transformer", "Wooden", "Connector", "Screw"
  ];

  const handleAddMaterial = async () => {
    if (!newMaterial.name || !newMaterial.category) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await addRawMaterial.mutateAsync(newMaterial);
      setNewMaterial({
        name: "",
        category: "Others",
        specification: "",
        vendorIds: [],
        primaryVendorId: "",
        specificationFile: null,
        iqcChecklistFile: null,
        changesDescription: ""
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error adding material:", error);
      toast({
        title: "Error",
        description: "Failed to add raw material",
        variant: "destructive",
      });
    }
  };

  const handleEditMaterial = async () => {
    if (!editingMaterial || !newMaterial.name || !newMaterial.category) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateRawMaterial.mutateAsync({
        id: editingMaterial.id,
        ...newMaterial,
      });
      setIsEditDialogOpen(false);
      setEditingMaterial(null);
    } catch (error) {
      console.error("Error updating material:", error);
      toast({
        title: "Error",
        description: "Failed to update raw material",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      await deleteRawMaterial.mutateAsync(materialId);
    } catch (error) {
      console.error("Error deleting material:", error);
      toast({
        title: "Error",
        description: "Failed to delete raw material",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (material: any) => {
    setEditingMaterial(material);
    setNewMaterial({
      name: material.name,
      category: material.category,
      specification: material.specification || "",
      vendorIds: material.raw_material_vendors?.map((rv: any) => rv.vendor_id) || [],
      primaryVendorId: material.raw_material_vendors?.find((rv: any) => rv.is_primary)?.vendor_id || "",
      specificationFile: null,
      iqcChecklistFile: null,
      changesDescription: ""
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setNewMaterial({
      name: "",
      category: "Others",
      specification: "",
      vendorIds: [],
      primaryVendorId: "",
      specificationFile: null,
      iqcChecklistFile: null,
      changesDescription: ""
    });
  };

  if (isLoading && debugLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-lg">Loading raw materials...</div>
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
            <Package className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Raw Materials Management</h1>
          </div>
          
          {/* Debug Information */}
          <div className="text-sm text-gray-500">
            Hook: {rawMaterials.length} | Debug: {debugRawMaterials?.length || 0} materials
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add New Material
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Raw Material</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Material Name *</Label>
                    <Input 
                      id="name" 
                      value={newMaterial.name} 
                      onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                      placeholder="Enter material name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <select 
                      id="category"
                      value={newMaterial.category} 
                      onChange={(e) => setNewMaterial({...newMaterial, category: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      required
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specification">Specification</Label>
                  <Textarea 
                    id="specification" 
                    value={newMaterial.specification} 
                    onChange={(e) => setNewMaterial({...newMaterial, specification: e.target.value})}
                    placeholder="Enter material specifications"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendors">Vendors</Label>
                    <div className="max-h-32 overflow-y-auto border rounded p-2">
                      {vendors.map((vendor: Vendor) => (
                        <div key={vendor.id} className="flex items-center space-x-2 mb-2">
                          <input
                            type="checkbox"
                            id={`vendor-${vendor.id}`}
                            checked={newMaterial.vendorIds.includes(vendor.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewMaterial({
                                  ...newMaterial,
                                  vendorIds: [...newMaterial.vendorIds, vendor.id]
                                });
                              } else {
                                setNewMaterial({
                                  ...newMaterial,
                                  vendorIds: newMaterial.vendorIds.filter(id => id !== vendor.id),
                                  primaryVendorId: newMaterial.primaryVendorId === vendor.id ? "" : newMaterial.primaryVendorId
                                });
                              }
                            }}
                          />
                          <label htmlFor={`vendor-${vendor.id}`} className="text-sm">
                            {vendor.name} ({vendor.vendor_code})
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primary_vendor">Primary Vendor</Label>
                    <select 
                      id="primary_vendor"
                      value={newMaterial.primaryVendorId} 
                      onChange={(e) => setNewMaterial({...newMaterial, primaryVendorId: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select Primary Vendor</option>
                      {vendors
                        .filter((vendor: Vendor) => newMaterial.vendorIds.includes(vendor.id))
                        .map((vendor: Vendor) => (
                          <option key={vendor.id} value={vendor.id}>
                            {vendor.name} ({vendor.vendor_code})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="spec_file">Specification Sheet (PDF)</Label>
                    <Input 
                      id="spec_file" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewMaterial({...newMaterial, specificationFile: e.target.files?.[0] || null})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iqc_file">IQC Checklist (PDF)</Label>
                    <Input 
                      id="iqc_file" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewMaterial({...newMaterial, iqcChecklistFile: e.target.files?.[0] || null})}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleAddMaterial}
                  disabled={!newMaterial.name || !newMaterial.category || addRawMaterial.isPending}
                >
                  {addRawMaterial.isPending ? "Adding..." : "Add Material"}
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
                placeholder="Search materials..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Raw Materials List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Primary Vendor</TableHead>
                  <TableHead>Total Vendors</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      {isLoading ? "Loading..." : "No raw materials found. Try adjusting your search or add a new material."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map((material) => {
                    const primaryVendor = material.raw_material_vendors?.find((rv: any) => rv.is_primary)?.vendors;
                    const totalVendors = material.raw_material_vendors?.length || 0;
                    
                    return (
                      <TableRow key={material.id}>
                        <TableCell className="font-medium">{material.material_code}</TableCell>
                        <TableCell>{material.name}</TableCell>
                        <TableCell>{material.category}</TableCell>
                        <TableCell>{primaryVendor?.name || '-'}</TableCell>
                        <TableCell>{totalVendors}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openEditDialog(material)}
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
                                    This will deactivate the material "{material.name}". This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteMaterial(material.id)}>
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
                                  <SheetTitle>{material.name} Details</SheetTitle>
                                </SheetHeader>
                                <div className="py-4 space-y-6">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <span className="text-muted-foreground text-sm">Material Code:</span>
                                      <p className="font-medium">{material.material_code}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground text-sm">Category:</span>
                                      <p>{material.category}</p>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground text-sm">Specification:</span>
                                    <p className="mt-1">{material.specification || 'No specification provided'}</p>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground text-sm">Vendors:</span>
                                    <div className="mt-2 space-y-2">
                                      {material.raw_material_vendors?.map((rv: any) => (
                                        <div key={rv.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                          <span>{rv.vendors?.name} ({rv.vendors?.vendor_code})</span>
                                          {rv.is_primary && <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">Primary</span>}
                                        </div>
                                      )) || <p className="text-muted-foreground">No vendors assigned</p>}
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <h4 className="font-medium">Documents</h4>
                                    <div className="flex flex-col space-y-2">
                                      {material.specification_sheet_url && (
                                        <a 
                                          href={material.specification_sheet_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                        >
                                          <FileText className="h-4 w-4" />
                                          <span>Specification Sheet</span>
                                        </a>
                                      )}
                                      {material.iqc_checklist_url && (
                                        <a 
                                          href={material.iqc_checklist_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                        >
                                          <FileText className="h-4 w-4" />
                                          <span>IQC Checklist</span>
                                        </a>
                                      )}
                                      {!material.specification_sheet_url && !material.iqc_checklist_url && (
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingMaterial(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Raw Material</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_name">Material Name *</Label>
                  <Input 
                    id="edit_name" 
                    value={newMaterial.name} 
                    onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                    placeholder="Enter material name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_category">Category *</Label>
                  <select 
                    id="edit_category"
                    value={newMaterial.category} 
                    onChange={(e) => setNewMaterial({...newMaterial, category: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    required
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_specification">Specification</Label>
                <Textarea 
                  id="edit_specification" 
                  value={newMaterial.specification} 
                  onChange={(e) => setNewMaterial({...newMaterial, specification: e.target.value})}
                  placeholder="Enter material specifications"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_vendors">Vendors</Label>
                  <div className="max-h-32 overflow-y-auto border rounded p-2">
                    {vendors.map((vendor: Vendor) => (
                      <div key={vendor.id} className="flex items-center space-x-2 mb-2">
                        <input
                          type="checkbox"
                          id={`edit-vendor-${vendor.id}`}
                          checked={newMaterial.vendorIds.includes(vendor.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewMaterial({
                                ...newMaterial,
                                vendorIds: [...newMaterial.vendorIds, vendor.id]
                              });
                            } else {
                              setNewMaterial({
                                ...newMaterial,
                                vendorIds: newMaterial.vendorIds.filter(id => id !== vendor.id),
                                primaryVendorId: newMaterial.primaryVendorId === vendor.id ? "" : newMaterial.primaryVendorId
                              });
                            }
                          }}
                        />
                        <label htmlFor={`edit-vendor-${vendor.id}`} className="text-sm">
                          {vendor.name} ({vendor.vendor_code})
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_primary_vendor">Primary Vendor</Label>
                  <select 
                    id="edit_primary_vendor"
                    value={newMaterial.primaryVendorId} 
                    onChange={(e) => setNewMaterial({...newMaterial, primaryVendorId: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select Primary Vendor</option>
                    {vendors
                      .filter((vendor: Vendor) => newMaterial.vendorIds.includes(vendor.id))
                      .map((vendor: Vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name} ({vendor.vendor_code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_spec_file">Specification Sheet (PDF) - Upload new to replace</Label>
                  <Input 
                    id="edit_spec_file" 
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setNewMaterial({...newMaterial, specificationFile: e.target.files?.[0] || null})}
                  />
                  {editingMaterial?.specification_sheet_url && (
                    <p className="text-sm text-gray-500">Current: Specification sheet uploaded</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_iqc_file">IQC Checklist (PDF) - Upload new to replace</Label>
                  <Input 
                    id="edit_iqc_file" 
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setNewMaterial({...newMaterial, iqcChecklistFile: e.target.files?.[0] || null})}
                  />
                  {editingMaterial?.iqc_checklist_url && (
                    <p className="text-sm text-gray-500">Current: IQC checklist uploaded</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_changes">Changes Description</Label>
                <Textarea 
                  id="edit_changes" 
                  value={newMaterial.changesDescription} 
                  onChange={(e) => setNewMaterial({...newMaterial, changesDescription: e.target.value})}
                  placeholder="Describe what changes you're making"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                onClick={handleEditMaterial}
                disabled={!newMaterial.name || !newMaterial.category || updateRawMaterial.isPending}
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

export default RawMaterialsManagement;
