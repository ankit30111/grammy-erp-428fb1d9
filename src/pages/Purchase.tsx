
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Clock, Check, Send } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Mock data for purchase orders
const pendingPOs = [
  { 
    id: "PO-2025-001", 
    date: "2025-05-20", 
    vendor: "ElectroComp Ltd", 
    items: [
      { partCode: "PCB-123", description: "Main PCB", quantity: 1000, unitPrice: 12.50 },
      { partCode: "RES-456", description: "Resistor Pack", quantity: 5000, unitPrice: 0.15 }
    ],
    total: 13750,
    status: "Draft",
    projections: ["Speaker A300", "Tweeter T100"]
  },
  { 
    id: "PO-2025-002", 
    date: "2025-05-20", 
    vendor: "SpeakTech Inc", 
    items: [
      { partCode: "SPK-A44", description: "Speaker Driver", quantity: 2000, unitPrice: 8.75 },
      { partCode: "CON-789", description: "Speaker Connector", quantity: 2000, unitPrice: 1.25 }
    ],
    total: 20000,
    status: "Pending Approval",
    projections: ["Speaker A300"]
  },
];

const sentPOs = [
  { 
    id: "PO-2025-000", 
    date: "2025-05-15", 
    vendor: "ElectroComp Ltd", 
    items: [
      { partCode: "CAP-333", description: "Capacitor 10μF", quantity: 5000, unitPrice: 0.25 }
    ],
    total: 1250,
    status: "Sent",
    projections: ["Subwoofer S200"]
  },
];

// Mock data for material shortages
const shortages = [
  { partCode: "PCB-123", description: "Main PCB", required: 1000, available: 600, shortage: 400, vendor: "ElectroComp Ltd", leadTime: "2 weeks", unitPrice: 12.50 },
  { partCode: "SPK-A44", description: "Speaker Driver", required: 2000, available: 800, shortage: 1200, vendor: "SpeakTech Inc", leadTime: "3 weeks", unitPrice: 8.75 },
  { partCode: "RES-456", description: "Resistor Pack", required: 5000, available: 0, shortage: 5000, vendor: "ElectroComp Ltd", leadTime: "1 week", unitPrice: 0.15 },
  { partCode: "CON-789", description: "Speaker Connector", required: 2000, available: 0, shortage: 2000, vendor: "SpeakTech Inc", leadTime: "1 week", unitPrice: 1.25 },
];

// Group shortages by vendor
const shortagesByVendor = shortages.reduce((acc, item) => {
  if (!acc[item.vendor]) {
    acc[item.vendor] = [];
  }
  acc[item.vendor].push(item);
  return acc;
}, {} as Record<string, typeof shortages>);

const Purchase = () => {
  const [activePO, setActivePO] = useState<string | null>(null);
  const { toast } = useToast();

  const handleApprovePO = (poId: string) => {
    toast({
      title: "Purchase Order Approved",
      description: `PO ${poId} has been approved and is ready to send`,
    });
  };

  const handleSendPO = (poId: string) => {
    toast({
      title: "Purchase Order Sent",
      description: `PO ${poId} has been sent to the vendor`,
    });
  };

  const handleGeneratePO = (vendor: string) => {
    toast({
      title: "Purchase Order Generated",
      description: `A new PO for ${vendor} has been generated based on shortages`,
    });
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Purchase Management</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, 14:35</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Material Shortages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Shortage</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead>Est. Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shortages.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{item.partCode}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.required}</TableCell>
                    <TableCell>{item.available}</TableCell>
                    <TableCell className="text-red-600 font-medium">{item.shortage}</TableCell>
                    <TableCell>{item.vendor}</TableCell>
                    <TableCell>{item.leadTime}</TableCell>
                    <TableCell>${(item.shortage * item.unitPrice).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Vendor-wise Shortages */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor-wise Material Requirements</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto">
              {Object.entries(shortagesByVendor).map(([vendor, items]) => (
                <div key={vendor} className="mb-6 last:mb-0">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">{vendor}</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleGeneratePO(vendor)}
                    >
                      Generate PO
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Part Code</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono">{item.partCode}</TableCell>
                          <TableCell>{item.shortage}</TableCell>
                          <TableCell>${item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell>${(item.shortage * item.unitPrice).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-medium">Total</TableCell>
                        <TableCell className="font-bold">
                          ${items.reduce((sum, item) => sum + (item.shortage * item.unitPrice), 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Purchase Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending">
                <TabsList className="mb-4">
                  <TabsTrigger value="pending">Pending ({pendingPOs.length})</TabsTrigger>
                  <TabsTrigger value="sent">Sent ({sentPOs.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="pending" className="space-y-4">
                  {pendingPOs.map((po) => (
                    <Card key={po.id} className={activePO === po.id ? "border-primary" : ""}>
                      <CardHeader className="py-3">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <CardTitle className="text-base flex items-center gap-2">
                              {po.id} - {po.vendor}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {new Date(po.date).toLocaleDateString()} - 
                              {po.projections.join(", ")}
                            </p>
                          </div>
                          <Badge 
                            variant={po.status === "Draft" ? "outline" : "secondary"}
                            className="ml-auto"
                          >
                            {po.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <p className="font-medium">${po.total.toLocaleString()} - {po.items.length} items</p>
                        
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActivePO(activePO === po.id ? null : po.id)}
                          >
                            {activePO === po.id ? "Hide Details" : "View Details"}
                          </Button>
                          
                          {po.status === "Draft" ? (
                            <Button
                              size="sm"
                              onClick={() => handleApprovePO(po.id)}
                            >
                              <Check size={16} className="mr-1" />
                              Approve
                            </Button>
                          ) : (
                            <Button
                              size="sm" 
                              onClick={() => handleSendPO(po.id)}
                            >
                              <Send size={16} className="mr-1" />
                              Send to Vendor
                            </Button>
                          )}
                        </div>
                        
                        {activePO === po.id && (
                          <div className="mt-4 border-t pt-3">
                            <h4 className="text-sm font-medium mb-2">PO Items</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Part Code</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead>Qty</TableHead>
                                  <TableHead>Price</TableHead>
                                  <TableHead>Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {po.items.map((item, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-mono text-xs">{item.partCode}</TableCell>
                                    <TableCell className="text-sm">{item.description}</TableCell>
                                    <TableCell className="text-sm">{item.quantity}</TableCell>
                                    <TableCell className="text-sm">${item.unitPrice.toFixed(2)}</TableCell>
                                    <TableCell className="text-sm font-medium">${(item.quantity * item.unitPrice).toLocaleString()}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                
                <TabsContent value="sent">
                  {sentPOs.map((po) => (
                    <Card key={po.id}>
                      <CardHeader className="py-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle className="text-base">{po.id} - {po.vendor}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {new Date(po.date).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge 
                            variant="outline"
                            className="bg-green-100 text-green-800 hover:bg-green-100 ml-auto"
                          >
                            {po.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <p className="font-medium">${po.total.toLocaleString()} - {po.items.length} items</p>
                        
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActivePO(activePO === po.id ? null : po.id)}
                          >
                            {activePO === po.id ? "Hide Details" : "View Details"}
                          </Button>
                        </div>
                        
                        {activePO === po.id && (
                          <div className="mt-4 border-t pt-3">
                            <h4 className="text-sm font-medium mb-2">PO Items</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Part Code</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead>Qty</TableHead>
                                  <TableHead>Price</TableHead>
                                  <TableHead>Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {po.items.map((item, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-mono text-xs">{item.partCode}</TableCell>
                                    <TableCell className="text-sm">{item.description}</TableCell>
                                    <TableCell className="text-sm">{item.quantity}</TableCell>
                                    <TableCell className="text-sm">${item.unitPrice.toFixed(2)}</TableCell>
                                    <TableCell className="text-sm font-medium">${(item.quantity * item.unitPrice).toLocaleString()}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Purchase;
