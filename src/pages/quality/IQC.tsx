
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clock, FileCheck, Upload, X } from "lucide-react";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending GRNs - only those with RECEIVED status and items with PENDING IQC status
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
        .eq("status", "RECEIVED")
        .eq("grn_items.iqc_status", "PENDING");
      
      if (error) throw error;
      
      // Filter out GRNs that don't have any pending items
      const filteredData = data?.filter(grn => 
        grn.grn_items && grn.grn_items.some((item: any) => item.iqc_status === "PENDING")
      ) || [];
      
      return filteredData;
    },
  });

  // Fetch completed inspections - only items with ACCEPTED or REJECTED status
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
        .in("iqc_status", ["ACCEPTED", "REJECTED"])
        .not("iqc_status", "is", null);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Find the selected GRN and material details
  const selectedGRNDetails = pendingGRNs.find(grn => grn.id === selectedGRN);
  const selectedMaterialDetails = selectedGRNDetails?.grn_items?.find((item: any) => 
    item.id === selectedMaterial && item.iqc_status === "PENDING"
  );

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

      // If accepted, update inventory
      if (status.toUpperCase() === "ACCEPTED" && approvedQuantity > 0) {
        const grnItem = await supabase
          .from("grn_items")
          .select("raw_material_id")
          .eq("id", grnItemId)
          .single();

        if (grnItem.data) {
          const { data: existingInventory } = await supabase
            .from("inventory")
            .select("*")
            .eq("raw_material_id", grnItem.data.raw_material_id)
            .single();

          if (existingInventory) {
            await supabase
              .from("inventory")
              .update({
                quantity: existingInventory.quantity + approvedQuantity,
                last_updated: new Date().toISOString()
              })
              .eq("raw_material_id", grnItem.data.raw_material_id);
          } else {
            await supabase
              .from("inventory")
              .insert({
                raw_material_id: grnItem.data.raw_material_id,
                quantity: approvedQuantity,
                last_updated: new Date().toISOString()
              });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-grns"] });
      queryClient.invalidateQueries({ queryKey: ["completed-inspections"] });
      
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">Pending Inspection</TabsTrigger>
            <TabsTrigger value="completed">Completed Inspections</TabsTrigger>
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
                          <TableHead>Pending Items</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingGRNs.map((grn: any) => {
                          const pendingItems = grn.grn_items?.filter((item: any) => item.iqc_status === "PENDING") || [];
                          return (
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
                              <TableCell>{pendingItems.length}</TableCell>
                            </TableRow>
                          );
                        })}
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
                        {selectedGRNDetails.grn_items?.filter((item: any) => item.iqc_status === "PENDING").map((item: any) => (
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
