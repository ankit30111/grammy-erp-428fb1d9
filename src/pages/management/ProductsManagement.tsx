
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
import { Search, Plus, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BOMForm, BOMItem } from "@/components/BOM/BOMForm";
import { useToast } from "@/hooks/use-toast";

const PRODUCT_CATEGORIES = [
  "Electronics",
  "Audio Equipment", 
  "Gaming Accessories",
  "Mobile Accessories",
  "Computer Hardware",
  "Others"
];

const ProductsManagement = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    description: "",
    specifications: ""
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

  const generateProductCode = async () => {
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    const nextNumber = (count || 0) + 1;
    return `PRD${String(nextNumber).padStart(3, '0')}`;
  };

  const hasAllBOMTypes = () => {
    const types = bomItems.map(item => item.bom_type);
    return ["main_assembly", "sub_assembly", "accessory"].every(type => types.includes(type as any));
  };

  const handleAddProduct = async () => {
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
      const productCode = await generateProductCode();
      
      // Insert product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert({
          product_code: productCode,
          name: newProduct.name,
          category: newProduct.category,
          description: newProduct.description,
          specifications: newProduct.specifications
        })
        .select()
        .single();

      if (productError) throw productError;

      // Insert BOM items
      const bomInserts = bomItems.map(item => ({
        product_id: productData.id,
        raw_material_id: item.raw_material_id,
        bom_type: item.bom_type,
        quantity: item.quantity
      }));

      const { error: bomError } = await supabase
        .from('bom')
        .insert(bomInserts);

      if (bomError) throw bomError;

      // Reset form
      setNewProduct({
        name: "",
        category: "",
        description: "",
        specifications: ""
      });
      setBomItems([]);
      setIsAddDialogOpen(false);
      
      // Refresh products list
      fetchProducts();
      
      toast({
        title: "Success",
        description: "Product created successfully with BOM"
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Product with BOM</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* Product Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Product Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
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
                    <div className="space-y-2">
                      <Label htmlFor="specifications">Specifications</Label>
                      <Textarea 
                        id="specifications" 
                        value={newProduct.specifications} 
                        onChange={(e) => setNewProduct({...newProduct, specifications: e.target.value})}
                        placeholder="Enter technical specifications"
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* BOM Form */}
                <BOMForm bomItems={bomItems} onBOMChange={setBomItems} />
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={handleAddProduct}
                  disabled={!hasAllBOMTypes() || isLoading}
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
