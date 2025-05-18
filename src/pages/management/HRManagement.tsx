
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
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose 
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, FileText, Search, Plus } from "lucide-react";

// Department options
const DEPARTMENTS = [
  "Production",
  "Quality",
  "Store",
  "Purchase",
  "Engineering",
  "Administration",
  "HR",
  "Maintenance"
];

// Sample data for demonstration
const SAMPLE_EMPLOYEES = [
  {
    id: "EMP001",
    name: "John Smith",
    department: "Production",
    position: "Line Supervisor",
    skills: ["Assembly", "Quality Check", "Machine Operation"],
    trainingStatus: "Completed",
    hasTrainingRecords: true
  },
  {
    id: "EMP002",
    name: "Maria Garcia",
    department: "Quality",
    position: "QC Inspector",
    skills: ["IQC", "PQC", "Documentation"],
    trainingStatus: "In Progress",
    hasTrainingRecords: true
  },
  {
    id: "EMP003",
    name: "Raj Patel",
    department: "Engineering",
    position: "Product Engineer",
    skills: ["PCB Design", "Testing", "Troubleshooting"],
    trainingStatus: "Completed",
    hasTrainingRecords: true
  },
  {
    id: "EMP004",
    name: "Sarah Johnson",
    department: "Store",
    position: "Inventory Manager",
    skills: ["Stock Management", "ERP Systems", "Documentation"],
    trainingStatus: "Pending",
    hasTrainingRecords: false
  },
  {
    id: "EMP005",
    name: "Li Wei",
    department: "Purchase",
    position: "Procurement Specialist",
    skills: ["Negotiation", "Supplier Management", "Cost Analysis"],
    trainingStatus: "Completed",
    hasTrainingRecords: true
  }
];

// Skill levels for skill matrix
const SKILL_MATRIX = {
  "Assembly": {
    "John Smith": 5,
    "Maria Garcia": 3,
    "Raj Patel": 2
  },
  "Quality Check": {
    "John Smith": 4,
    "Maria Garcia": 5,
    "Sarah Johnson": 2
  },
  "PCB Design": {
    "Raj Patel": 5,
    "Li Wei": 1
  }
};

const HRManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [employees, setEmployees] = useState(SAMPLE_EMPLOYEES);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    department: "",
    position: "",
    trainingStatus: "Pending"
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
    return "human-resources";
  };

  // Filter employees based on search and department
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         employee.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = filterDepartment === "" || employee.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  const handleAddEmployee = () => {
    const employee = {
      id: `EMP${String(employees.length + 1).padStart(3, '0')}`,
      name: newEmployee.name,
      department: newEmployee.department,
      position: newEmployee.position,
      skills: [],
      trainingStatus: newEmployee.trainingStatus,
      hasTrainingRecords: false
    };
    
    setEmployees([...employees, employee]);
    setNewEmployee({
      name: "",
      department: "",
      position: "",
      trainingStatus: "Pending"
    });
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
          <h2 className="text-2xl font-bold">Human Resources</h2>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input 
                    id="name" 
                    value={newEmployee.name} 
                    onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                    className="col-span-3" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="department" className="text-right">Department</Label>
                  <Select 
                    value={newEmployee.department} 
                    onValueChange={(value) => setNewEmployee({...newEmployee, department: value})}
                  >
                    <SelectTrigger id="department" className="col-span-3">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="position" className="text-right">Position</Label>
                  <Input 
                    id="position" 
                    value={newEmployee.position} 
                    onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                    className="col-span-3" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="trainingStatus" className="text-right">Training Status</Label>
                  <Select 
                    value={newEmployee.trainingStatus} 
                    onValueChange={(value) => setNewEmployee({...newEmployee, trainingStatus: value})}
                  >
                    <SelectTrigger id="trainingStatus" className="col-span-3">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddEmployee}>Add Employee</Button>
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
                  placeholder="Search employees..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Departments</SelectItem>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employees List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Training Status</TableHead>
                  <TableHead className="text-center">Records</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No employees found. Try adjusting your search or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.id}</TableCell>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          employee.trainingStatus === "Completed" ? "bg-status-approved text-status-approved-foreground" : 
                          employee.trainingStatus === "In Progress" ? "bg-status-pending text-status-pending-foreground" : 
                          "bg-muted text-muted-foreground"
                        }`}>
                          {employee.trainingStatus}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant={employee.hasTrainingRecords ? "default" : "outline"}
                          size="sm"
                          title="Training Records"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button variant="outline" size="sm">Details</Button>
                          </SheetTrigger>
                          <SheetContent>
                            <SheetHeader>
                              <SheetTitle>{employee.name} - {employee.id}</SheetTitle>
                            </SheetHeader>
                            <div className="py-4">
                              <h3 className="font-semibold mb-2">Employee Information</h3>
                              <div className="grid grid-cols-2 gap-2 mb-4">
                                <span className="text-muted-foreground">Department:</span>
                                <span>{employee.department}</span>
                                <span className="text-muted-foreground">Position:</span>
                                <span>{employee.position}</span>
                                <span className="text-muted-foreground">Training Status:</span>
                                <span>{employee.trainingStatus}</span>
                              </div>
                              
                              <h3 className="font-semibold mt-4 mb-2">Skill Matrix</h3>
                              <div className="space-y-2">
                                {employee.skills.map((skill, index) => (
                                  <div key={index} className="flex items-center justify-between">
                                    <span>{skill}</span>
                                    <div className="flex space-x-1">
                                      {Array.from({ length: 5 }, (_, i) => (
                                        <div
                                          key={i}
                                          className={`h-3 w-3 rounded-full ${
                                            (SKILL_MATRIX[skill]?.[employee.name] || 0) > i 
                                              ? "bg-primary" 
                                              : "bg-muted"
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                                {employee.skills.length === 0 && (
                                  <div className="text-center text-muted-foreground py-2">
                                    No skill matrix data available
                                  </div>
                                )}
                              </div>
                              
                              <h3 className="font-semibold mt-4 mb-2">Training Records</h3>
                              {employee.hasTrainingRecords ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span>Onboarding Training</span>
                                    <Button size="sm" variant="outline">View</Button>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Safety Procedures</span>
                                    <Button size="sm" variant="outline">View</Button>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Technical Skills</span>
                                    <Button size="sm" variant="outline">View</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-muted-foreground py-2">
                                  No training records available
                                </div>
                              )}
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

export default HRManagement;
