
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
import { FileText, Package, Search, Plus } from "lucide-react";

// Raw Material categories
const MATERIAL_CATEGORIES = [
  "Plastic",
  "Wooden",
  "Packaging",
  "Metal",
  "Wire",
  "PCB",
  "Transformer",
  "Screw",
  "Others"
];

// Sample data for demonstration
const SAMPLE_MATERIALS = [
  {
    id: "RM001",
    name: "ABS Plastic Shell",
    category: "Plastic",
    specification: "Grade A, Fire Resistant",
    hasDocuments: {
      specification: true,
      iqcInspection: true
    }
  },
  {
    id: "RM002",
    name: "MDF Board",
    category: "Wooden",
    specification: "18mm Thickness, Grade 1",
    hasDocuments: {
      specification: true,
      iqcInspection: true
    }
  },
  {
    id: "RM003",
    name: "Speaker Cable",
    category: "Wire",
    specification: "2.5mm², Copper Core",
    hasDocuments: {
      specification: true,
      iqcInspection: false
    }
  },
  {
    id: "RM004",
    name: "Amplifier PCB",
    category: "PCB",
    specification: "40W Output, 12V DC",
    hasDocuments: {
      specification: true,
      iqcInspection: true
    }
  },
  {
    id: "RM005",
    name: "Speaker Box",
    category: "Packaging",
    specification: "Corrugated, 5 ply",
    hasDocuments: {
      specification: false,
      iqcInspection: true
    }
  }
];

const RawMaterialsManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [materials, setMaterials] = useState(SAMPLE_MATERIALS);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    category: "",
    specification: ""
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
    return "raw-materials";
  };

  // Filter materials based on search and category
  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         material.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "" || material.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddMaterial = () => {
    const material = {
      id: `RM${String(materials.length + 1).padStart(3, '0')}`,
      name: newMaterial.name,
      category: newMaterial.category,
      specification: newMaterial.specification,
      hasDocuments: {
        specification: false,
        iqcInspection: false
      }
    };
    
    setMaterials([...materials, material]);
    setNewMaterial({ name: "", category: "", specification: "" });
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
          <h2 className="text-2xl font-bold">Raw Materials</h2>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Raw Material
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Raw Material</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input 
                    id="name" 
                    value={newMaterial.name} 
                    onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                    className="col-span-3" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right">Category</Label>
                  <Select 
                    value={newMaterial.category} 
                    onValueChange={(value) => setNewMaterial({...newMaterial, category: value})}
                  >
                    <SelectTrigger id="category" className="col-span-3">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="specification" className="text-right">Specification</Label>
                  <Input 
                    id="specification" 
                    value={newMaterial.specification} 
                    onChange={(e) => setNewMaterial({...newMaterial, specification: e.target.value})}
                    className="col-span-3" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddMaterial}>Add Material</Button>
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
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <TableHead>ID</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Specification</TableHead>
                  <TableHead className="text-center">Documents</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No materials found. Try adjusting your search or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell>{material.id}</TableCell>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>{material.category}</TableCell>
                      <TableCell>{material.specification}</TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            variant={material.hasDocuments.specification ? "default" : "outline"}
                            size="sm"
                            title="Specification Sheet"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={material.hasDocuments.iqcInspection ? "default" : "outline"}
                            size="sm"
                            title="IQC Inspection Sheet"
                          >
                            <Package className="h-4 w-4" />
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
                              <SheetTitle>{material.name} Details</SheetTitle>
                            </SheetHeader>
                            <div className="py-4">
                              <h3 className="font-semibold mb-2">Material Information</h3>
                              <div className="grid grid-cols-2 gap-2 mb-4">
                                <span className="text-muted-foreground">ID:</span>
                                <span>{material.id}</span>
                                <span className="text-muted-foreground">Category:</span>
                                <span>{material.category}</span>
                                <span className="text-muted-foreground">Specification:</span>
                                <span>{material.specification}</span>
                              </div>
                              
                              <h3 className="font-semibold mt-4 mb-2">Documents</h3>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span>Specification Sheet</span>
                                  <Button size="sm" variant="outline">View</Button>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>IQC Inspection Sheet</span>
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

export default RawMaterialsManagement;
