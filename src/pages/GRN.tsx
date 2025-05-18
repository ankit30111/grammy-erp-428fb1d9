
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Clock, Calendar, Check, X, Trash2 } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Mock data for purchase orders
const pendingPOs = [
  { 
    id: "PO-2025-000", 
    date: "2025-05-15", 
    vendor: "ElectroComp Ltd",
    vendorId: "VEN-001",
    items: [
      { partCode: "CAP-333", description: "Capacitor 10μF", quantity: 5000, received: 0, unitPrice: 0.25 }
    ]
  },
  { 
    id: "PO-2025-001", 
    date: "2025-05-20", 
    vendor: "ElectroComp Ltd", 
    vendorId: "VEN-001",
    items: [
      { partCode: "PCB-123", description: "Main PCB", quantity: 1000, received: 0, unitPrice: 12.50 },
      { partCode: "RES-456", description: "Resistor Pack", quantity: 5000, received: 0, unitPrice: 0.15 }
    ]
  },
  { 
    id: "PO-2025-002", 
    date: "2025-05-20", 
    vendor: "SpeakTech Inc", 
    vendorId: "VEN-002",
    items: [
      { partCode: "SPK-A44", description: "Speaker Driver", quantity: 2000, received: 0, unitPrice: 8.75 },
      { partCode: "CON-789", description: "Speaker Connector", quantity: 2000, received: 0, unitPrice: 1.25 }
    ]
  },
];

// Mock data for GRNs
const existingGRNs = [
  { 
    id: "GRN-2025-045", 
    date: "2025-05-18", 
    vendor: "ElectroComp Ltd", 
    poReference: "PO-2025-000",
    status: "Pending QC",
    items: [
      { partCode: "CAP-333", description: "Capacitor 10μF", poQuantity: 5000, receivedQuantity: 5000 }
    ]
  },
  { 
    id: "GRN-2025-044", 
    date: "2025-05-17", 
    vendor: "SpeakTech Inc", 
    poReference: "PO-2025-002",
    status: "Approved",
    items: [
      { partCode: "SPK-A44", description: "Speaker Driver", poQuantity: 2000, receivedQuantity: 1000 }
    ]
  },
  { 
    id: "GRN-2025-043", 
    date: "2025-05-16", 
    vendor: "ElectroComp Ltd", 
    poReference: "PO-2025-001",
    status: "Rejected",
    items: [
      { partCode: "PCB-123", description: "Main PCB", poQuantity: 1000, receivedQuantity: 400 }
    ]
  }
];

const GRN = () => {
  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [grnDate, setGrnDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [grnItems, setGrnItems] = useState<any[]>([]);
  const [deliveryNoteNo, setDeliveryNoteNo] = useState("");
  const [activeTab, setActiveTab] = useState("create");
  const [selectedGRN, setSelectedGRN] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePOSelect = (poId: string) => {
    const selectedPurchaseOrder = pendingPOs.find(po => po.id === poId);
    
    if (selectedPurchaseOrder) {
      setSelectedPO(poId);
      // Initialize GRN items with default received quantities
      setGrnItems(selectedPurchaseOrder.items.map(item => ({
        ...item,
        receivedQuantity: 0,
        remarks: ""
      })));
    }
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newItems = [...grnItems];
    newItems[index].receivedQuantity = parseInt(value) || 0;
    setGrnItems(newItems);
  };

  const handleRemarksChange = (index: number, value: string) => {
    const newItems = [...grnItems];
    newItems[index].remarks = value;
    setGrnItems(newItems);
  };

  const handleCreateGRN = () => {
    if (!selectedPO || !grnDate || !deliveryNoteNo) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Check if any items have been received
    const hasReceivedItems = grnItems.some(item => item.receivedQuantity > 0);
    
    if (!hasReceivedItems) {
      toast({
        title: "No items received",
        description: "Please enter received quantities for at least one item",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "GRN Created Successfully",
      description: `Goods Receipt Note has been created and sent for QC approval`,
    });

    // Reset form
    setSelectedPO(null);
    setGrnItems([]);
    setDeliveryNoteNo("");
  };

  // Get selected PO details
  const selectedPODetails = pendingPOs.find(po => po.id === selectedPO);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];
  
  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Goods Receipt Note (GRN)</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, 14:35</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="flex w-full mb-4">
          <Button 
            variant={activeTab === "create" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setActiveTab("create")}
          >
            <Package className="h-4 w-4 mr-2" />
            Create GRN
          </Button>
          <Button 
            variant={activeTab === "view" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setActiveTab("view")}
          >
            <Clock className="h-4 w-4 mr-2" />
            Recent GRNs
          </Button>
        </div>

        {activeTab === "create" ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Create New GRN
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label htmlFor="grnDate" className="text-sm font-medium mb-1 block">
                      GRN Date
                    </label>
                    <div className="relative">
                      <Input
                        id="grnDate"
                        type="date"
                        value={grnDate}
                        onChange={(e) => setGrnDate(e.target.value)}
                        max={today}
                      />
                      <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="deliveryNote" className="text-sm font-medium mb-1 block">
                      Delivery Note No.
                    </label>
                    <Input
                      id="deliveryNote"
                      value={deliveryNoteNo}
                      onChange={(e) => setDeliveryNoteNo(e.target.value)}
                      placeholder="Vendor delivery note number"
                    />
                  </div>
                  
                  <div className="lg:col-span-2">
                    <label htmlFor="purchaseOrder" className="text-sm font-medium mb-1 block">
                      Select Purchase Order
                    </label>
                    <Select value={selectedPO || ""} onValueChange={handlePOSelect}>
                      <SelectTrigger id="purchaseOrder">
                        <SelectValue placeholder="Select a purchase order" />
                      </SelectTrigger>
                      <SelectContent>
                        {pendingPOs.map((po) => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.id} - {po.vendor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {selectedPODetails && (
                  <div className="mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Vendor</span>
                        <p className="font-medium">{selectedPODetails.vendor}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Vendor ID</span>
                        <p className="font-medium">{selectedPODetails.vendorId}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">PO Date</span>
                        <p className="font-medium">{new Date(selectedPODetails.date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Items</span>
                        <p className="font-medium">{selectedPODetails.items.length}</p>
                      </div>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>PO Quantity</TableHead>
                          <TableHead>Already Received</TableHead>
                          <TableHead>Received Now</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grnItems.map((item, idx) => (
                          <TableRow key={item.partCode}>
                            <TableCell className="font-mono">{item.partCode}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.quantity.toLocaleString()}</TableCell>
                            <TableCell>{item.received.toLocaleString()}</TableCell>
                            <TableCell>
                              <Input 
                                type="number"
                                min="0"
                                max={item.quantity - item.received}
                                value={item.receivedQuantity}
                                onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.remarks}
                                onChange={(e) => handleRemarksChange(idx, e.target.value)}
                                placeholder="Any issues or notes"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    <div className="flex justify-end mt-6">
                      <Button 
                        variant="outline" 
                        className="mr-2"
                        onClick={() => {
                          setSelectedPO(null);
                          setGrnItems([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateGRN}>Create GRN</Button>
                    </div>
                  </div>
                )}
                
                {!selectedPODetails && (
                  <div className="text-center py-8 border rounded-md bg-muted/20">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Select a purchase order to begin</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent GRNs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GRN Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>PO Reference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {existingGRNs.map((grn) => (
                      <TableRow key={grn.id}>
                        <TableCell className="font-medium">{grn.id}</TableCell>
                        <TableCell>{new Date(grn.date).toLocaleDateString()}</TableCell>
                        <TableCell>{grn.vendor}</TableCell>
                        <TableCell>{grn.poReference}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              grn.status === "Approved" ? "bg-green-100 text-green-800 hover:bg-green-100" :
                              grn.status === "Rejected" ? "bg-red-100 text-red-800 hover:bg-red-100" :
                              "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                            }
                          >
                            {grn.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedGRN(selectedGRN === grn.id ? null : grn.id)}
                          >
                            {selectedGRN === grn.id ? "Hide Details" : "View Details"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {selectedGRN && (
                  <div className="mt-6 border-t pt-4">
                    <h3 className="text-lg font-medium mb-4">GRN Details: {selectedGRN}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Status</span>
                        <p className="font-medium">
                          {existingGRNs.find(grn => grn.id === selectedGRN)?.status}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">PO Reference</span>
                        <p className="font-medium">
                          {existingGRNs.find(grn => grn.id === selectedGRN)?.poReference}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Vendor</span>
                        <p className="font-medium">
                          {existingGRNs.find(grn => grn.id === selectedGRN)?.vendor}
                        </p>
                      </div>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>PO Quantity</TableHead>
                          <TableHead>Received Quantity</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {existingGRNs.find(grn => grn.id === selectedGRN)?.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{item.partCode}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.poQuantity.toLocaleString()}</TableCell>
                            <TableCell>{item.receivedQuantity.toLocaleString()}</TableCell>
                            <TableCell>
                              {item.receivedQuantity < item.poQuantity ? (
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                  Partial
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                                  Complete
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    <div className="mt-4 flex justify-end gap-2">
                      {existingGRNs.find(grn => grn.id === selectedGRN)?.status === "Pending QC" && (
                        <>
                          <Button variant="outline" size="sm" className="border-green-500 text-green-600 hover:bg-green-50">
                            <Check size={16} className="mr-1" />
                            Approve
                          </Button>
                          <Button variant="outline" size="sm" className="border-red-500 text-red-600 hover:bg-red-50">
                            <X size={16} className="mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Button variant="outline" size="sm">
                        <Trash2 size={16} className="mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GRN;
