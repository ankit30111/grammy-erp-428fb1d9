
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  MapPin, 
  AlertTriangle,
  CheckCircle,
  Filter
} from "lucide-react";
import { 
  mockFinishedGoodsInventory, 
  mockFinishedGoodsMovements, 
  groupInventoryByModel,
  FinishedGoodsInventory,
  FinishedGoodsMovement 
} from "@/types/finishedGoods";
import { format } from "date-fns";

const FinishedGoods = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const modelStocks = groupInventoryByModel(mockFinishedGoodsInventory);
  
  const filteredInventory = mockFinishedGoodsInventory.filter(item => {
    const matchesSearch = 
      item.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === "ALL" || item.status === filterStatus;
    const matchesModel = !selectedModel || item.modelName === selectedModel;
    
    return matchesSearch && matchesFilter && matchesModel;
  });

  const totalModels = modelStocks.length;
  const totalQuantity = modelStocks.reduce((sum, model) => sum + model.totalQuantity, 0);
  const availableQuantity = modelStocks.reduce((sum, model) => sum + model.availableQuantity, 0);
  const averageAge = Math.round(modelStocks.reduce((sum, model) => sum + model.averageAge, 0) / modelStocks.length);

  const getStatusBadge = (status: FinishedGoodsInventory["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return <Badge className="bg-green-100 text-green-800">Available</Badge>;
      case "RESERVED":
        return <Badge className="bg-blue-100 text-blue-800">Reserved</Badge>;
      case "EXPIRED":
        return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
      case "QUARANTINE":
        return <Badge className="bg-yellow-100 text-yellow-800">Quarantine</Badge>;
    }
  };

  const getGradeBadge = (grade: FinishedGoodsInventory["qualityGrade"]) => {
    const colors = {
      A: "bg-green-100 text-green-800",
      B: "bg-yellow-100 text-yellow-800",
      C: "bg-orange-100 text-orange-800"
    };
    return <Badge className={colors[grade]}>Grade {grade}</Badge>;
  };

  const getAgeColor = (age: number) => {
    if (age <= 7) return "text-green-600";
    if (age <= 14) return "text-yellow-600";
    return "text-red-600";
  };

  const getMovementIcon = (type: FinishedGoodsMovement["type"]) => {
    return type === "INBOUND" ? 
      <TrendingUp className="h-4 w-4 text-green-600" /> : 
      <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Finished Goods Inventory</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">
              {format(new Date(), "MMM dd, yyyy HH:mm")}
            </span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="flex items-center p-6">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Models</p>
                <p className="text-2xl font-bold">{totalModels}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Stock</p>
                <p className="text-2xl font-bold">{totalQuantity.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Available</p>
                <p className="text-2xl font-bold text-green-600">{availableQuantity.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Avg. Age</p>
                <p className="text-2xl font-bold">{averageAge} days</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Model Overview</TabsTrigger>
            <TabsTrigger value="inventory">Lot Details</TabsTrigger>
            <TabsTrigger value="movements">Stock Movements</TabsTrigger>
            <TabsTrigger value="aging">Aging Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stock by Model (FIFO Order)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model Name</TableHead>
                      <TableHead>Total Qty</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Reserved</TableHead>
                      <TableHead>Oldest Lot</TableHead>
                      <TableHead>Avg. Age</TableHead>
                      <TableHead>Lots Count</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelStocks.map((model) => (
                      <TableRow key={model.modelName}>
                        <TableCell className="font-medium">{model.modelName}</TableCell>
                        <TableCell className="font-bold">{model.totalQuantity.toLocaleString()}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {model.availableQuantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-blue-600">
                          {model.reservedQuantity.toLocaleString()}
                        </TableCell>
                        <TableCell>{format(new Date(model.oldestLotDate), "MMM dd")}</TableCell>
                        <TableCell className={getAgeColor(model.averageAge)}>
                          {model.averageAge} days
                        </TableCell>
                        <TableCell>{model.lots.length}</TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedModel(model.modelName)}
                          >
                            View Lots
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search lots, models, locations..." 
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button 
                  variant={filterStatus === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("ALL")}
                >
                  All
                </Button>
                <Button 
                  variant={filterStatus === "AVAILABLE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("AVAILABLE")}
                >
                  Available
                </Button>
                <Button 
                  variant={filterStatus === "RESERVED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("RESERVED")}
                >
                  Reserved
                </Button>
              </div>
              {selectedModel && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Filtered: {selectedModel}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedModel(null)}>
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Lots (FIFO Order)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>OQC Date</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory
                      .sort((a, b) => new Date(a.oqcApprovedDate).getTime() - new Date(b.oqcApprovedDate).getTime())
                      .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono font-medium">{item.lotNumber}</TableCell>
                        <TableCell>{item.modelName}</TableCell>
                        <TableCell className="font-medium">{item.quantity.toLocaleString()}</TableCell>
                        <TableCell>{format(new Date(item.oqcApprovedDate), "MMM dd, yyyy")}</TableCell>
                        <TableCell className={getAgeColor(item.inventoryAge)}>
                          {item.inventoryAge} days
                        </TableCell>
                        <TableCell>{getGradeBadge(item.qualityGrade)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{item.location}</span>
                            <span className="text-xs text-gray-500">({item.bin})</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Stock Movements</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockFinishedGoodsMovements
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getMovementIcon(movement.type)}
                            <span className={movement.type === "INBOUND" ? "text-green-600" : "text-red-600"}>
                              {movement.type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(movement.date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{movement.modelName}</TableCell>
                        <TableCell className="font-mono">{movement.lotNumber}</TableCell>
                        <TableCell className="font-medium">
                          {movement.type === "INBOUND" ? "+" : "-"}{movement.quantity}
                        </TableCell>
                        <TableCell className="text-sm">{movement.reference}</TableCell>
                        <TableCell className="text-sm text-gray-600">{movement.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="aging" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Aging Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {mockFinishedGoodsInventory.filter(item => item.inventoryAge <= 7).length}
                    </div>
                    <div className="text-sm text-green-700">Fresh (≤ 7 days)</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {mockFinishedGoodsInventory.filter(item => item.inventoryAge > 7 && item.inventoryAge <= 14).length}
                    </div>
                    <div className="text-sm text-yellow-700">Aging (8-14 days)</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {mockFinishedGoodsInventory.filter(item => item.inventoryAge > 14).length}
                    </div>
                    <div className="text-sm text-red-700">Old (> 14 days)</div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>OQC Date</TableHead>
                      <TableHead>Risk Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockFinishedGoodsInventory
                      .sort((a, b) => b.inventoryAge - a.inventoryAge)
                      .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.lotNumber}</TableCell>
                        <TableCell>{item.modelName}</TableCell>
                        <TableCell>{item.quantity.toLocaleString()}</TableCell>
                        <TableCell className={getAgeColor(item.inventoryAge)}>
                          {item.inventoryAge} days
                        </TableCell>
                        <TableCell>{format(new Date(item.oqcApprovedDate), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          {item.inventoryAge <= 7 && (
                            <Badge className="bg-green-100 text-green-800">Low</Badge>
                          )}
                          {item.inventoryAge > 7 && item.inventoryAge <= 14 && (
                            <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
                          )}
                          {item.inventoryAge > 14 && (
                            <Badge className="bg-red-100 text-red-800">High</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default FinishedGoods;
