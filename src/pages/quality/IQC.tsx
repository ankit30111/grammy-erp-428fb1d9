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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

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

  // Fetch completed inspections
  const { data: completedInspections = [] } = useQuery({
    queryKey: ["completed-inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grn_items")
        .select(`
          *,
          grn!inner(
            grn_number,
            vendors(name)
          ),
          raw_materials!inner(material_code, name)
        `)
        .in("iqc_status", ["ACCEPTED", "REJECTED"]);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch items pending store acceptance
  const { data: pendingStoreAcceptance = [] } = useQuery({
    queryKey: ["pending-store-acceptance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grn_items")
        .select(`
          *,
          grn!inner(
            grn_number,
            vendors(name)
          ),
          raw_materials!inner(material_code, name)
        `)
        .eq("iqc_status", "ACCEPTED")
        .eq("store_confirmed", false);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Find the selected GRN and material details
  const selectedGRNDetails = pendingGRNs.find(grn => grn.id === selectedGRN);
  const selectedMaterialDetails = selectedGRNDetails?.grn_items?.find((item: any) => item.id === selectedMaterial);
  const selectedInspectionDetails = pendingStoreAcceptance.find(item => item.id === selectedInspection);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Submit inspection mutation
  const submitInspectionMutation = useMutation({
    mutationFn: async ({
      grnItemId,
      status,
      remarks,
      approvedQuantity,
      rejectedQuantity
    }: {
      grnItemId: string;
      status: string;
      remarks: string;
      approvedQuantity: number;
      rejectedQuantity: number;
    }) => {
      const { error } = await supabase
        .from("grn_items")
        .update({
          iqc_status: status.toUpperCase(),
          accepted_quantity: approvedQuantity,
          rejected_quantity: rejectedQuantity,
          iqc_approved_by: (await supabase.auth.getUser()).data.user?.id,
          iqc_approved_at: new Date().toISOString()
        })
        .eq("id", grnItemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-grns"] });
      queryClient.invalidateQueries({ queryKey: ["completed-inspections"] });
      queryClient.invalidateQueries({ queryKey: ["pending-store-acceptance"] });
      
      toast({
        title: "Inspection recorded",
        description: `Material has been marked as ${inspectionStatus}`,
      });

      // Reset form
      setSelectedGRN(null);
      setSelectedMaterial(null);
      setInspectionStatus("");
      setRemarks("");
      setSelectedFile(null);
    },
    onError: (error) => {
      console.error("Error submitting inspection:", error);
      toast({
        title: "Error",
        description: "Failed to submit inspection",
        variant: "destructive",
      });
    },
  });

  // Store acceptance mutation
  const storeAcceptanceMutation = useMutation({
    mutationFn: async ({
      grnItemId,
      quantity,
      rawMaterialId
    }: {
      grnItemId: string;
      quantity: number;
      rawMaterialId: string;
    }) => {
      // Update GRN item to mark as store confirmed
      const { error: grnError } = await supabase
        .from("grn_items")
        .update({
          store_confirmed: true,
          store_confirmed_by: (await supabase.auth.getUser()).data.user?.id,
          store_confirmed_at: new Date().toISOString()
        })
        .eq("id", grnItemId);

      if (grnError) throw grnError;

      // Check if inventory record exists for this material
      const { data: existingInventory } = await supabase
        .from("inventory")
        .select("*")
        .eq("raw_material_id", rawMaterialId)
        .single();

      if (existingInventory) {
        // Update existing inventory
        const { error: inventoryError } = await supabase
          .from("inventory")
          .update({
            quantity: existingInventory.quantity + quantity,
            last_updated: new Date().toISOString()
          })
          .eq("raw_material_id", rawMaterialId);

        if (inventoryError) throw inventoryError;
      } else {
        // Create new inventory record
        const { error: inventoryError } = await supabase
          .from("inventory")
          .insert({
            raw_material_id: rawMaterialId,
            quantity: quantity,
            last_updated: new Date().toISOString()
          });

        if (inventoryError) throw inventoryError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-store-acceptance"] });
      
      toast({
        title: "Material accepted by store",
        description: `Material has been received in store and inventory updated`,
      });

      // Reset form
      setSelectedInspection(null);
      setReceivedQuantity("");
    },
    onError: (error) => {
      console.error("Error confirming store acceptance:", error);
      toast({
        title: "Error",
        description: "Failed to confirm store acceptance",
        variant: "destructive",
      });
    },
  });

  // Handle inspection submission
  const handleSubmitInspection = async () => {
    if (!selectedGRN || !selectedMaterial || !inspectionStatus) {
      toast({
        title: "Missing information",
        description: "Please select a GRN, material and inspection status",
        variant: "destructive",
      });
      return;
    }

    const approvedQuantity = inspectionStatus === "Accepted" ? selectedMaterialDetails?.received_quantity : 0;
    const rejectedQuantity = inspectionStatus === "Rejected" ? selectedMaterialDetails?.received_quantity : 0;

    submitInspectionMutation.mutate({
      grnItemId: selectedMaterial,
      status: inspectionStatus,
      remarks: remarks,
      approvedQuantity: approvedQuantity || 0,
      rejectedQuantity: rejectedQuantity || 0
    });
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

    const qty = parseInt(receivedQuantity);
    
    if (qty <= 0 || qty > (selectedInspectionDetails?.accepted_quantity || 0)) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid quantity within accepted limits",
        variant: "destructive",
      });
      return;
    }

    storeAcceptanceMutation.mutate({
      grnItemId: selectedInspection,
      quantity: qty,
      rawMaterialId: selectedInspectionDetails?.raw_material_id || ""
    });
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
                        disabled={submitInspectionMutation.isPending}
                      >
                        {submitInspectionMutation.isPending ? "Submitting..." : "Submit Inspection"}
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
                        <TableHead>Vendor</TableHead>
                        <TableHead>Accepted Qty</TableHead>
                        <TableHead>Rejected Qty</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedInspections.map((inspection: any) => (
                        <TableRow key={inspection.id}>
                          <TableCell>{new Date(inspection.iqc_approved_at || inspection.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{inspection.grn?.grn_number}</TableCell>
                          <TableCell className="font-mono">{inspection.raw_materials?.material_code}</TableCell>
                          <TableCell>{inspection.raw_materials?.name}</TableCell>
                          <TableCell>{inspection.grn?.vendors?.name}</TableCell>
                          <TableCell className="font-medium text-green-600">{inspection.accepted_quantity || 0}</TableCell>
                          <TableCell className="font-medium text-red-600">{inspection.rejected_quantity || 0}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                inspection.iqc_status === "ACCEPTED" ? "bg-green-100 text-green-800" :
                                inspection.iqc_status === "REJECTED" ? "bg-red-100 text-red-800" :
                                "bg-amber-100 text-amber-800"
                              }
                            >
                              {inspection.iqc_status}
                            </Badge>
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
                      {pendingStoreAcceptance.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No materials pending store acceptance
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead></TableHead>
                              <TableHead>GRN No</TableHead>
                              <TableHead>Part Code</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Vendor</TableHead>
                              <TableHead>Approved Qty</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pendingStoreAcceptance.map((item: any) => (
                              <TableRow key={item.id} className={selectedInspection === item.id ? "bg-accent" : ""}>
                                <TableCell>
                                  <input 
                                    type="radio" 
                                    name="inspection" 
                                    checked={selectedInspection === item.id}
                                    onChange={() => {
                                      setSelectedInspection(item.id);
                                      setReceivedQuantity(item.accepted_quantity?.toString() || "");
                                    }} 
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{item.grn?.grn_number}</TableCell>
                                <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                                <TableCell>{item.raw_materials?.name}</TableCell>
                                <TableCell>{item.grn?.vendors?.name}</TableCell>
                                <TableCell className="font-medium text-green-600">{item.accepted_quantity}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
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
                            <p><span className="font-medium">GRN: </span>{selectedInspectionDetails.grn?.grn_number}</p>
                            <p><span className="font-medium">Part Code: </span>{selectedInspectionDetails.raw_materials?.material_code}</p>
                            <p><span className="font-medium">Description: </span>{selectedInspectionDetails.raw_materials?.name}</p>
                            <p><span className="font-medium">Approved Qty: </span>{selectedInspectionDetails.accepted_quantity}</p>
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
                              max={selectedInspectionDetails.accepted_quantity}
                            />
                          </div>
                          
                          <Button 
                            className="w-full mt-4"
                            onClick={handleStoreAcceptance}
                            disabled={storeAcceptanceMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {storeAcceptanceMutation.isPending ? "Processing..." : "Confirm Receipt"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
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
