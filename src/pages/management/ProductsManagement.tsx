
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
import { Search, Plus, Box, Upload, FileText, Edit, Trash2 } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ProductsManagement = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debug: Let's also fetch data directly to see what's happening
  const { data: debugProducts, isLoading: debugLoading, error: debugError } = useQuery({
    queryKey: ["debug-products"],
    queryFn: async () => {
      console.log("Debug: Fetching products...");
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true);
      
      console.log("Debug products data:", data);
      console.log("Debug products error:", error);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: products = [], isLoading } = useProducts();

  console.log("Hook products:", products);
  console.log("Debug products:", debugProducts);
  console.log("Is loading:", isLoading, debugLoading);
  console.log("Debug error:", debugError);

  const [newProduct, setNewProduct] = useState({
    name: "",
    product_code: "",
    category: "",
    description: "",
    specifications: "",
    bomFile: null as File | null,
    wiFile: null as File | null,
    crsFile: null as File | null,
    pqcChecklistFile: null as File | null,
    oqcChecklistFile: null as File | null,
    cclFile: null as File | null,
  });

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    product.product_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file);

    if (error) throw error;
    return data;
  };

  const handleFileUpload = async (file: File, type: string) => {
    if (!file) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}_${Date.now()}.${fileExt}`;
      const filePath = `product-documents/${fileName}`;

      await uploadFile(file, 'product-documents', filePath);
      
      const { data } = supabase.storage
        .from('product-documents')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error(`Error uploading ${type} file:`, error);
      toast({
        title: "Upload Error",
        description: `Failed to upload ${type} file`,
        variant: "destructive",
      });
      return null;
    }
  };

  const addProduct = useMutation({
    mutationFn: async (productData: typeof newProduct) => {
      let bomUrl = null;
      let wiUrl = null;
      let crsUrl = null;
      let pqcChecklistUrl = null;
      let oqcChecklistUrl = null;
      let cclUrl = null;

      // Upload files
      if (productData.bomFile) {
        bomUrl = await handleFileUpload(productData.bomFile, 'bom');
      }
      if (productData.wiFile) {
        wiUrl = await handleFileUpload(productData.wiFile, 'wi');
      }
      if (productData.crsFile) {
        crsUrl = await handleFileUpload(productData.crsFile, 'crs');
      }
      if (productData.pqcChecklistFile) {
        pqcChecklistUrl = await handleFileUpload(productData.pqcChecklistFile, 'pqc_checklist');
      }
      if (productData.oqcChecklistFile) {
        oqcChecklistUrl = await handleFileUpload(productData.oqcChecklistFile, 'oqc_checklist');
      }
      if (productData.cclFile) {
        cclUrl = await handleFileUpload(productData.cclFile, 'ccl');
      }

      const { data, error } = await supabase
        .from("products")
        .insert({
          name: productData.name,
          product_code: productData.product_code,
          category: productData.category,
          description: productData.description,
          specifications: productData.specifications,
          bom_url: bomUrl,
          wi_url: wiUrl,
          crs_url: crsUrl,
          pqc_checklist_url: pqcChecklistUrl,
          oqc_checklist_url: oqcChecklistUrl,
          ccl_url: cclUrl,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["debug-products"] });
      toast({
        title: "Success",
        description: "Product added successfully",
      });
    },
    onError: (error) => {
      console.error("Error adding product:", error);
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive",
      });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async (data: { id: string } & typeof newProduct) => {
      let bomUrl = editingProduct?.bom_url;
      let wiUrl = editingProduct?.wi_url;
      let crsUrl = editingProduct?.crs_url;
      let pqcChecklistUrl = editingProduct?.pqc_checklist_url;
      let oqcChecklistUrl = editingProduct?.oqc_checklist_url;
      let cclUrl = editingProduct?.ccl_url;

      // Upload new files if provided
      if (data.bomFile) {
        bomUrl = await handleFileUpload(data.bomFile, 'bom');
      }
      if (data.wiFile) {
        wiUrl = await handleFileUpload(data.wiFile, 'wi');
      }
      if (data.crsFile) {
        crsUrl = await handleFileUpload(data.crsFile, 'crs');
      }
      if (data.pqcChecklistFile) {
        pqcChecklistUrl = await handleFileUpload(data.pqcChecklistFile, 'pqc_checklist');
      }
      if (data.oqcChecklistFile) {
        oqcChecklistUrl = await handleFileUpload(data.oqcChecklistFile, 'oqc_checklist');
      }
      if (data.cclFile) {
        cclUrl = await handleFileUpload(data.cclFile, 'ccl');
      }

      const { data: updatedProduct, error } = await supabase
        .from("products")
        .update({
          name: data.name,
          product_code: data.product_code,
          category: data.category,
          description: data.description,
          specifications: data.specifications,
          bom_url: bomUrl,
          wi_url: wiUrl,
          crs_url: crsUrl,
          pqc_checklist_url: pqcChecklistUrl,
          oqc_checklist_url: oqcChecklistUrl,
          ccl_url: cclUrl,
        })
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      return updatedProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["debug-products"] });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
    },
    onError: (error) => {
      console.error("Error updating product:", error);
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["debug-products"] });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: (error) => {
      console.error("Error deleting product:", error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.product_code || !newProduct.category) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await addProduct.mutateAsync(newProduct);
      setNewProduct({
        name: "",
        product_code: "",
        category: "",
        description: "",
        specifications: "",
        bomFile: null,
        wiFile: null,
        crsFile: null,
        pqcChecklistFile: null,
        oqcChecklistFile: null,
        cclFile: null,
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const handleEditProduct = async () => {
    if (!editingProduct || !newProduct.name || !newProduct.product_code || !newProduct.category) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateProduct.mutateAsync({
        id: editingProduct.id,
        ...newProduct,
      });
      setIsEditDialogOpen(false);
      setEditingProduct(null);
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct.mutateAsync(productId);
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const openEditDialog = (product: any) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      product_code: product.product_code,
      category: product.category,
      description: product.description || "",
      specifications: product.specifications || "",
      bomFile: null,
      wiFile: null,
      crsFile: null,
      pqcChecklistFile: null,
      oqcChecklistFile: null,
      cclFile: null,
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setNewProduct({
      name: "",
      product_code: "",
      category: "",
      description: "",
      specifications: "",
      bomFile: null,
      wiFile: null,
      crsFile: null,
      pqcChecklistFile: null,
      oqcChecklistFile: null,
      cclFile: null,
    });
  };

  if (isLoading && debugLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-lg">Loading products...</div>
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
            <Box className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Products Management</h1>
          </div>
          
          {/* Debug Information */}
          <div className="text-sm text-gray-500">
            Hook: {products.length} | Debug: {debugProducts?.length || 0} products
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add New Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input 
                      id="name" 
                      value={newProduct.name} 
                      onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                      placeholder="Enter product name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product_code">Product Code *</Label>
                    <Input 
                      id="product_code" 
                      value={newProduct.product_code} 
                      onChange={(e) => setNewProduct({...newProduct, product_code: e.target.value})}
                      placeholder="Enter product code"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Input 
                    id="category" 
                    value={newProduct.category} 
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    placeholder="Enter product category"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    value={newProduct.description} 
                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                    placeholder="Enter product description"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specifications">Specifications</Label>
                  <Textarea 
                    id="specifications" 
                    value={newProduct.specifications} 
                    onChange={(e) => setNewProduct({...newProduct, specifications: e.target.value})}
                    placeholder="Enter product specifications"
                    rows={3}
                  />
                </div>

                {/* File Uploads */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bom_file">BOM (PDF)</Label>
                    <Input 
                      id="bom_file" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewProduct({...newProduct, bomFile: e.target.files?.[0] || null})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wi_file">Work Instruction (PDF)</Label>
                    <Input 
                      id="wi_file" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewProduct({...newProduct, wiFile: e.target.files?.[0] || null})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crs_file">CRS (PDF)</Label>
                    <Input 
                      id="crs_file" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewProduct({...newProduct, crsFile: e.target.files?.[0] || null})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pqc_file">PQC Checklist (PDF)</Label>
                    <Input 
                      id="pqc_file" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewProduct({...newProduct, pqcChecklistFile: e.target.files?.[0] || null})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="oqc_file">OQC Checklist (PDF)</Label>
                    <Input 
                      id="oqc_file" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewProduct({...newProduct, oqcChecklistFile: e.target.files?.[0] || null})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ccl_file">CCL (PDF)</Label>
                    <Input 
                      id="ccl_file" 
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setNewProduct({...newProduct, cclFile: e.target.files?.[0] || null})}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleAddProduct}
                  disabled={!newProduct.name || !newProduct.product_code || !newProduct.category || addProduct.isPending}
                >
                  {addProduct.isPending ? "Adding..." : "Add Product"}
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
                placeholder="Search products..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Products List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      {isLoading ? "Loading..." : "No products found. Try adjusting your search or add a new product."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.product_code}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="max-w-xs truncate">{product.description || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEditDialog(product)}
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
                                  This will deactivate the product "{product.name}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteProduct(product.id)}>
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
                                <SheetTitle>{product.name} Details</SheetTitle>
                              </SheetHeader>
                              <div className="py-4 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-muted-foreground text-sm">Product Code:</span>
                                    <p className="font-medium">{product.product_code}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground text-sm">Category:</span>
                                    <p>{product.category}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <span className="text-muted-foreground text-sm">Description:</span>
                                  <p className="mt-1">{product.description || 'No description provided'}</p>
                                </div>
                                
                                <div>
                                  <span className="text-muted-foreground text-sm">Specifications:</span>
                                  <p className="mt-1">{product.specifications || 'No specifications provided'}</p>
                                </div>

                                <div className="space-y-2">
                                  <h4 className="font-medium">Documents</h4>
                                  <div className="flex flex-col space-y-2">
                                    {product.bom_url && (
                                      <a 
                                        href={product.bom_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>BOM</span>
                                      </a>
                                    )}
                                    {product.wi_url && (
                                      <a 
                                        href={product.wi_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>Work Instruction</span>
                                      </a>
                                    )}
                                    {product.crs_url && (
                                      <a 
                                        href={product.crs_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>CRS</span>
                                      </a>
                                    )}
                                    {product.pqc_checklist_url && (
                                      <a 
                                        href={product.pqc_checklist_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>PQC Checklist</span>
                                      </a>
                                    )}
                                    {product.oqc_checklist_url && (
                                      <a 
                                        href={product.oqc_checklist_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>OQC Checklist</span>
                                      </a>
                                    )}
                                    {product.ccl_url && (
                                      <a 
                                        href={product.ccl_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>CCL</span>
                                      </a>
                                    )}
                                    {!product.bom_url && !product.wi_url && !product.crs_url && !product.pqc_checklist_url && !product.oqc_checklist_url && !product.ccl_url && (
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

        {/* Edit Dialog - Similar structure to Add Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingProduct(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Same form fields as Add Dialog */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_name">Product Name *</Label>
                  <Input 
                    id="edit_name" 
                    value={newProduct.name} 
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder="Enter product name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_product_code">Product Code *</Label>
                  <Input 
                    id="edit_product_code" 
                    value={newProduct.product_code} 
                    onChange={(e) => setNewProduct({...newProduct, product_code: e.target.value})}
                    placeholder="Enter product code"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_category">Category *</Label>
                <Input 
                  id="edit_category" 
                  value={newProduct.category} 
                  onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                  placeholder="Enter product category"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_description">Description</Label>
                <Textarea 
                  id="edit_description" 
                  value={newProduct.description} 
                  onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  placeholder="Enter product description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_specifications">Specifications</Label>
                <Textarea 
                  id="edit_specifications" 
                  value={newProduct.specifications} 
                  onChange={(e) => setNewProduct({...newProduct, specifications: e.target.value})}
                  placeholder="Enter product specifications"
                  rows={3}
                />
              </div>

              {/* File Uploads with current file indicators */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_bom_file">BOM (PDF) - Upload new to replace</Label>
                  <Input 
                    id="edit_bom_file" 
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setNewProduct({...newProduct, bomFile: e.target.files?.[0] || null})}
                  />
                  {editingProduct?.bom_url && (
                    <p className="text-sm text-gray-500">Current: BOM uploaded</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_wi_file">Work Instruction (PDF) - Upload new to replace</Label>
                  <Input 
                    id="edit_wi_file" 
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setNewProduct({...newProduct, wiFile: e.target.files?.[0] || null})}
                  />
                  {editingProduct?.wi_url && (
                    <p className="text-sm text-gray-500">Current: Work Instruction uploaded</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_crs_file">CRS (PDF) - Upload new to replace</Label>
                  <Input 
                    id="edit_crs_file" 
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setNewProduct({...newProduct, crsFile: e.target.files?.[0] || null})}
                  />
                  {editingProduct?.crs_url && (
                    <p className="text-sm text-gray-500">Current: CRS uploaded</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_pqc_file">PQC Checklist (PDF) - Upload new to replace</Label>
                  <Input 
                    id="edit_pqc_file" 
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setNewProduct({...newProduct, pqcChecklistFile: e.target.files?.[0] || null})}
                  />
                  {editingProduct?.pqc_checklist_url && (
                    <p className="text-sm text-gray-500">Current: PQC Checklist uploaded</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_oqc_file">OQC Checklist (PDF) - Upload new to replace</Label>
                  <Input 
                    id="edit_oqc_file" 
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setNewProduct({...newProduct, oqcChecklistFile: e.target.files?.[0] || null})}
                  />
                  {editingProduct?.oqc_checklist_url && (
                    <p className="text-sm text-gray-500">Current: OQC Checklist uploaded</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_ccl_file">CCL (PDF) - Upload new to replace</Label>
                  <Input 
                    id="edit_ccl_file" 
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setNewProduct({...newProduct, cclFile: e.target.files?.[0] || null})}
                  />
                  {editingProduct?.ccl_url && (
                    <p className="text-sm text-gray-500">Current: CCL uploaded</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                onClick={handleEditProduct}
                disabled={!newProduct.name || !newProduct.product_code || !newProduct.category || updateProduct.isPending}
              >
                {updateProduct.isPending ? "Updating..." : "Update Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ProductsManagement;
