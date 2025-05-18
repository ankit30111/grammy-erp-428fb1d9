
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  FileText, 
  FileSpreadsheet, 
  FileBarChart, 
  Clock,
  FileCheck,
  Users,
  Upload
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Product categories
const productCategories = [
  "Tower Speaker",
  "Soundbar",
  "Party Speaker",
  "Multimedia Speaker", 
  "Portable Speaker"
];

// Raw material categories
const materialCategories = [
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

// Mock data for products
const products = [
  { 
    id: "P001", 
    name: "Tower Speaker TS-500", 
    category: "Tower Speaker", 
    hasBom: true, 
    hasProcessFlow: true,
    hasWorkInstructions: true,
    hasOqcChecklist: true
  },
  { 
    id: "P002", 
    name: "Soundbar SB-300", 
    category: "Soundbar", 
    hasBom: true, 
    hasProcessFlow: false,
    hasWorkInstructions: true,
    hasOqcChecklist: true
  },
  { 
    id: "P003", 
    name: "Party Speaker PS-800", 
    category: "Party Speaker", 
    hasBom: true, 
    hasProcessFlow: true,
    hasWorkInstructions: true,
    hasOqcChecklist: false
  },
  { 
    id: "P004", 
    name: "Bluetooth Speaker BS-100", 
    category: "Portable Speaker", 
    hasBom: false, 
    hasProcessFlow: false,
    hasWorkInstructions: false,
    hasOqcChecklist: false
  }
];

// Mock data for raw materials
const rawMaterials = [
  { 
    id: "RM001", 
    name: "ABS Plastic Housing", 
    category: "Plastic", 
    specs: true, 
    iqcSheet: true 
  },
  { 
    id: "RM002", 
    name: "MDF Front Panel", 
    category: "Wooden", 
    specs: true, 
    iqcSheet: false 
  },
  { 
    id: "RM003", 
    name: "Carton Box 500x300x200", 
    category: "Packaging", 
    specs: true, 
    iqcSheet: true 
  },
  { 
    id: "RM004", 
    name: "Speaker Basket 6 inch", 
    category: "Metal", 
    specs: true, 
    iqcSheet: true 
  },
  { 
    id: "RM005", 
    name: "2-Core Power Cable", 
    category: "Wire", 
    specs: false, 
    iqcSheet: false 
  },
  { 
    id: "RM006", 
    name: "Main PCB Rev 2.0", 
    category: "PCB", 
    specs: true, 
    iqcSheet: true 
  }
];

// Mock data for human resources
const employees = [
  {
    id: "EMP001",
    name: "John Smith",
    department: "Production",
    position: "Line Operator",
    skills: ["Soldering", "Assembly", "Testing"],
    trainings: [
      { name: "Basic Soldering", status: "Completed", date: "2024-12-15" },
      { name: "ESD Prevention", status: "Pending", date: "2025-06-30" }
    ]
  },
  {
    id: "EMP002",
    name: "Jane Doe",
    department: "Quality",
    position: "Inspector",
    skills: ["Inspection", "Testing", "Quality Auditing"],
    trainings: [
      { name: "Quality Management System", status: "Completed", date: "2025-01-10" },
      { name: "Statistical Process Control", status: "Completed", date: "2024-11-05" }
    ]
  },
  {
    id: "EMP003",
    name: "Robert Johnson",
    department: "Engineering",
    position: "Product Engineer",
    skills: ["Product Design", "Testing", "Documentation"],
    trainings: [
      { name: "CAD Design", status: "Completed", date: "2024-09-20" },
      { name: "Product Lifecycle Management", status: "In Progress", date: "2025-05-15" }
    ]
  }
];

const Management = () => {
  const [activeTab, setActiveTab] = useState("products");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("All");
  const [materialSearchTerm, setMaterialSearchTerm] = useState("");
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState("All");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const { toast } = useToast();

  // Filtering logic for products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(productSearchTerm.toLowerCase());
    const matchesCategory = productCategoryFilter === "All" || product.category === productCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtering logic for materials
  const filteredMaterials = rawMaterials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(materialSearchTerm.toLowerCase());
    const matchesCategory = materialCategoryFilter === "All" || material.category === materialCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtering logic for employees
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(employeeSearchTerm.toLowerCase());
    const matchesDepartment = departmentFilter === "All" || employee.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  // Extract unique departments
  const departments = ["All", ...new Set(employees.map(emp => emp.department))];

  // Handle new product submission
  const handleNewProduct = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    toast({
      title: "Product added",
      description: `Added ${formData.get("productName")} to ${formData.get("productCategory")} category`,
    });
    
    // Reset the form (would normally be handled by form state)
  };

  // Handle new material submission
  const handleNewMaterial = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    toast({
      title: "Raw material added",
      description: `Added ${formData.get("materialName")} to ${formData.get("materialCategory")} category`,
    });
    
    // Reset the form (would normally be handled by form state)
  };

  // Handle new employee submission
  const handleNewEmployee = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    toast({
      title: "Employee added",
      description: `Added ${formData.get("employeeName")} to ${formData.get("department")} department`,
    });
    
    // Reset the form (would normally be handled by form state)
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Management</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {new Date().toLocaleTimeString()}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="materials">Raw Materials</TabsTrigger>
            <TabsTrigger value="hr">Human Resources</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Products</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Product</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleNewProduct} className="space-y-4 pt-4">
                      <div className="grid gap-2">
                        <label htmlFor="productId" className="text-sm font-medium">
                          Product ID
                        </label>
                        <Input
                          id="productId"
                          name="productId"
                          placeholder="Enter product ID"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="productName" className="text-sm font-medium">
                          Product Name
                        </label>
                        <Input
                          id="productName"
                          name="productName"
                          placeholder="Enter product name"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="productCategory" className="text-sm font-medium">
                          Category
                        </label>
                        <Select name="productCategory" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {productCategories.map(category => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit">Save Product</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search products..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        className="max-w-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select 
                        value={productCategoryFilter} 
                        onValueChange={setProductCategoryFilter}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Categories</SelectItem>
                          {productCategories.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Documentation</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map(product => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.id}</TableCell>
                          <TableCell>{product.name}</TableCell>
                          <TableCell>{product.category}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Badge variant={product.hasBom ? "outline" : "secondary"} className={product.hasBom ? "bg-green-100 text-green-800" : ""}>
                                BOM
                              </Badge>
                              <Badge variant={product.hasProcessFlow ? "outline" : "secondary"} className={product.hasProcessFlow ? "bg-green-100 text-green-800" : ""}>
                                Flow
                              </Badge>
                              <Badge variant={product.hasWorkInstructions ? "outline" : "secondary"} className={product.hasWorkInstructions ? "bg-green-100 text-green-800" : ""}>
                                WI
                              </Badge>
                              <Badge variant={product.hasOqcChecklist ? "outline" : "secondary"} className={product.hasOqcChecklist ? "bg-green-100 text-green-800" : ""}>
                                OQC
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                <FileText className="h-3 w-3 mr-1" />
                                BOM
                              </Button>
                              <Button variant="outline" size="sm">
                                <FileBarChart className="h-3 w-3 mr-1" />
                                Flow
                              </Button>
                              <Button variant="outline" size="sm">
                                <FileSpreadsheet className="h-3 w-3 mr-1" />
                                Docs
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredProducts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                            No products found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Raw Materials Tab */}
          <TabsContent value="materials">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Raw Materials</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Material
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Raw Material</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleNewMaterial} className="space-y-4 pt-4">
                      <div className="grid gap-2">
                        <label htmlFor="materialId" className="text-sm font-medium">
                          Material ID
                        </label>
                        <Input
                          id="materialId"
                          name="materialId"
                          placeholder="Enter material ID"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="materialName" className="text-sm font-medium">
                          Material Name
                        </label>
                        <Input
                          id="materialName"
                          name="materialName"
                          placeholder="Enter material name"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="materialCategory" className="text-sm font-medium">
                          Category
                        </label>
                        <Select name="materialCategory" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {materialCategories.map(category => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit">Save Material</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search materials..."
                        value={materialSearchTerm}
                        onChange={(e) => setMaterialSearchTerm(e.target.value)}
                        className="max-w-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select 
                        value={materialCategoryFilter} 
                        onValueChange={setMaterialCategoryFilter}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Categories</SelectItem>
                          {materialCategories.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Material Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Documentation</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMaterials.map(material => (
                        <TableRow key={material.id}>
                          <TableCell className="font-medium">{material.id}</TableCell>
                          <TableCell>{material.name}</TableCell>
                          <TableCell>{material.category}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Badge variant={material.specs ? "outline" : "secondary"} className={material.specs ? "bg-green-100 text-green-800" : ""}>
                                Specs
                              </Badge>
                              <Badge variant={material.iqcSheet ? "outline" : "secondary"} className={material.iqcSheet ? "bg-green-100 text-green-800" : ""}>
                                IQC
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                <FileText className="h-3 w-3 mr-1" />
                                Specs
                              </Button>
                              <Button variant="outline" size="sm">
                                <FileCheck className="h-3 w-3 mr-1" />
                                IQC Sheet
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredMaterials.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                            No materials found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Human Resources Tab */}
          <TabsContent value="hr">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Human Resources</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Employee
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Employee</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleNewEmployee} className="space-y-4 pt-4">
                      <div className="grid gap-2">
                        <label htmlFor="employeeId" className="text-sm font-medium">
                          Employee ID
                        </label>
                        <Input
                          id="employeeId"
                          name="employeeId"
                          placeholder="Enter employee ID"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="employeeName" className="text-sm font-medium">
                          Name
                        </label>
                        <Input
                          id="employeeName"
                          name="employeeName"
                          placeholder="Enter employee name"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="department" className="text-sm font-medium">
                          Department
                        </label>
                        <Select name="department" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.filter(d => d !== "All").map(dept => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="position" className="text-sm font-medium">
                          Position
                        </label>
                        <Input
                          id="position"
                          name="position"
                          placeholder="Enter position"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="skills" className="text-sm font-medium">
                          Skills (comma separated)
                        </label>
                        <Input
                          id="skills"
                          name="skills"
                          placeholder="Skill 1, Skill 2, Skill 3"
                          required
                        />
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit">Save Employee</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search employees..."
                        value={employeeSearchTerm}
                        onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                        className="max-w-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select 
                        value={departmentFilter} 
                        onValueChange={setDepartmentFilter}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map(dept => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Skills</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map(employee => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.id}</TableCell>
                          <TableCell>{employee.name}</TableCell>
                          <TableCell>{employee.department}</TableCell>
                          <TableCell>{employee.position}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {employee.skills.map(skill => (
                                <Badge key={skill} variant="outline">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Users className="h-3 w-3 mr-1" />
                                    Training
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Training Records - {employee.name}</DialogTitle>
                                  </DialogHeader>
                                  <div className="py-4">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Training Name</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Date</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {employee.trainings.map((training, idx) => (
                                          <TableRow key={idx}>
                                            <TableCell>{training.name}</TableCell>
                                            <TableCell>
                                              <Badge 
                                                variant="outline" 
                                                className={
                                                  training.status === "Completed" ? "bg-green-100 text-green-800" :
                                                  training.status === "In Progress" ? "bg-blue-100 text-blue-800" :
                                                  "bg-amber-100 text-amber-800"
                                                }
                                              >
                                                {training.status}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>{new Date(training.date).toLocaleDateString()}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                    <div className="mt-4 flex justify-end">
                                      <Button size="sm">
                                        <Upload className="h-3 w-3 mr-1" />
                                        Add Training
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button variant="outline" size="sm">
                                <FileSpreadsheet className="h-3 w-3 mr-1" />
                                Skill Matrix
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                            No employees found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Management;
