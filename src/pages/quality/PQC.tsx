
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clock, FileCheck, Upload, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { BarChart } from "@/components/ui/chart";
import { format } from "date-fns";

// Mock data for active production
const activeProduction = [
  {
    id: "PROD-001",
    product: "Speaker A300",
    customer: "AudioTech Inc",
    line: "Line 1",
    plannedQty: 1000,
    completedQty: 250,
    targetDate: "2025-06-10",
    status: "In Progress",
    checkpoints: [
      { name: "PCB Assembly", status: "Completed" },
      { name: "Speaker Mounting", status: "In Progress" },
      { name: "Housing Assembly", status: "Pending" },
      { name: "Final Testing", status: "Pending" }
    ]
  },
  {
    id: "PROD-002",
    product: "Subwoofer S200",
    customer: "SoundMaster",
    line: "Line 2",
    plannedQty: 500,
    completedQty: 150,
    targetDate: "2025-06-10",
    status: "In Progress",
    checkpoints: [
      { name: "PCB Assembly", status: "Completed" },
      { name: "Speaker Mounting", status: "Completed" },
      { name: "Housing Assembly", status: "In Progress" },
      { name: "Final Testing", status: "Pending" }
    ]
  }
];

// Mock data for completed production
const completedProduction = [
  {
    id: "PROD-000",
    product: "Tweeter T100",
    customer: "EchoSystems",
    line: "Line 3",
    quantity: 10000,
    completionDate: "2025-05-15",
    defects: 120,
    defectRate: 1.2,
    reportUrl: "#"
  },
  {
    id: "PROD-00A",
    product: "Speaker A300",
    customer: "AudioTech Inc",
    line: "Line 1",
    quantity: 5000,
    completionDate: "2025-05-10",
    defects: 75,
    defectRate: 1.5,
    reportUrl: "#"
  }
];

// Mock data for defect types for charts
const defectData = [
  { name: "Solder Issues", count: 45 },
  { name: "Component Alignment", count: 32 },
  { name: "Missing Parts", count: 18 },
  { name: "Housing Defects", count: 25 },
  { name: "Testing Failures", count: 30 }
];

const PQC = () => {
  const [selectedTab, setSelectedTab] = useState("active");
  const [selectedProduction, setSelectedProduction] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState([
    { id: "1", description: "PCB assembly alignment check", result: "" },
    { id: "2", description: "Solder quality inspection", result: "" },
    { id: "3", description: "Component placement verification", result: "" },
    { id: "4", description: "Wiring connection test", result: "" },
    { id: "5", description: "Housing assembly inspection", result: "" }
  ]);

  // Find the selected production details
  const selectedProductionDetails = activeProduction.find(p => p.id === selectedProduction);

  // Calculate completion percentage
  const getCompletionPercentage = (completed: number, planned: number) => {
    return Math.round((completed / planned) * 100);
  };

  // Handle checklist item result change
  const handleChecklistChange = (id: string, value: string) => {
    setChecklistItems(items => 
      items.map(item => 
        item.id === id ? { ...item, result: value } : item
      )
    );
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Production Quality Control (PQC)</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Active Production</TabsTrigger>
            <TabsTrigger value="completed">Completed Production</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Active Production Lines</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Target Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeProduction.map((prod) => (
                        <TableRow key={prod.id} className={selectedProduction === prod.id ? "bg-accent" : ""}>
                          <TableCell>
                            <input 
                              type="radio" 
                              name="production" 
                              checked={selectedProduction === prod.id}
                              onChange={() => setSelectedProduction(prod.id)} 
                            />
                          </TableCell>
                          <TableCell className="font-medium">{prod.id}</TableCell>
                          <TableCell>{prod.product}</TableCell>
                          <TableCell>{prod.customer}</TableCell>
                          <TableCell>{prod.line}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-36 bg-gray-200 rounded-full h-2.5">
                                <div 
                                  className="bg-primary h-2.5 rounded-full" 
                                  style={{ width: `${getCompletionPercentage(prod.completedQty, prod.plannedQty)}%` }}
                                ></div>
                              </div>
                              <span className="text-xs">
                                {prod.completedQty} / {prod.plannedQty}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{new Date(prod.targetDate).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {selectedProduction && selectedProductionDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle>Production Stages</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <h3 className="font-medium">{selectedProductionDetails.product}</h3>
                      
                      <div className="space-y-2">
                        {selectedProductionDetails.checkpoints.map((checkpoint, index) => (
                          <div key={index} className="border rounded p-2">
                            <div className="flex justify-between items-center">
                              <span>{checkpoint.name}</span>
                              <Badge 
                                variant="outline" 
                                className={
                                  checkpoint.status === "Completed" ? "bg-green-100 text-green-800" :
                                  checkpoint.status === "In Progress" ? "bg-blue-100 text-blue-800" :
                                  "bg-gray-100 text-gray-800"
                                }
                              >
                                {checkpoint.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="pt-2 border-t">
                        <Button className="w-full">Quality Check</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {selectedProduction && (
              <Card>
                <CardHeader>
                  <CardTitle>PQC Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50%]">Check Item</TableHead>
                          <TableHead className="w-[30%]">Result</TableHead>
                          <TableHead className="w-[20%]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {checklistItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>
                              <Select
                                value={item.result}
                                onValueChange={(value) => handleChecklistChange(item.id, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select result" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Pass">Pass</SelectItem>
                                  <SelectItem value="Fail">Fail</SelectItem>
                                  <SelectItem value="N/A">N/A</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" className="w-full">
                                <Upload className="h-3 w-3 mr-1" />
                                Photo
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Additional Notes
                        </label>
                        <Input placeholder="Enter any additional observations" />
                      </div>
                      <div className="flex items-end">
                        <Button className="w-full">
                          <FileCheck className="h-4 w-4 mr-2" />
                          Submit PQC Report
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="completed">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                <CardTitle>Completed Production</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by ID or product" className="pl-8" />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Completion Date</TableHead>
                      <TableHead>Defect Rate</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedProduction.map((prod) => (
                      <TableRow key={prod.id}>
                        <TableCell className="font-medium">{prod.id}</TableCell>
                        <TableCell>{prod.product}</TableCell>
                        <TableCell>{prod.customer}</TableCell>
                        <TableCell>{prod.line}</TableCell>
                        <TableCell>{prod.quantity.toLocaleString()}</TableCell>
                        <TableCell>{new Date(prod.completionDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              prod.defectRate < 1 ? "bg-green-100 text-green-800" :
                              prod.defectRate < 2 ? "bg-amber-100 text-amber-800" :
                              "bg-red-100 text-red-800"
                            }
                          >
                            {prod.defectRate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            <FileCheck className="h-3 w-3 mr-1" />
                            Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Defect Type Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <BarChart
                      data={defectData}
                      index="name"
                      categories={["count"]}
                      colors={["blue"]}
                      valueFormatter={(value) => `${value} defects`}
                      yAxisWidth={48}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Recent Issues Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border rounded-md p-3">
                      <div className="font-medium">Solder Quality Issues</div>
                      <div className="text-sm text-muted-foreground">
                        45 occurrences identified in the last 30 days.
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="bg-red-100 text-red-800">
                          High Priority
                        </Badge>
                        <Badge variant="outline">Speaker A300</Badge>
                      </div>
                    </div>
                    
                    <div className="border rounded-md p-3">
                      <div className="font-medium">Component Alignment</div>
                      <div className="text-sm text-muted-foreground">
                        32 occurrences identified in the last 30 days.
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-100 text-amber-800">
                          Medium Priority
                        </Badge>
                        <Badge variant="outline">Multiple Products</Badge>
                      </div>
                    </div>
                    
                    <div className="border rounded-md p-3">
                      <div className="font-medium">Missing Parts</div>
                      <div className="text-sm text-muted-foreground">
                        18 occurrences identified in the last 30 days.
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-100 text-amber-800">
                          Medium Priority
                        </Badge>
                        <Badge variant="outline">Subwoofer S200</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PQC;
