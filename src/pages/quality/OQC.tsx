import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clock, FileCheck, Upload, Search, X as XIcon } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Mock data for pending OQC
const pendingOQC = [
  {
    id: "OQC-P001",
    productionId: "PROD-001",
    product: "Speaker A300",
    customer: "AudioTech Inc",
    quantity: 1000,
    completionDate: "2025-05-17",
    status: "Ready for OQC"
  },
  {
    id: "OQC-P002",
    productionId: "PROD-002",
    product: "Subwoofer S200",
    customer: "SoundMaster",
    quantity: 500,
    completionDate: "2025-05-18",
    status: "Ready for OQC"
  }
];

// Mock data for completed OQC
const completedOQC = [
  {
    id: "OQC-C001",
    productionId: "PROD-000",
    product: "Tweeter T100",
    customer: "EchoSystems",
    quantity: 10000,
    inspectionDate: "2025-05-16",
    result: "Approved",
    inspector: "Emily Chen"
  },
  {
    id: "OQC-C002",
    productionId: "PROD-00A",
    product: "Speaker A300",
    customer: "AudioTech Inc",
    quantity: 5000,
    inspectionDate: "2025-05-15",
    result: "Rejected",
    inspector: "Mark Wilson"
  }
];

// Mock data for customer returns
const customerReturns = [
  {
    id: "RET-001",
    customer: "AudioTech Inc",
    product: "Speaker A300",
    returnDate: "2025-05-10",
    quantity: 50,
    reason: "Sound quality issues",
    status: "Pending Analysis"
  },
  {
    id: "RET-002",
    customer: "SoundMaster",
    product: "Subwoofer S200",
    returnDate: "2025-05-12",
    quantity: 20,
    reason: "Housing damage during shipping",
    status: "Analysis Completed"
  }
];

// Mock OQC checklist
const oqcChecklist = [
  { id: "1", category: "Appearance", description: "External housing condition inspection", mandatory: true, result: "" },
  { id: "2", category: "Appearance", description: "Label and branding verification", mandatory: true, result: "" },
  { id: "3", category: "Appearance", description: "Assembly integrity check", mandatory: true, result: "" },
  { id: "4", category: "Functionality", description: "Power on test", mandatory: true, result: "" },
  { id: "5", category: "Functionality", description: "Volume control test", mandatory: true, result: "" },
  { id: "6", category: "Functionality", description: "Sound quality assessment", mandatory: true, result: "" },
  { id: "7", category: "Functionality", description: "Connectivity test (Bluetooth/WiFi)", mandatory: false, result: "" },
  { id: "8", category: "Packaging", description: "Packaging material inspection", mandatory: true, result: "" },
  { id: "9", category: "Packaging", description: "Accessories verification", mandatory: true, result: "" },
  { id: "10", category: "Documentation", description: "User manual inclusion check", mandatory: true, result: "" },
];

const OQC = () => {
  const [selectedTab, setSelectedTab] = useState("pending");
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<string | null>(null);
  const [checklist, setChecklist] = useState(oqcChecklist);
  const [samplingRate, setSamplingRate] = useState("10");
  const [sampleSize, setSampleSize] = useState(0);
  const [notes, setNotes] = useState("");
  
  const { toast } = useToast();

  // Find the selected batch details
  const selectedBatchDetails = pendingOQC.find(batch => batch.id === selectedBatch);
  const selectedReturnDetails = customerReturns.find(ret => ret.id === selectedReturn);
  
  // Calculate sample size based on batch quantity and sampling rate
  const calculateSampleSize = (quantity: number, rate: number) => {
    return Math.max(5, Math.ceil(quantity * (rate / 100)));
  };

  // Update sample size when batch or sampling rate changes
  const updateSampleSize = () => {
    if (selectedBatchDetails) {
      setSampleSize(calculateSampleSize(selectedBatchDetails.quantity, parseInt(samplingRate)));
    }
  };

  // Update sample size when batch or sampling rate changes
  useState(() => {
    updateSampleSize();
  });
  
  // Handle checklist item result change
  const handleChecklistChange = (id: string, value: string) => {
    setChecklist(items => 
      items.map(item => 
        item.id === id ? { ...item, result: value } : item
      )
    );
  };

  // Handle OQC approval
  const handleOQCApproval = (approved: boolean) => {
    // Validate that all mandatory checks have results
    const missingChecks = checklist
      .filter(item => item.mandatory && item.result === "")
      .map(item => item.description);
    
    if (missingChecks.length > 0) {
      toast({
        title: "Incomplete checklist",
        description: `Please complete all mandatory checks before ${approved ? 'approving' : 'rejecting'}`,
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: approved ? "Batch Approved" : "Batch Rejected",
      description: `The batch has been ${approved ? 'approved' : 'rejected'} and the record has been saved.`,
    });
    
    // Reset selection and form
    setSelectedBatch(null);
    setChecklist(oqcChecklist.map(item => ({ ...item, result: "" })));
    setNotes("");
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Outgoing Quality Control (OQC)</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">Pending OQC</TabsTrigger>
            <TabsTrigger value="completed">Completed OQC</TabsTrigger>
            <TabsTrigger value="returns">Customer Returns</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Production Batches Pending OQC</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>OQC ID</TableHead>
                        <TableHead>Production ID</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Completion Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingOQC.map((batch) => (
                        <TableRow key={batch.id} className={selectedBatch === batch.id ? "bg-accent" : ""}>
                          <TableCell>
                            <input 
                              type="radio" 
                              name="batch" 
                              checked={selectedBatch === batch.id}
                              onChange={() => {
                                setSelectedBatch(batch.id);
                                setSampleSize(calculateSampleSize(batch.quantity, parseInt(samplingRate)));
                              }} 
                            />
                          </TableCell>
                          <TableCell className="font-medium">{batch.id}</TableCell>
                          <TableCell>{batch.productionId}</TableCell>
                          <TableCell>{batch.product}</TableCell>
                          <TableCell>{batch.customer}</TableCell>
                          <TableCell>{batch.quantity.toLocaleString()}</TableCell>
                          <TableCell>{new Date(batch.completionDate).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {selectedBatch && selectedBatchDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle>Sampling Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-2">{selectedBatchDetails.product}</h3>
                        <p className="text-sm">
                          <span className="font-medium">Customer:</span> {selectedBatchDetails.customer}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Total Quantity:</span> {selectedBatchDetails.quantity.toLocaleString()} units
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="samplingRate" className="text-sm font-medium mb-1 block">
                          Sampling Rate (%)
                        </label>
                        <Select 
                          value={samplingRate} 
                          onValueChange={(value) => {
                            setSamplingRate(value);
                            setSampleSize(calculateSampleSize(selectedBatchDetails.quantity, parseInt(value)));
                          }}
                        >
                          <SelectTrigger id="samplingRate">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="10">10%</SelectItem>
                            <SelectItem value="15">15%</SelectItem>
                            <SelectItem value="20">20%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Sample Size
                        </label>
                        <div className="p-2 border rounded bg-accent">
                          <span className="font-medium">{sampleSize}</span> units to be inspected
                        </div>
                      </div>
                      
                      <Button className="w-full mt-2" variant="secondary">
                        <Check className="h-4 w-4 mr-2" />
                        Begin Inspection
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {selectedBatch && (
              <Card>
                <CardHeader>
                  <CardTitle>OQC Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {["Appearance", "Functionality", "Packaging", "Documentation"].map((category) => {
                      const categoryItems = checklist.filter(item => item.category === category);
                      return (
                        <div key={category} className="space-y-2">
                          <h3 className="font-medium text-lg">{category}</h3>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[60%]">Check Item</TableHead>
                                <TableHead className="w-[20%]">Required</TableHead>
                                <TableHead className="w-[20%]">Result</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {categoryItems.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>{item.description}</TableCell>
                                  <TableCell>
                                    {item.mandatory ? (
                                      <Badge variant="outline" className="bg-red-100 text-red-800">
                                        Mandatory
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">Optional</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={item.result}
                                      onValueChange={(value) => handleChecklistChange(item.id, value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Pass">Pass</SelectItem>
                                        <SelectItem value="Fail">Fail</SelectItem>
                                        <SelectItem value="N/A">N/A</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })}
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="notes" className="text-sm font-medium mb-1 block">
                          Additional Notes
                        </label>
                        <Input
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Enter any additional observations or notes"
                        />
                      </div>
                      
                      <div className="flex gap-4">
                        <Button 
                          className="flex-1" 
                          onClick={() => handleOQCApproval(true)}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button 
                          className="flex-1" 
                          variant="destructive"
                          onClick={() => handleOQCApproval(false)}
                        >
                          <XIcon className="h-4 w-4 mr-2" />
                          Reject
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
                <CardTitle>Completed Inspections</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by ID or product" className="pl-8" />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OQC ID</TableHead>
                      <TableHead>Production ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Inspection Date</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Inspector</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedOQC.map((inspection) => (
                      <TableRow key={inspection.id}>
                        <TableCell className="font-medium">{inspection.id}</TableCell>
                        <TableCell>{inspection.productionId}</TableCell>
                        <TableCell>{inspection.product}</TableCell>
                        <TableCell>{inspection.customer}</TableCell>
                        <TableCell>{inspection.quantity.toLocaleString()}</TableCell>
                        <TableCell>{new Date(inspection.inspectionDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={
                              inspection.result === "Approved" ? "bg-green-100 text-green-800" :
                              "bg-red-100 text-red-800"
                            }
                          >
                            {inspection.result}
                          </Badge>
                        </TableCell>
                        <TableCell>{inspection.inspector}</TableCell>
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
          
          <TabsContent value="returns" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Customer Returns</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>Return ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Return Date</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerReturns.map((ret) => (
                        <TableRow key={ret.id} className={selectedReturn === ret.id ? "bg-accent" : ""}>
                          <TableCell>
                            <input 
                              type="radio" 
                              name="return" 
                              checked={selectedReturn === ret.id}
                              onChange={() => setSelectedReturn(ret.id)} 
                            />
                          </TableCell>
                          <TableCell className="font-medium">{ret.id}</TableCell>
                          <TableCell>{ret.customer}</TableCell>
                          <TableCell>{ret.product}</TableCell>
                          <TableCell>{new Date(ret.returnDate).toLocaleDateString()}</TableCell>
                          <TableCell>{ret.quantity}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                ret.status === "Analysis Completed" ? "bg-green-100 text-green-800" :
                                "bg-amber-100 text-amber-800"
                              }
                            >
                              {ret.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {selectedReturn && selectedReturnDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle>Return Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-2">{selectedReturnDetails.product}</h3>
                        <p className="text-sm">
                          <span className="font-medium">Customer:</span> {selectedReturnDetails.customer}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Quantity:</span> {selectedReturnDetails.quantity} units
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Return Date:</span> {new Date(selectedReturnDetails.returnDate).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="pt-2">
                        <h4 className="text-sm font-medium mb-1">Return Reason:</h4>
                        <p className="border p-2 rounded bg-accent text-sm">{selectedReturnDetails.reason}</p>
                      </div>
                      
                      <div className="pt-2 border-t">
                        <Button className="w-full">
                          Begin Analysis
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {selectedReturn && selectedReturnDetails.status === "Analysis Completed" && (
              <Card>
                <CardHeader>
                  <CardTitle>Return Analysis Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border rounded p-4">
                        <h3 className="font-medium mb-2">Root Cause Analysis</h3>
                        <p className="text-sm">The analysis has determined that the sound quality issues were caused by a faulty batch of speaker drivers supplied by vendor ABC Electronics. The issue affects approximately 2% of production.</p>
                      </div>
                      
                      <div className="border rounded p-4">
                        <h3 className="font-medium mb-2">Corrective Action</h3>
                        <p className="text-sm">A supplier audit has been conducted, and the vendor has implemented additional quality checks. The affected batch has been identified and recalled where possible.</p>
                      </div>
                    </div>
                    
                    <div className="border rounded p-4">
                      <h3 className="font-medium mb-2">Preventive Action</h3>
                      <p className="text-sm">IQC process has been updated with additional speaker driver testing requirements. Documentation updated and training provided to quality team members.</p>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button variant="outline">
                        <FileCheck className="h-4 w-4 mr-2" />
                        Download Full Report
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default OQC;
