
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Package, 
  Clock, 
  ArrowUpFromLine, 
  ArrowDownToLine, 
  Search, 
  AlertTriangle,
  History
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for inventory
const rawMaterials = [
  { partCode: "PCB-123", description: "Main PCB", category: "Electronics", quantity: 600, unit: "pcs", minStock: 500, status: "Low" },
  { partCode: "SPK-A44", description: "Speaker Driver", category: "Electronics", quantity: 800, unit: "pcs", minStock: 500, status: "Ok" },
  { partCode: "RES-456", description: "Resistor Pack", category: "Electronics", quantity: 0, unit: "pcs", minStock: 1000, status: "Out of Stock" },
  { partCode: "CON-789", description: "Speaker Connector", category: "Connectors", quantity: 0, unit: "pcs", minStock: 1000, status: "Out of Stock" },
  { partCode: "CAP-333", description: "Capacitor 10μF", category: "Electronics", quantity: 4000, unit: "pcs", minStock: 1000, status: "Ok" },
  { partCode: "ENC-001", description: "Speaker Enclosure", category: "Mechanical", quantity: 1200, unit: "pcs", minStock: 500, status: "Ok" },
  { partCode: "GRL-002", description: "Speaker Grill", category: "Mechanical", quantity: 1500, unit: "pcs", minStock: 500, status: "Ok" },
  { partCode: "PKG-003", description: "Product Packaging", category: "Packaging", quantity: 2000, unit: "sets", minStock: 1000, status: "Ok" },
];

const finishedGoods = [
  { productCode: "SPK-A300", description: "Speaker A300", customer: "AudioTech Inc", quantity: 500, unit: "pcs" },
  { productCode: "SUB-S200", description: "Subwoofer S200", customer: "SoundMaster", quantity: 200, unit: "pcs" },
  { productCode: "TWR-T100", description: "Tweeter T100", customer: "EchoSystems", quantity: 0, unit: "pcs" },
];

// Mock data for recent transactions
const recentTransactions = [
  { id: "TRX-001", date: "2025-05-18 09:15", type: "IN", reference: "GRN-2025-045", partCode: "CAP-333", quantity: 5000 },
  { id: "TRX-002", date: "2025-05-17 14:30", type: "OUT", reference: "PROD-A300-067", partCode: "PCB-123", quantity: 400 },
  { id: "TRX-003", date: "2025-05-17 11:20", type: "IN", reference: "GRN-2025-044", partCode: "ENC-001", quantity: 1000 },
  { id: "TRX-004", date: "2025-05-16 16:45", type: "OUT", reference: "PROD-S200-023", partCode: "SPK-A44", quantity: 200 },
  { id: "TRX-005", date: "2025-05-16 10:10", type: "OUT", reference: "PROD-A300-066", partCode: "PCB-123", quantity: 500 },
];

const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Filter raw materials
  const filteredRawMaterials = rawMaterials.filter(item => {
    // Apply search filter
    const matchesSearch = 
      item.partCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Apply category filter
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    
    // Apply status filter
    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Filter finished goods
  const filteredFinishedGoods = finishedGoods.filter(item => {
    // Apply search filter
    const matchesSearch = 
      item.productCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Apply customer filter
    const matchesCustomer = customerFilter === "All" || item.customer === customerFilter;
    
    return matchesSearch && matchesCustomer;
  });

  // Extract unique categories and customers for filter options
  const categories = ["All", ...new Set(rawMaterials.map(item => item.category))];
  const customers = ["All", ...new Set(finishedGoods.map(item => item.customer))];
  const statuses = ["All", "Ok", "Low", "Out of Stock"];

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, 14:35</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-4">
          <Card className="w-full md:w-1/3">
            <CardHeader className="py-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Inventory Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 flex flex-col">
                  <span className="text-sm text-muted-foreground">Raw Materials</span>
                  <span className="text-2xl font-bold">{rawMaterials.length}</span>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-green-600 flex items-center gap-1">
                      <span className="inline-block h-2 w-2 bg-green-600 rounded-full"></span>
                      Ok: {rawMaterials.filter(item => item.status === "Ok").length}
                    </span>
                    <span className="text-yellow-600 flex items-center gap-1">
                      <span className="inline-block h-2 w-2 bg-yellow-600 rounded-full"></span>
                      Low: {rawMaterials.filter(item => item.status === "Low").length}
                    </span>
                    <span className="text-red-600 flex items-center gap-1">
                      <span className="inline-block h-2 w-2 bg-red-600 rounded-full"></span>
                      Out: {rawMaterials.filter(item => item.status === "Out of Stock").length}
                    </span>
                  </div>
                </div>
                <div className="border rounded-lg p-4 flex flex-col">
                  <span className="text-sm text-muted-foreground">Finished Goods</span>
                  <span className="text-2xl font-bold">{finishedGoods.length}</span>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-green-600 flex items-center gap-1">
                      <span className="inline-block h-2 w-2 bg-green-600 rounded-full"></span>
                      In Stock: {finishedGoods.filter(item => item.quantity > 0).length}
                    </span>
                    <span className="text-red-600 flex items-center gap-1">
                      <span className="inline-block h-2 w-2 bg-red-600 rounded-full"></span>
                      Out: {finishedGoods.filter(item => item.quantity === 0).length}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Inventory Alerts
                </h3>
                <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                  {rawMaterials.filter(item => item.status !== "Ok").map(item => (
                    <div key={item.partCode} className="flex justify-between py-1 border-b last:border-0">
                      <span className="font-mono">{item.partCode}</span>
                      <Badge 
                        variant="outline" 
                        className={
                          item.status === "Out of Stock" ? "bg-red-100 text-red-800 hover:bg-red-100" :
                          "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="w-1/2">
                  <ArrowUpFromLine className="h-4 w-4 mr-1" />
                  Stock In
                </Button>
                <Button variant="outline" className="w-1/2">
                  <ArrowDownToLine className="h-4 w-4 mr-1" />
                  Stock Out
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="w-full md:w-2/3">
            <CardHeader className="py-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Part Code</TableHead>
                    <TableHead>Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-sm">{transaction.date}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={transaction.type === "IN" 
                            ? "bg-green-100 text-green-800 hover:bg-green-100" 
                            : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                          }
                        >
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{transaction.reference}</TableCell>
                      <TableCell className="font-mono text-sm">{transaction.partCode}</TableCell>
                      <TableCell>{transaction.quantity.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="raw-materials">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <TabsList>
                  <TabsTrigger value="raw-materials">Raw Materials</TabsTrigger>
                  <TabsTrigger value="finished-goods">Finished Goods</TabsTrigger>
                </TabsList>
                
                <div className="flex w-full sm:w-auto gap-2 items-center">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by part code or description"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-auto max-w-xs"
                  />
                </div>
              </div>
              
              <TabsContent value="raw-materials" className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Min Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRawMaterials.map((item) => (
                      <TableRow key={item.partCode}>
                        <TableCell className="font-mono">{item.partCode}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.quantity.toLocaleString()} {item.unit}</TableCell>
                        <TableCell>{item.minStock.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              item.status === "Ok" ? "bg-green-100 text-green-800 hover:bg-green-100" :
                              item.status === "Low" ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" :
                              "bg-red-100 text-red-800 hover:bg-red-100"
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">View History</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              
              <TabsContent value="finished-goods" className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Select value={customerFilter} onValueChange={setCustomerFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filter by customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFinishedGoods.map((item) => (
                      <TableRow key={item.productCode}>
                        <TableCell className="font-mono">{item.productCode}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.customer}</TableCell>
                        <TableCell>{item.quantity.toLocaleString()} {item.unit}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={item.quantity > 0
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-red-100 text-red-800 hover:bg-red-100"
                            }
                          >
                            {item.quantity > 0 ? "In Stock" : "Out of Stock"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">View Details</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Inventory;
