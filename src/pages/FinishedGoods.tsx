
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Calendar, 
  Clock, 
  ArrowRight, 
  Layers, 
  CheckCircle,
  Package,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock data for sub-assemblies
const mockSubAssemblies = [
  {
    id: "SA-001",
    name: "PCBA Main Board",
    description: "Main PCB Assembly for Speaker A300",
    parentProduct: "Speaker A300",
    totalRequired: 1000,
    produced: 800,
    inStore: 700,
    issued: 500
  },
  {
    id: "SA-002",
    name: "Amplifier Module",
    description: "Amplifier Module for Speaker A300",
    parentProduct: "Speaker A300",
    totalRequired: 1000,
    produced: 600,
    inStore: 500,
    issued: 450
  },
  {
    id: "SA-003",
    name: "Power Supply Unit",
    description: "PSU for Subwoofer S200",
    parentProduct: "Subwoofer S200",
    totalRequired: 500,
    produced: 300,
    inStore: 300,
    issued: 200
  },
  {
    id: "SA-004",
    name: "Crossover Network",
    description: "Crossover for Subwoofer S200",
    parentProduct: "Subwoofer S200",
    totalRequired: 500,
    produced: 450,
    inStore: 400,
    issued: 300
  }
];

// Mock data for raw materials for BOM
const mockRawMaterials = [
  { id: "RM-001", code: "PCB-123", name: "Main PCB Board", uom: "Pcs" },
  { id: "RM-002", code: "IC-456", name: "Amplifier IC", uom: "Pcs" },
  { id: "RM-003", code: "RES-789", name: "Resistor 10K", uom: "Pcs" },
  { id: "RM-004", code: "CAP-012", name: "Capacitor 100nF", uom: "Pcs" },
  { id: "RM-005", code: "CON-345", name: "Header Connector", uom: "Pcs" }
];

// Mock data for sub-assembly BOMs
const mockSubAssemblyBoms = [
  {
    id: "SA-001",
    name: "PCBA Main Board",
    items: [
      { materialId: "RM-001", materialCode: "PCB-123", materialName: "Main PCB Board", quantity: 1 },
      { materialId: "RM-002", materialCode: "IC-456", materialName: "Amplifier IC", quantity: 2 },
      { materialId: "RM-003", materialCode: "RES-789", materialName: "Resistor 10K", quantity: 20 },
      { materialId: "RM-004", materialCode: "CAP-012", materialName: "Capacitor 100nF", quantity: 15 }
    ]
  },
  {
    id: "SA-002",
    name: "Amplifier Module",
    items: [
      { materialId: "RM-001", materialCode: "PCB-123", materialName: "Main PCB Board", quantity: 1 },
      { materialId: "RM-002", materialCode: "IC-456", materialName: "Amplifier IC", quantity: 1 },
      { materialId: "RM-005", materialCode: "CON-345", materialName: "Header Connector", quantity: 2 }
    ]
  }
];

// Mock production batches
const mockProductionBatches = [
  {
    id: "PB-001",
    subAssemblyId: "SA-001",
    subAssemblyName: "PCBA Main Board",
    quantity: 200,
    startDate: "2025-05-19",
    status: "Completed",
    sentToStore: true
  },
  {
    id: "PB-002",
    subAssemblyId: "SA-002",
    subAssemblyName: "Amplifier Module",
    quantity: 150,
    startDate: "2025-05-18",
    status: "In Progress",
    sentToStore: false
  },
  {
    id: "PB-003",
    subAssemblyId: "SA-003",
    subAssemblyName: "Power Supply Unit",
    quantity: 100,
    startDate: "2025-05-17",
    status: "In Progress",
    sentToStore: false
  }
];

const FinishedGoods = () => {
  const [activeTab, setActiveTab] = useState("sub-assemblies");
  const [newSubAssembly, setNewSubAssembly] = useState({
    name: "",
    description: "",
    parentProduct: ""
  });
  const [newBomItems, setNewBomItems] = useState<{materialId: string, quantity: string}[]>([
    { materialId: "", quantity: "1" }
  ]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedSubAssembly, setSelectedSubAssembly] = useState<string | null>(null);
  const [newBatchQuantity, setNewBatchQuantity] = useState("");
  
  const { toast } = useToast();

  // Calculate completion percentages for sub-assemblies
  const getCompletionPercentage = (produced: number, total: number) => {
    return Math.round((produced / total) * 100);
  };

  const handleNewSubAssemblyChange = (field: string, value: string) => {
    setNewSubAssembly({
      ...newSubAssembly,
      [field]: value
    });
  };

  const handleAddBomItem = () => {
    setNewBomItems([...newBomItems, { materialId: "", quantity: "1" }]);
  };

  const handleBomItemChange = (index: number, field: string, value: string) => {
    const updatedItems = [...newBomItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    setNewBomItems(updatedItems);
  };

  const handleRemoveBomItem = (index: number) => {
    const updatedItems = [...newBomItems];
    updatedItems.splice(index, 1);
    setNewBomItems(updatedItems);
  };

  const handleCreateSubAssembly = () => {
    // Validation
    if (!newSubAssembly.name || !newSubAssembly.parentProduct || 
        newBomItems.some(item => !item.materialId || !item.quantity)) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields for the sub-assembly and BOM items",
        variant: "destructive"
      });
      return;
    }
    
    // Would normally save to database here
    toast({
      title: "Sub-Assembly Created",
      description: `${newSubAssembly.name} has been created successfully`
    });
    
    // Reset form
    setNewSubAssembly({
      name: "",
      description: "",
      parentProduct: ""
    });
    setNewBomItems([{ materialId: "", quantity: "1" }]);
    setShowNewForm(false);
  };

  const handleCreateBatch = () => {
    if (!selectedSubAssembly || !newBatchQuantity) {
      toast({
        title: "Missing information",
        description: "Please select a sub-assembly and enter quantity",
        variant: "destructive"
      });
      return;
    }
    
    const subAssembly = mockSubAssemblies.find(sa => sa.id === selectedSubAssembly);
    
    if (subAssembly) {
      toast({
        title: "Production Batch Created",
        description: `New batch of ${newBatchQuantity} ${subAssembly.name} created`
      });
      
      setSelectedSubAssembly(null);
      setNewBatchQuantity("");
    }
  };

  const handleSendToStore = (batchId: string) => {
    toast({
      title: "Batch Sent to Store",
      description: `Production batch ${batchId} has been sent to store`
    });
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Finished Goods & Sub-Assemblies</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="sub-assemblies">Sub-Assemblies</TabsTrigger>
              <TabsTrigger value="production">Production Batches</TabsTrigger>
              <TabsTrigger value="bom">BOM Management</TabsTrigger>
            </TabsList>
            
            {activeTab === "sub-assemblies" && !showNewForm && (
              <Button onClick={() => setShowNewForm(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Create New Sub-Assembly
              </Button>
            )}
            
            {activeTab === "production" && (
              <Button>
                <Plus className="mr-1 h-4 w-4" />
                Create Production Batch
              </Button>
            )}
          </div>

          <TabsContent value="sub-assemblies" className="space-y-4">
            {showNewForm ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Plus size={18} className="mr-2" />
                    Create New Sub-Assembly
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="name" className="text-sm font-medium block mb-1">Sub-Assembly Name</label>
                        <Input
                          id="name"
                          value={newSubAssembly.name}
                          onChange={(e) => handleNewSubAssemblyChange("name", e.target.value)}
                          placeholder="e.g., PCBA Main Board"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="parentProduct" className="text-sm font-medium block mb-1">Parent Product</label>
                        <Select
                          value={newSubAssembly.parentProduct}
                          onValueChange={(value) => handleNewSubAssemblyChange("parentProduct", value)}
                        >
                          <SelectTrigger id="parentProduct">
                            <SelectValue placeholder="Select parent product" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Speaker A300">Speaker A300</SelectItem>
                            <SelectItem value="Subwoofer S200">Subwoofer S200</SelectItem>
                            <SelectItem value="Tweeter T100">Tweeter T100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="description" className="text-sm font-medium block mb-1">Description</label>
                      <Input
                        id="description"
                        value={newSubAssembly.description}
                        onChange={(e) => handleNewSubAssemblyChange("description", e.target.value)}
                        placeholder="Brief description of the sub-assembly"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Bill of Materials</label>
                        <Button variant="outline" size="sm" onClick={handleAddBomItem}>
                          <Plus className="h-3 w-3 mr-1" />
                          Add Item
                        </Button>
                      </div>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead className="w-28">Quantity</TableHead>
                            <TableHead className="w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {newBomItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Select
                                  value={item.materialId}
                                  onValueChange={(value) => handleBomItemChange(index, "materialId", value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select material" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {mockRawMaterials.map((material) => (
                                      <SelectItem key={material.id} value={material.id}>
                                        {material.code} - {material.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleBomItemChange(index, "quantity", e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleRemoveBomItem(index)}
                                  disabled={newBomItems.length === 1}
                                  className="h-8 w-8 p-0"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button variant="outline" onClick={() => setShowNewForm(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateSubAssembly}>
                        Create Sub-Assembly
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Sub-Assembly List</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Parent Product</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Produced</TableHead>
                        <TableHead>In Store</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockSubAssemblies.map((subAssembly) => (
                        <TableRow key={subAssembly.id}>
                          <TableCell className="font-mono">{subAssembly.id}</TableCell>
                          <TableCell className="font-medium">{subAssembly.name}</TableCell>
                          <TableCell>{subAssembly.parentProduct}</TableCell>
                          <TableCell>{subAssembly.totalRequired}</TableCell>
                          <TableCell>{subAssembly.produced}</TableCell>
                          <TableCell>{subAssembly.inStore}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <div className="bg-gray-200 h-2 w-24 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-green-500 h-full" 
                                    style={{ width: `${getCompletionPercentage(subAssembly.produced, subAssembly.totalRequired)}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {getCompletionPercentage(subAssembly.produced, subAssembly.totalRequired)}%
                                </span>
                              </div>
                              <Badge variant="outline" className={
                                getCompletionPercentage(subAssembly.produced, subAssembly.totalRequired) === 100
                                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                                  : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                              }>
                                {getCompletionPercentage(subAssembly.produced, subAssembly.totalRequired) === 100
                                  ? "Complete"
                                  : "In Production"
                                }
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="production" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create Production Batch</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label htmlFor="subAssemblyId" className="text-sm font-medium block mb-1">Sub-Assembly</label>
                    <Select
                      value={selectedSubAssembly || ""}
                      onValueChange={setSelectedSubAssembly}
                    >
                      <SelectTrigger id="subAssemblyId">
                        <SelectValue placeholder="Select sub-assembly" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockSubAssemblies.map((sa) => (
                          <SelectItem key={sa.id} value={sa.id}>
                            {sa.name} - {sa.parentProduct}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label htmlFor="quantity" className="text-sm font-medium block mb-1">Quantity</label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={newBatchQuantity}
                      onChange={(e) => setNewBatchQuantity(e.target.value)}
                      placeholder="Enter quantity"
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <Button onClick={handleCreateBatch} className="w-full">
                      <Plus className="mr-1 h-4 w-4" />
                      Create Batch
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Production Batches</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch ID</TableHead>
                      <TableHead>Sub-Assembly</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockProductionBatches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-mono">{batch.id}</TableCell>
                        <TableCell className="font-medium">{batch.subAssemblyName}</TableCell>
                        <TableCell>{batch.quantity}</TableCell>
                        <TableCell>{new Date(batch.startDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            batch.status === "Completed" 
                              ? "bg-green-100 text-green-800 hover:bg-green-100" 
                              : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                          }>
                            {batch.status}
                          </Badge>
                          {batch.sentToStore && (
                            <Badge variant="outline" className="bg-purple-100 text-purple-800 hover:bg-purple-100 ml-2">
                              In Store
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {batch.status === "Completed" && !batch.sentToStore && (
                            <Button size="sm" onClick={() => handleSendToStore(batch.id)}>
                              <ArrowRight className="h-3 w-3 mr-1" /> Send to Store
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bom" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sub-Assembly BOM Management</CardTitle>
              </CardHeader>
              <CardContent>
                <Select>
                  <SelectTrigger className="max-w-sm mb-4">
                    <SelectValue placeholder="Select sub-assembly to view BOM" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockSubAssemblyBoms.map((bom) => (
                      <SelectItem key={bom.id} value={bom.id}>
                        {bom.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {mockSubAssemblyBoms.map((bom) => (
                  <div key={bom.id} className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-medium">{bom.name}</h3>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        {bom.items.length} items
                      </Badge>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bom.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{item.materialCode}</TableCell>
                            <TableCell>{item.materialName}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default FinishedGoods;
