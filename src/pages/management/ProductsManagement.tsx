
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { 
  Card, CardContent, CardHeader, CardTitle, CardFooter 
} from "@/components/ui/card";
import { 
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate, useLocation } from "react-router-dom";
import { FileText, FileBarChart, FileCheck, Search, Plus } from "lucide-react";

// Product categories
const PRODUCT_CATEGORIES = [
  "Tower Speaker",
  "Soundbar",
  "Party Speaker",
  "Multimedia Speaker",
  "Portable Speaker"
];

// Sample data for demonstration
const SAMPLE_PRODUCTS = [
  {
    id: "1",
    name: "Elite Tower 5000",
    category: "Tower Speaker",
    model: "TW-5000",
    hasDocuments: {
      bom: true,
      flowchart: true,
      workInstructions: true,
      oqcChecklist: true
    }
  },
  {
    id: "2",
    name: "SoundBlaster Bar",
    category: "Soundbar",
    model: "SB-2000",
    hasDocuments: {
      bom: true,
      flowchart: true,
      workInstructions: false,
      oqcChecklist: true
    }
  },
  {
    id: "3",
    name: "Party Pro 3000",
    category: "Party Speaker",
    model: "PP-3000",
    hasDocuments: {
      bom: true,
      flowchart: false,
      workInstructions: true,
      oqcChecklist: true
    }
  },
  {
    id: "4",
    name: "Media Master 200",
    category: "Multimedia Speaker",
    model: "MM-200",
    hasDocuments: {
      bom: true,
      flowchart: true,
      workInstructions: true,
      oqcChecklist: true
    }
  },
  {
    id: "5",
    name: "Pocket Sound Go",
    category: "Portable Speaker",
    model: "PS-G100",
    hasDocuments: {
      bom: false,
      flowchart: true,
      workInstructions: true,
      oqcChecklist: false
    }
  }
];

const ProductsManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState(SAMPLE_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    model: ""
  });

  // Handle navigation between management tabs
  const handleTabChange = (value: string) => {
    navigate(`/management/${value}`);
  };

  // Get current tab from URL
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes("/products")) return "products";
    if (path.includes("/raw-materials")) return "raw-materials";
    if (path.includes("/human-resources")) return "human-resources";
    return "products";
  };

  // Filter products based on search and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         product.model.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddProduct = () => {
    const product = {
      id: (products.length + 1).toString(),
      name: newProduct.name,
      category: newProduct.category,
      model: newProduct.model,
      hasDocuments: {
        bom: false,
        flowchart: false,
        workInstructions: false,
        oqcChecklist: false
      }
    };
    
    setProducts([...products, product]);
    setNewProduct({ name: "", category: "", model: "" });
    setIsAddDialogOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Management</h1>
        </div>

        <Tabs value={getCurrentTab()} onValueChange={handleTabChange} className="w-full mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="raw-materials">Raw Materials</TabsTrigger>
            <TabsTrigger value="human-resources">Human Resources</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Products Management</h2>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input 
                    id="name" 
                    value={newProduct.name} 
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    className="col-span-3" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right">Category</Label>
                  <Select 
                    value={newProduct.category} 
                    onValueChange={(value) => setNewProduct({...newProduct, category: value})}
                  >
                    <SelectTrigger id="category" className="col-span-3">
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
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="model" className="text-right">Model</Label>
                  <Input 
                    id="model" 
                    value={newProduct.model} 
                    onChange={(e) => setNewProduct({...newProduct, model: e.target.value})}
                    className="col-span-3" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddProduct}>Add Product</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
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
                  {PRODUCT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-center">Documents</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No products found. Try adjusting your search or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>{product.model}</TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            variant={product.hasDocuments.bom ? "default" : "outline"}
                            size="sm"
                            title="Bill of Materials"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={product.hasDocuments.flowchart ? "default" : "outline"}
                            size="sm"
                            title="Process Flow Chart"
                          >
                            <FileBarChart className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={product.hasDocuments.workInstructions ? "default" : "outline"}
                            size="sm"
                            title="Work Instructions"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={product.hasDocuments.oqcChecklist ? "default" : "outline"}
                            size="sm"
                            title="OQC Checklist"
                          >
                            <FileCheck className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button variant="outline" size="sm">Details</Button>
                          </SheetTrigger>
                          <SheetContent>
                            <SheetHeader>
                              <SheetTitle>{product.name} Details</SheetTitle>
                            </SheetHeader>
                            <div className="py-4">
                              <h3 className="font-semibold mb-2">Product Information</h3>
                              <div className="grid grid-cols-2 gap-2 mb-4">
                                <span className="text-muted-foreground">Model:</span>
                                <span>{product.model}</span>
                                <span className="text-muted-foreground">Category:</span>
                                <span>{product.category}</span>
                              </div>
                              
                              <h3 className="font-semibold mt-4 mb-2">Documents</h3>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span>Bill of Materials (BOM)</span>
                                  <Button size="sm" variant="outline">View</Button>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Process Flow Chart</span>
                                  <Button size="sm" variant="outline">View</Button>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Work Instructions</span>
                                  <Button size="sm" variant="outline">View</Button>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>OQC Checklist</span>
                                  <Button size="sm" variant="outline">View</Button>
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

export default ProductsManagement;
