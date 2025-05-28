
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertTriangle, CheckCircle, Package } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for production planning
const upcomingProductions = [
  { 
    id: "PROD-2025-001", 
    product: "Speaker A300", 
    quantity: 1000, 
    startDate: "2025-05-25", 
    endDate: "2025-05-30",
    status: "Scheduled",
    priority: "High",
    materials: [
      { code: "PCB-123", name: "Main PCB", required: 1000, available: 600 },
      { code: "SPK-A44", name: "Speaker Driver", required: 1000, available: 800 }
    ]
  },
  { 
    id: "PROD-2025-002", 
    product: "Tweeter T100", 
    quantity: 2000, 
    startDate: "2025-06-01", 
    endDate: "2025-06-05",
    status: "Pending Materials",
    priority: "Medium",
    materials: [
      { code: "TWE-001", name: "Tweeter Unit", required: 2000, available: 0 },
      { code: "CON-789", name: "Speaker Connector", required: 2000, available: 0 }
    ]
  },
  { 
    id: "PROD-2025-003", 
    product: "Subwoofer S200", 
    quantity: 500, 
    startDate: "2025-06-10", 
    endDate: "2025-06-15",
    status: "Ready",
    priority: "Low",
    materials: [
      { code: "SUB-002", name: "Subwoofer Driver", required: 500, available: 500 },
      { code: "CAP-333", name: "Capacitor 10μF", required: 2500, available: 2500 }
    ]
  }
];

const materialShortages = [
  { code: "PCB-123", name: "Main PCB", shortage: 400, supplier: "ElectroComp Ltd", leadTime: "2 weeks" },
  { code: "TWE-001", name: "Tweeter Unit", shortage: 2000, supplier: "AudioTech Inc", leadTime: "3 weeks" },
  { code: "CON-789", name: "Speaker Connector", shortage: 2000, supplier: "SpeakTech Inc", leadTime: "1 week" }
];

const Planning = () => {
  const [selectedProduction, setSelectedProduction] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    const variants = {
      "Scheduled": "default",
      "Pending Materials": "destructive",
      "Ready": "secondary"
    } as const;
    
    return <Badge variant={variants[status as keyof typeof variants] || "outline"}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      "High": "destructive",
      "Medium": "default", 
      "Low": "secondary"
    } as const;
    
    return <Badge variant={variants[priority as keyof typeof variants] || "outline"}>{priority}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Production Planning</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, 14:35</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList>
            <TabsTrigger value="schedule">Production Schedule</TabsTrigger>
            <TabsTrigger value="materials">Material Requirements</TabsTrigger>
            <TabsTrigger value="shortages">Material Shortages</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Productions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Production ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingProductions.map((production) => (
                      <TableRow key={production.id}>
                        <TableCell className="font-mono">{production.id}</TableCell>
                        <TableCell className="font-medium">{production.product}</TableCell>
                        <TableCell>{production.quantity.toLocaleString()}</TableCell>
                        <TableCell>{new Date(production.startDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(production.endDate).toLocaleDateString()}</TableCell>
                        <TableCell>{getPriorityBadge(production.priority)}</TableCell>
                        <TableCell>{getStatusBadge(production.status)}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedProduction(selectedProduction === production.id ? null : production.id)}
                          >
                            {selectedProduction === production.id ? "Hide" : "View"} Materials
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {selectedProduction && (
                  <div className="mt-6 border-t pt-4">
                    <h3 className="text-lg font-medium mb-4">Material Requirements: {selectedProduction}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material Code</TableHead>
                          <TableHead>Material Name</TableHead>
                          <TableHead>Required</TableHead>
                          <TableHead>Available</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {upcomingProductions.find(p => p.id === selectedProduction)?.materials.map((material, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{material.code}</TableCell>
                            <TableCell>{material.name}</TableCell>
                            <TableCell>{material.required.toLocaleString()}</TableCell>
                            <TableCell>{material.available.toLocaleString()}</TableCell>
                            <TableCell>
                              {material.available >= material.required ? (
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Available
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Shortage: {(material.required - material.available).toLocaleString()}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materials">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Material Requirements Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">3</div>
                    <div className="text-sm text-muted-foreground">Productions Ready</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">1</div>
                    <div className="text-sm text-muted-foreground">Pending Materials</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-red-600">3</div>
                    <div className="text-sm text-muted-foreground">Material Shortages</div>
                  </div>
                </div>
                
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Material requirements are calculated based on production schedule</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shortages">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Material Shortages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material Code</TableHead>
                      <TableHead>Material Name</TableHead>
                      <TableHead>Shortage Quantity</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Lead Time</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialShortages.map((shortage, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">{shortage.code}</TableCell>
                        <TableCell>{shortage.name}</TableCell>
                        <TableCell className="text-red-600 font-medium">{shortage.shortage.toLocaleString()}</TableCell>
                        <TableCell>{shortage.supplier}</TableCell>
                        <TableCell>{shortage.leadTime}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            Create Purchase Order
                          </Button>
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

export default Planning;
