
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, Plus, FileText } from "lucide-react";

// Departments
const DEPARTMENTS = [
  "Production",
  "Quality Control",
  "Logistics",
  "Administration",
  "Engineering",
  "Maintenance"
];

// Skill levels
const SKILL_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert"
];

// Sample data for demonstration
const SAMPLE_EMPLOYEES = [
  {
    id: "1",
    name: "John Doe",
    department: "Production",
    position: "Line Operator",
    joinDate: "2022-05-10",
    skills: [
      { name: "Assembly", level: "Expert" },
      { name: "Quality Check", level: "Advanced" },
      { name: "Machine Operation", level: "Expert" }
    ],
    trainings: [
      { name: "Safety Training", completionDate: "2022-06-15", status: "Completed" },
      { name: "Quality Standards", completionDate: "2022-07-20", status: "Completed" }
    ]
  },
  {
    id: "2",
    name: "Jane Smith",
    department: "Quality Control",
    position: "QC Inspector",
    joinDate: "2021-08-15",
    skills: [
      { name: "Product Testing", level: "Expert" },
      { name: "Documentation", level: "Advanced" },
      { name: "Statistical Analysis", level: "Intermediate" }
    ],
    trainings: [
      { name: "Advanced Quality Control", completionDate: "2021-10-05", status: "Completed" },
      { name: "ISO 9001 Standards", completionDate: "", status: "Pending" }
    ]
  },
  {
    id: "3",
    name: "Robert Johnson",
    department: "Engineering",
    position: "Product Engineer",
    joinDate: "2020-03-22",
    skills: [
      { name: "Product Design", level: "Expert" },
      { name: "CAD Software", level: "Expert" },
      { name: "Prototyping", level: "Advanced" }
    ],
    trainings: [
      { name: "Advanced CAD", completionDate: "2020-05-10", status: "Completed" },
      { name: "Project Management", completionDate: "2021-02-15", status: "Completed" }
    ]
  }
];

const HRManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [employees, setEmployees] = useState(SAMPLE_EMPLOYEES);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    department: "",
    position: ""
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
                         employee.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = filterDepartment === "all" || employee.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  const handleAddEmployee = () => {
    const employee = {
      id: (employees.length + 1).toString(),
      name: newEmployee.name,
      department: newEmployee.department,
      position: newEmployee.position,
      joinDate: new Date().toISOString().split('T')[0],
      skills: [],
      trainings: []
    };
    
    setEmployees([...employees, employee]);
    setNewEmployee({ name: "", department: "", position: "" });
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
          <h2 className="text-2xl font-bold">Human Resources Management</h2>
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
                      {DEPARTMENTS.map((department) => (
                        <SelectItem key={department} value={department}>
                          {department}
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
                  <SelectItem value="all">All Departments</SelectItem>
                  {DEPARTMENTS.map((department) => (
                    <SelectItem key={department} value={department}>{department}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employee List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No employees found. Try adjusting your search or filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{employee.joinDate}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm">
                            View Skills
                          </Button>
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-1" />
                            Training Records
                          </Button>
                        </div>
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
