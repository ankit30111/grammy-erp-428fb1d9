import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clock, FileCheck, Upload, X, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Mock data for GRN pending IQC inspection
const pendingGRNs = [
  { 
    id: "GRN-001", 
    date: "2025-05-15", 
    vendor: "Electronics Components Ltd",
    poNumber: "PO-2025-042",
    materials: [
      { id: "M1", partCode: "PCB-123", description: "Main PCB", quantity: 1000 },
      { id: "M2", partCode: "SPK-A44", description: "Speaker Driver", quantity: 2000 }
    ]
  },
  { 
    id: "GRN-002", 
    date: "2025-05-16", 
    vendor: "Precision Metals Inc",
    poNumber: "PO-2025-043",
    materials: [
      { id: "M3", partCode: "ENC-B22", description: "Metal Enclosure", quantity: 500 }
    ]
  },
  { 
    id: "GRN-003", 
    date: "2025-05-17", 
    vendor: "Global Plastics",
    poNumber: "PO-2025-044",
    materials: [
      { id: "M4", partCode: "CAP-C77", description: "Control Knob", quantity: 5000 },
      { id: "M5", partCode: "GRL-D11", description: "Speaker Grille", quantity: 1000 }
    ]
  }
];

// Mock data for completed IQC inspections
const completedInspections = [
  {
    id: "IQC-001",
    date: "2025-05-14",
    grnId: "GRN-000",
    partCode: "PCB-121",
    description: "Main PCB",
    status: "Accepted",
    remarks: "Meets all specifications",
    inspector: "John Doe",
    documentUrl: "#",
    storeStatus: "Pending"
  },
  {
    id: "IQC-002",
    date: "2025-05-13",
    grnId: "GRN-000",
    partCode: "SPK-A42",
    description: "Speaker Driver",
    status: "Rejected",
    remarks: "Solder quality below standard",
    inspector: "Jane Smith",
    documentUrl: "#",
    storeStatus: null
  },
  {
    id: "IQC-003",
    date: "2025-05-12",
    grnId: "GRN-000",
    partCode: "ENC-B20",
    description: "Metal Enclosure",
    status: "Segregated",
    remarks: "Minor surface scratches on 20% of units",
    inspector: "Robert Johnson",
    documentUrl: "#",
    storeStatus: null
  },
  {
    id: "IQC-004",
    date: "2025-05-11",
    grnId: "GRN-001",
    partCode: "PCB-123",
    description: "Main PCB",
    status: "Accepted",
    remarks: "All specifications met",
    inspector: "John Doe",
    documentUrl: "#",
    storeStatus: "Accepted",
    receivedQuantity: 1000
  },
  {
    id: "IQC-005",
    date: "2025-05-10",
    grnId: "GRN-001",
    partCode: "SPK-A44",
    description: "Speaker Driver",
    status: "Accepted",
    remarks: "All specifications met",
    inspector: "Jane Smith",
    documentUrl: "#",
    storeStatus: "Quantity Mismatch",
    receivedQuantity: 1950,
    grn_quantity: 2000
  }
];

// Mock data for CAPA tracking
const capaItems = [
  {
    id: "CAPA-001",
    issueDate: "2025-05-10",
    partCode: "SPK-A42",
    description: "Speaker Driver failure",
    rootCause: "Poor solder quality from vendor",
    correctiveAction: "Vendor process audit and retraining",
    status: "In Progress",
    dueDate: "2025-05-25",
    owner: "Quality Team"
  },
  {
    id: "CAPA-002",
    issueDate: "2025-05-08",
    partCode: "PCB-118",
    description: "PCB component misalignment",
    rootCause: "Incorrect pick-and-place machine calibration",
    correctiveAction: "Machine recalibration and preventive maintenance schedule updated",
    status: "Completed",
    dueDate: "2025-05-15",
    owner: "Production Team"
  }
];

const IQC = () => {
  const [selectedTab, setSelectedTab] = useState("pending");
  const [selectedGRN, setSelectedGRN] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [inspectionStatus, setInspectionStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [receivedQuantity, setReceivedQuantity] = useState("");
  const [selectedInspection, setSelectedInspection] = useState<string | null>(null);
  const { toast } = useToast();

  // Find the selected GRN and material details
  const selectedGRNDetails = pendingGRNs.find(grn => grn.id === selectedGRN);
  const selectedMaterialDetails = selectedGRNDetails?.materials.find(m => m.id === selectedMaterial);
  const selectedInspectionDetails = completedInspections.find(insp => insp.id === selectedInspection);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Handle inspection submission
  const handleSubmitInspection = () => {
    if (!selectedGRN || !selectedMaterial || !inspectionStatus) {
      toast({
        title: "Missing information",
        description: "Please select a GRN, material and inspection status",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Inspection recorded",
      description: `${selectedMaterialDetails?.partCode} has been marked as ${inspectionStatus}`,
    });

    // Reset form
    setSelectedGRN(null);
    setSelectedMaterial(null);
    setInspectionStatus("");
    setRemarks("");
    setSelectedFile(null);
  };

  // Handle store acceptance
  const handleStoreAcceptance = () => {
    if (!selectedInspection || !receivedQuantity) {
      toast({
        title: "Missing information",
        description: "Please select an inspection and enter received quantity",
        variant: "destructive",
      });
      return;
    }

    const qty = parseInt(receivedQuantity);
    const grnQty = pendingGRNs.find(grn => 
      grn.id === selectedInspectionDetails?.grnId
    )?.materials.find(m => 
      m.partCode === selectedInspectionDetails?.partCode
    )?.quantity || 0;

    let status = "Accepted";
    if (qty !== grnQty) {
      status = "Quantity Mismatch";
      toast({
        title: "Quantity mismatch detected",
        description: `Received ${qty} units but GRN shows ${grnQty} units. Purchase department will be notified.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Material accepted by store",
        description: `${selectedInspectionDetails?.partCode} has been received in store with quantity: ${qty}`,
      });
    }

    // Reset form
    setSelectedInspection(null);
    setReceivedQuantity("");
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Incoming Quality Control (IQC)</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pending">Pending Inspection</TabsTrigger>
            <TabsTrigger value="completed">Completed Inspections</TabsTrigger>
            <TabsTrigger value="store">Store Acceptance</TabsTrigger>
            <TabsTrigger value="capa">CAPA Tracking</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>GRN Pending IQC</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>GRN ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Items</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingGRNs.map((grn) => (
                        <TableRow key={grn.id} className={selectedGRN === grn.id ? "bg-accent" : ""}>
                          <TableCell>
                            <input 
                              type="radio" 
                              name="grn" 
                              checked={selectedGRN === grn.id}
                              onChange={() => {
                                setSelectedGRN(grn.id);
                                setSelectedMaterial(null);
                              }} 
                            />
                          </TableCell>
                          <TableCell className="font-medium">{grn.id}</TableCell>
                          <TableCell>{new Date(grn.date).toLocaleDateString()}</TableCell>
                          <TableCell>{grn.vendor}</TableCell>
                          <TableCell>{grn.poNumber}</TableCell>
                          <TableCell>{grn.materials.length}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {selectedGRN && (
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle>Material Selection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <h3 className="font-medium">GRN: {selectedGRN}</h3>
                      <div className="space-y-2">
                        {selectedGRNDetails?.materials.map((material) => (
                          <div 
                            key={material.id} 
                            className={`p-2 border rounded cursor-pointer ${selectedMaterial === material.id ? 'bg-accent border-primary' : ''}`}
                            onClick={() => setSelectedMaterial(material.id)}
                          >
                            <div className="font-mono text-sm">{material.partCode}</div>
                            <div className="text-sm">{material.description}</div>
                            <div className="text-xs text-muted-foreground">Qty: {material.quantity}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {selectedMaterial && (
              <Card>
                <CardHeader>
                  <CardTitle>Record Inspection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium mb-2">Material Details</h3>
                      <p><span className="font-medium">Part Code:</span> {selectedMaterialDetails?.partCode}</p>
                      <p><span className="font-medium">Description:</span> {selectedMaterialDetails?.description}</p>
                      <p><span className="font-medium">Quantity:</span> {selectedMaterialDetails?.quantity}</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="status" className="text-sm font-medium mb-1 block">
                          Inspection Status
                        </label>
                        <Select value={inspectionStatus} onValueChange={setInspectionStatus}>
                          <SelectTrigger id="status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Accepted">Accepted</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                            <SelectItem value="Segregated">Segregated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label htmlFor="remarks" className="text-sm font-medium mb-1 block">
                          Remarks
                        </label>
                        <Input
                          id="remarks"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Enter inspection remarks"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="document" className="text-sm font-medium mb-1 block">
                          Upload Document
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="document"
                            type="file"
                            onChange={handleFileChange}
                          />
                          {selectedFile && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setSelectedFile(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {selectedFile && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedFile.name}
                          </p>
                        )}
                      </div>
                      
                      <Button 
                        className="w-full mt-4" 
                        onClick={handleSubmitInspection}
                      >
                        Submit Inspection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="completed">
            <Card>
              <CardHeader>
                <CardTitle>Completed Inspections</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>GRN ID</TableHead>
                      <TableHead>Part Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Inspector</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedInspections.map((inspection) => (
                      <TableRow key={inspection.id}>
                        <TableCell>{new Date(inspection.date).toLocaleDateString()}</TableCell>
                        <TableCell>{inspection.grnId}</TableCell>
                        <TableCell className="font-mono">{inspection.partCode}</TableCell>
                        <TableCell>{inspection.description}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              inspection.status === "Accepted" ? "bg-green-100 text-green-800" :
                              inspection.status === "Rejected" ? "bg-red-100 text-red-800" :
                              "bg-amber-100 text-amber-800"
                            }
                          >
                            {inspection.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{inspection.inspector}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <FileCheck className="h-3 w-3 mr-1" />
                              Report
                            </Button>
                            {inspection.status === "Rejected" && (
                              <Button variant="outline" size="sm" onClick={() => setSelectedTab("capa")}>
                                CAPA
                              </Button>
                            )}
                            {inspection.status === "Accepted" && inspection.storeStatus === "Pending" && (
                              <Button variant="outline" size="sm" onClick={() => setSelectedTab("store")}>
                                To Store
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="store">
            <Card>
              <CardHeader>
                <CardTitle>Store Acceptance of IQC Approved Materials</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Pending Store Acceptance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead></TableHead>
                            <TableHead>GRN ID</TableHead>
                            <TableHead>Part Code</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>IQC Status</TableHead>
                            <TableHead>Store Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {completedInspections
                            .filter(inspection => 
                              inspection.status === "Accepted" && 
                              (inspection.storeStatus === "Pending" || inspection.storeStatus === null)
                            )
                            .map((inspection) => (
                              <TableRow 
                                key={inspection.id}
                                className={selectedInspection === inspection.id ? "bg-accent" : ""}
                              >
                                <TableCell>
                                  <input 
                                    type="radio" 
                                    name="inspection" 
                                    checked={selectedInspection === inspection.id}
                                    onChange={() => setSelectedInspection(inspection.id)} 
                                  />
                                </TableCell>
                                <TableCell>{inspection.grnId}</TableCell>
                                <TableCell className="font-mono">{inspection.partCode}</TableCell>
                                <TableCell>{inspection.description}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-100 text-green-800">
                                    Accepted
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-amber-100 text-amber-800">
                                    {inspection.storeStatus || "Pending"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                          ))}
                          {completedInspections.filter(inspection => 
                              inspection.status === "Accepted" && 
                              (inspection.storeStatus === "Pending" || inspection.storeStatus === null)
                            ).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                No materials pending store acceptance
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {selectedInspection && (
                    <Card className="lg:col-span-1">
                      <CardHeader>
                        <CardTitle>Store Acceptance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <h3 className="font-medium">Material Details</h3>
                          <div className="space-y-1">
                            <p><span className="font-medium">GRN: </span>{selectedInspectionDetails?.grnId}</p>
                            <p><span className="font-medium">Part Code: </span>{selectedInspectionDetails?.partCode}</p>
                            <p><span className="font-medium">Description: </span>{selectedInspectionDetails?.description}</p>
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="quantity" className="text-sm font-medium">
                              Received Quantity
                            </label>
                            <Input
                              id="quantity"
                              type="number"
                              value={receivedQuantity}
                              onChange={(e) => setReceivedQuantity(e.target.value)}
                              placeholder="Enter actual quantity received"
                            />
                          </div>
                          
                          <Button 
                            className="w-full mt-4"
                            onClick={handleStoreAcceptance}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Confirm Receipt
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Processed Store Receipts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>GRN ID</TableHead>
                          <TableHead>Part Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>GRN Quantity</TableHead>
                          <TableHead>Received Quantity</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {completedInspections
                          .filter(inspection => 
                            inspection.status === "Accepted" && 
                            inspection.storeStatus !== "Pending" &&
                            inspection.storeStatus !== null
                          )
                          .map((inspection) => (
                            <TableRow key={inspection.id}>
                              <TableCell>{new Date(inspection.date).toLocaleDateString()}</TableCell>
                              <TableCell>{inspection.grnId}</TableCell>
                              <TableCell className="font-mono">{inspection.partCode}</TableCell>
                              <TableCell>{inspection.description}</TableCell>
                              <TableCell>{inspection.grn_quantity || "-"}</TableCell>
                              <TableCell>{inspection.receivedQuantity || "-"}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={
                                    inspection.storeStatus === "Accepted" ? "bg-green-100 text-green-800" :
                                    "bg-yellow-100 text-yellow-800"
                                  }
                                >
                                  {inspection.storeStatus}
                                </Badge>
                              </TableCell>
                            </TableRow>
                        ))}
                        {completedInspections.filter(inspection => 
                          inspection.status === "Accepted" && 
                          inspection.storeStatus !== "Pending" &&
                          inspection.storeStatus !== null
                        ).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                              No processed store receipts
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="capa">
            <Card>
              <CardHeader>
                <CardTitle>CAPA Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Part Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Root Cause</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capaItems.map((capa) => (
                      <TableRow key={capa.id}>
                        <TableCell className="font-medium">{capa.id}</TableCell>
                        <TableCell>{new Date(capa.issueDate).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono">{capa.partCode}</TableCell>
                        <TableCell>{capa.description}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={capa.rootCause}>
                          {capa.rootCause}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              capa.status === "Completed" ? "bg-green-100 text-green-800" :
                              "bg-amber-100 text-amber-800"
                            }
                          >
                            {capa.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(capa.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell>{capa.owner}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <Button className="mt-4">
                  <Upload className="h-4 w-4 mr-2" />
                  Create New CAPA
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default IQC;
