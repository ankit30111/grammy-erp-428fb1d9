
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

  // Fetch pending GRNs
  const { data: pendingGRNs = [] } = useQuery({
    queryKey: ["pending-grns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grn")
        .select(`
          *,
          vendors!inner(name),
          purchase_orders!inner(po_number),
          grn_items!inner(
            *,
            raw_materials!inner(material_code, name)
          )
        `)
        .eq("status", "RECEIVED");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Mock data for completed inspections since iqc_reports table types aren't available
  const completedInspections = [
    {
      id: "1",
      inspection_date: "2025-05-28",
      result: "Accepted",
      grn_items: {
        grn: { grn_number: "GRN-001" },
        raw_materials: { material_code: "PCB-123", name: "Main PCB" },
        store_confirmed: false
      }
    }
  ];

  // Find the selected GRN and material details
  const selectedGRNDetails = pendingGRNs.find(grn => grn.id === selectedGRN);
  const selectedMaterialDetails = selectedGRNDetails?.grn_items?.find((item: any) => item.id === selectedMaterial);
  const selectedInspectionDetails = completedInspections.find(insp => insp.id === selectedInspection);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Handle inspection submission - using mock for now
  const handleSubmitInspection = async () => {
    if (!selectedGRN || !selectedMaterial || !inspectionStatus) {
      toast({
        title: "Missing information",
        description: "Please select a GRN, material and inspection status",
        variant: "destructive",
      });
      return;
    }

    try {
      // Mock inspection submission - would use iqc_reports table when types are available
      console.log("Submitting inspection:", {
        grn_item_id: selectedMaterial,
        result: inspectionStatus,
        remarks: remarks,
        approved_quantity: inspectionStatus === "Accepted" ? selectedMaterialDetails?.received_quantity : 0,
        rejected_quantity: inspectionStatus === "Rejected" ? selectedMaterialDetails?.received_quantity : 0,
      });

      // Update GRN item IQC status
      await supabase
        .from("grn_items")
        .update({ iqc_status: inspectionStatus.toUpperCase() })
        .eq("id", selectedMaterial);

      toast({
        title: "Inspection recorded",
        description: `${selectedMaterialDetails?.raw_materials?.material_code} has been marked as ${inspectionStatus}`,
      });

      // Reset form
      setSelectedGRN(null);
      setSelectedMaterial(null);
      setInspectionStatus("");
      setRemarks("");
      setSelectedFile(null);
    } catch (error) {
      console.error("Error submitting inspection:", error);
      toast({
        title: "Error",
        description: "Failed to submit inspection",
        variant: "destructive",
      });
    }
  };

  // Handle store acceptance
  const handleStoreAcceptance = async () => {
    if (!selectedInspection || !receivedQuantity) {
      toast({
        title: "Missing information",
        description: "Please select an inspection and enter received quantity",
        variant: "destructive",
      });
      return;
    }

    try {
      const qty = parseInt(receivedQuantity);
      
      // Mock store confirmation - would need to link with actual inspection data
      console.log("Store acceptance:", { inspection_id: selectedInspection, quantity: qty });

      toast({
        title: "Material accepted by store",
        description: `Material has been received in store with quantity: ${qty}`,
      });

      // Reset form
      setSelectedInspection(null);
      setReceivedQuantity("");
    } catch (error) {
      console.error("Error confirming store acceptance:", error);
      toast({
        title: "Error",
        description: "Failed to confirm store acceptance",
        variant: "destructive",
      });
    }
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
                  {pendingGRNs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending GRNs for IQC inspection
                    </div>
                  ) : (
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
                        {pendingGRNs.map((grn: any) => (
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
                            <TableCell className="font-medium">{grn.grn_number}</TableCell>
                            <TableCell>{new Date(grn.received_date).toLocaleDateString()}</TableCell>
                            <TableCell>{grn.vendors?.name}</TableCell>
                            <TableCell>{grn.purchase_orders?.po_number}</TableCell>
                            <TableCell>{grn.grn_items?.length || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {selectedGRN && selectedGRNDetails && (
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle>Material Selection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <h3 className="font-medium">GRN: {selectedGRNDetails.grn_number}</h3>
                      <div className="space-y-2">
                        {selectedGRNDetails.grn_items?.map((item: any) => (
                          <div 
                            key={item.id} 
                            className={`p-2 border rounded cursor-pointer ${selectedMaterial === item.id ? 'bg-accent border-primary' : ''}`}
                            onClick={() => setSelectedMaterial(item.id)}
                          >
                            <div className="font-mono text-sm">{item.raw_materials?.material_code}</div>
                            <div className="text-sm">{item.raw_materials?.name}</div>
                            <div className="text-xs text-muted-foreground">Qty: {item.received_quantity}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {selectedMaterial && selectedMaterialDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>Record Inspection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium mb-2">Material Details</h3>
                      <p><span className="font-medium">Part Code:</span> {selectedMaterialDetails.raw_materials?.material_code}</p>
                      <p><span className="font-medium">Description:</span> {selectedMaterialDetails.raw_materials?.name}</p>
                      <p><span className="font-medium">Quantity:</span> {selectedMaterialDetails.received_quantity}</p>
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
                {completedInspections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No completed inspections found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>GRN ID</TableHead>
                        <TableHead>Part Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedInspections.map((inspection: any) => (
                        <TableRow key={inspection.id}>
                          <TableCell>{new Date(inspection.inspection_date).toLocaleDateString()}</TableCell>
                          <TableCell>{inspection.grn_items?.grn?.grn_number}</TableCell>
                          <TableCell className="font-mono">{inspection.grn_items?.raw_materials?.material_code}</TableCell>
                          <TableCell>{inspection.grn_items?.raw_materials?.name}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                inspection.result === "Accepted" ? "bg-green-100 text-green-800" :
                                inspection.result === "Rejected" ? "bg-red-100 text-red-800" :
                                "bg-amber-100 text-amber-800"
                              }
                            >
                              {inspection.result}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                <FileCheck className="h-3 w-3 mr-1" />
                                Report
                              </Button>
                              {inspection.result === "Rejected" && (
                                <Button variant="outline" size="sm" onClick={() => setSelectedTab("capa")}>
                                  CAPA
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
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
                      <div className="text-center py-8 text-muted-foreground">
                        No materials pending store acceptance
                      </div>
                    </CardContent>
                  </Card>

                  {selectedInspection && selectedInspectionDetails && (
                    <Card className="lg:col-span-1">
                      <CardHeader>
                        <CardTitle>Store Acceptance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <h3 className="font-medium">Material Details</h3>
                          <div className="space-y-1">
                            <p><span className="font-medium">GRN: </span>{selectedInspectionDetails.grn_items?.grn?.grn_number}</p>
                            <p><span className="font-medium">Part Code: </span>{selectedInspectionDetails.grn_items?.raw_materials?.material_code}</p>
                            <p><span className="font-medium">Description: </span>{selectedInspectionDetails.grn_items?.raw_materials?.name}</p>
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
                    <div className="text-center py-8 text-muted-foreground">
                      No processed store receipts
                    </div>
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
                <div className="text-center py-8 text-muted-foreground">
                  CAPA functionality will be implemented based on rejected materials
                </div>
                
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
