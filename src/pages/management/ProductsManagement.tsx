
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Search, Plus, Package, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BOMForm, BOMItem } from "@/components/BOM/BOMForm";
import { useToast } from "@/hooks/use-toast";

const PRODUCT_CATEGORIES = [
  "Tower Speaker",
  "Soundbar", 
  "Party Speaker",
  "Multimedia Speaker",
  "Portable Speaker"
];

const ProductsManagement = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [newProduct, setNewProduct] = useState({
    product_code: "",
    name: "",
    category: "",
    description: ""
  });
  const [productDocuments, setProductDocuments] = useState({
    bom: null as File | null,
    wi: null as File | null,
    pqc_checklist: null as File | null,
    oqc_checklist: null as File | null,
    ccl: null as File | null,
    crs: null as File | null
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive"
      });
    } else {
      setProducts(data || []);
    }
  };

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    product.product_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const checkProductCodeExists = async (productCode: string) => {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('product_code', productCode)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error checking product code:', error);
      return false;
    }
    
    return data && data.length > 0;
  };

  const hasAllBOMTypes = () => {
    const types = bomItems.map(item => item.bom_type);
    return ["main_assembly", "sub_assembly", "accessory"].every(type => types.includes(type as any));
  };

  const uploadDocument = async (file: File, type: string, productCode: string) => {
    const fileName = `${productCode}_${type}_${Date.now()}.pdf`;
    const { error } = await supabase.storage
      .from('product-documents')
      .upload(fileName, file);
    
    if (error) throw error;
    return fileName;
  };

  const handleDocumentChange = (type: string, file: File | null) => {
    setProductDocuments(prev => ({
      ...prev,
      [type]: file
    }));
  };

  const handleAddProduct = async () => {
    if (!newProduct.product_code.trim()) {
      toast({
        title: "Product Code Required",
        description: "Please enter a product code",
        variant: "destructive"
      });
      return;
    }

    if (!hasAllBOMTypes()) {
      toast({
        title: "BOM Required",
        description: "Please add at least one item for each BOM type (Main Assembly, Sub Assembly, Accessory)",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Check if product code already exists
      const codeExists = await checkProductCodeExists(newProduct.product_code);
      if (codeExists) {
        toast({
          title: "Product Code Exists",
          description: "This product code already exists. Please use a different code.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      let documentUrls: any = {};

      // Upload documents if provided
      for (const [type, file] of Object.entries(productDocuments)) {
        if (file) {
          try {
            const url = await uploadDocument(file, type, newProduct.product_code);
            documentUrls[`${type}_url`] = url;
          } catch (error) {
            console.error(`Error uploading ${type}:`, error);
          }
        }
      }
      
      // Insert product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert({
          product_code: newProduct.product_code,
          name: newProduct.name,
          category: newProduct.category,
          description: newProduct.description,
          ...documentUrls
        })
        .select()
        .single();

      if (productError) throw productError;

      // Insert BOM items
      const bomInserts = bomItems.map(item => ({
        product_id: productData.id,
        raw_material_id: item.raw_material_id,
        bom_type: item.bom_type,
        quantity: item.quantity,
        is_critical: item.is_critical || false
      }));

      const { error: bomError } = await supabase
        .from('bom')
        .insert(bomInserts);

      if (bomError) throw bomError;

      // Reset form
      setNewProduct({
        product_code: "",
        name: "",
        category: "",
        description: ""
      });
      setBomItems([]);
      setProductDocuments({
        bom: null,
        wi: null,
        pqc_checklist: null,
        oqc_checklist: null,
        ccl: null,
        crs: null
      });
      setIsAddDialogOpen(false);
      
      // Refresh products list
      fetchProducts();
      
      toast({
        title: "Success",
        description: "Product created successfully with BOM and documents"
      });
      
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: "Error",
        description: "Failed to create product",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const DocumentUpload = ({ type, label }: { type: string; label: string }) => (
    <div className="space-y-2">
      <Label htmlFor={type}>{label}</Label>
      <div className="flex items-center space-x-2">
        <Input
          id={type}
          type="file"
          accept=".pdf"
          onChange={(e) => handleDocumentChange(type, e.target.files?.[0] || null)}
          className="flex-1"
        />
        <Upload className="h-4 w-4 text-muted-foreground" />
      </div>
      {productDocuments[type as keyof typeof productDocuments] && (
        <p className="text-sm text-green-600">
          File selected: {productDocuments[type as keyof typeof productDocuments]?.name}
        </p>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Package className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Product Management</h1>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add New Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Product with BOM & Documents</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* Product Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Product Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="product_code">Product Code *</Label>
                        <Input 
                          id="product_code" 
                          value={newProduct.product_code} 
                          onChange={(e) => setNewProduct({...newProduct, product_code: e.target.value})}
                          placeholder="Enter unique product code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Product Name</Label>
                        <Input 
                          id="name" 
                          value={newProduct.name} 
                          onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                          placeholder="Enter product name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select 
                          value={newProduct.category} 
                          onValueChange={(value) => setNewProduct({...newProduct, category: value})}
                        >
                          <SelectTrigger id="category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                  </CardContent>
                </Card>

                {/* Document Upload Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Product Documents (PDF only)</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <DocumentUpload type="bom" label="BOM Document" />
                    <DocumentUpload type="wi" label="Work Instruction (WI)" />
                    <DocumentUpload type="pqc_checklist" label="PQC Checklist" />
                    <DocumentUpload type="oqc_checklist" label="OQC Checklist" />
                    <DocumentUpload type="ccl" label="CCL Document" />
                    <DocumentUpload type="crs" label="CRS Document" />
                  </CardContent>
                </Card>

                {/* BOM Form */}
                <BOMForm bomItems={bomItems} onBOMChange={setBomItems} />
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleAddProduct}
                  disabled={!hasAllBOMTypes() || isLoading || !newProduct.product_code.trim()}
                >
                  {isLoading ? "Creating..." : "Create Product"}
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
                      No products found. Try adjusting your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.product_code}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="max-w-md truncate">{product.description}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">View BOM</Button>
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

export default ProductsManagement;
