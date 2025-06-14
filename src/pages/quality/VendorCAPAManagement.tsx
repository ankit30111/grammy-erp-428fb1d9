
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { FileText, Upload, CheckCircle, XCircle, AlertTriangle, Calendar } from "lucide-react";

const VendorCAPAManagement = () => {
  const [selectedRejection, setSelectedRejection] = useState<any>(null);
  const [showCAPADialog, setShowCAPADialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedCAPAId, setSelectedCAPAId] = useState<string>("");
  const [capaFile, setCAPAFile] = useState<File | null>(null);
  const [comments, setComments] = useState("");
  const [approvalAction, setApprovalAction] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch line rejections that need vendor CAPA
  const { data: lineRejections = [] } = useQuery({
    queryKey: ["line-rejections-for-capa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("line_rejections")
        .select(`
          *,
          raw_materials!inner(material_code, name),
          production_orders!inner(voucher_number, products!inner(name)),
          rca_reports(id, rca_file_url, received_quantity)
        `)
        .eq("reason", "Part Faulty")
        .order("rejection_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch vendor CAPAs
  const { data: vendorCAPAs = [] } = useQuery({
    queryKey: ["vendor-capas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_capa")
        .select(`
          *,
          vendors!inner(name, contact_person_name, email),
          line_rejections!inner(
            reason,
            quantity_rejected,
            rejection_date,
            raw_materials!inner(material_code, name),
            production_orders!inner(voucher_number)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch approval workflows
  const { data: approvalWorkflows = [] } = useQuery({
    queryKey: ["approval-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_workflows")
        .select("*")
        .order("submitted_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Create vendor CAPA mutation
  const createCAPAMutation = useMutation({
    mutationFn: async ({ rejectionId, fileUrl }: any) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      // Get vendor from raw material
      const rejection = lineRejections.find(r => r.id === rejectionId);
      if (!rejection) throw new Error("Rejection not found");

      const { data: materialVendor } = await supabase
        .from("raw_material_vendors")
        .select("vendor_id")
        .eq("raw_material_id", rejection.raw_material_id)
        .eq("is_primary", true)
        .single();

      const { data, error } = await supabase
        .from("vendor_capa")
        .insert([{
          line_rejection_id: rejectionId,
          vendor_id: materialVendor?.vendor_id,
          capa_file_url: fileUrl || "pending_upload",
          initiated_by: user.data.user.id,
          status: "Open"
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Vendor CAPA initiated successfully",
      });
      setShowCAPADialog(false);
      setCAPAFile(null);
      queryClient.invalidateQueries({ queryKey: ["vendor-capas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate vendor CAPA",
        variant: "destructive",
      });
    },
  });

  // Update CAPA status mutation
  const updateCAPAStatusMutation = useMutation({
    mutationFn: async ({ capaId, status, comments }: any) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("vendor_capa")
        .update({
          status,
          approved_by: user.data.user.id,
          approved_at: new Date().toISOString()
        })
        .eq("id", capaId)
        .select()
        .single();
      
      if (error) throw error;

      // Create approval workflow record
      await supabase
        .from("approval_workflows")
        .insert([{
          workflow_type: "VENDOR_CAPA",
          reference_id: capaId,
          status: status === "Closed" ? "APPROVED" : "REJECTED",
          reviewed_by: user.data.user.id,
          comments
        }]);

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "CAPA status updated successfully",
      });
      setShowApprovalDialog(false);
      setComments("");
      queryClient.invalidateQueries({ queryKey: ["vendor-capas"] });
      queryClient.invalidateQueries({ queryKey: ["approval-workflows"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update CAPA status",
        variant: "destructive",
      });
    },
  });

  const handleInitiateCAPAClick = (rejection: any) => {
    setSelectedRejection(rejection);
    setShowCAPADialog(true);
  };

  const handleCAPAUpload = () => {
    if (!capaFile) {
      toast({
        title: "Validation Error",
        description: "Please select a CAPA file",
        variant: "destructive",
      });
      return;
    }

    createCAPAMutation.mutate({
      rejectionId: selectedRejection.id,
      fileUrl: capaFile.name // In real implementation, upload to storage first
    });
  };

  const handleApprovalAction = () => {
    if (!approvalAction || !comments.trim()) {
      toast({
        title: "Validation Error",
        description: "Please select an action and provide comments",
        variant: "destructive",
      });
      return;
    }

    updateCAPAStatusMutation.mutate({
      capaId: selectedCAPAId,
      status: approvalAction === "approve" ? "Closed" : "Rejected",
      comments
    });
  };

  const hasRCA = (rejectionId: string) => {
    const rejection = lineRejections.find(r => r.id === rejectionId);
    return rejection?.rca_reports && rejection.rca_reports.length > 0;
  };

  const hasCAPAForRejection = (rejectionId: string) => {
    return vendorCAPAs.some(capa => capa.line_rejection_id === rejectionId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'destructive';
      case 'Closed': return 'default';
      case 'Rejected': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Vendor CAPA Management</h1>
        </div>

        <Tabs defaultValue="line-rejections">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="line-rejections">Line Rejections</TabsTrigger>
            <TabsTrigger value="vendor-capas">Vendor CAPAs</TabsTrigger>
            <TabsTrigger value="approvals">Approval Workflows</TabsTrigger>
          </TabsList>

          <TabsContent value="line-rejections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Part Faulty Rejections Requiring Vendor CAPA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Voucher Number</TableHead>
                      <TableHead>Part Code</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>RCA Status</TableHead>
                      <TableHead>CAPA Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineRejections.map((rejection) => {
                      const hasRCAReport = hasRCA(rejection.id);
                      const hasCAPA = hasCAPAForRejection(rejection.id);
                      
                      return (
                        <TableRow key={rejection.id}>
                          <TableCell>
                            {new Date(rejection.rejection_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {rejection.production_orders?.voucher_number}
                          </TableCell>
                          <TableCell>
                            {rejection.raw_materials.material_code}
                          </TableCell>
                          <TableCell>{rejection.quantity_rejected}</TableCell>
                          <TableCell>
                            <Badge variant={hasRCAReport ? "default" : "secondary"}>
                              {hasRCAReport ? "RCA Done" : "RCA Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={hasCAPA ? "default" : "secondary"}>
                              {hasCAPA ? "CAPA Initiated" : "CAPA Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {hasRCAReport && !hasCAPA && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleInitiateCAPAClick(rejection)}
                              >
                                Initiate CAPA
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendor-capas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Vendor CAPA Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Initiated Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Part Code</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorCAPAs.map((capa) => (
                      <TableRow key={capa.id}>
                        <TableCell>
                          {new Date(capa.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{capa.vendors?.name}</TableCell>
                        <TableCell>
                          {capa.line_rejections?.raw_materials?.material_code}
                        </TableCell>
                        <TableCell>
                          {capa.line_rejections?.production_orders?.voucher_number}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(capa.status) as any}>
                            {capa.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{capa.vendors?.contact_person_name}</div>
                            <div className="text-muted-foreground">{capa.vendors?.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {capa.status === "Open" && (
                            <Dialog open={showApprovalDialog && selectedCAPAId === capa.id} onOpenChange={setShowApprovalDialog}>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedCAPAId(capa.id)}
                                >
                                  Review CAPA
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Review Vendor CAPA</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="bg-muted p-4 rounded">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div><strong>Vendor:</strong> {capa.vendors?.name}</div>
                                      <div><strong>Part:</strong> {capa.line_rejections?.raw_materials?.material_code}</div>
                                      <div><strong>Initiated:</strong> {new Date(capa.created_at).toLocaleDateString()}</div>
                                      <div><strong>Status:</strong> {capa.status}</div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <Label>Approval Action</Label>
                                    <Select value={approvalAction} onValueChange={setApprovalAction}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select action" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="approve">Approve & Close CAPA</SelectItem>
                                        <SelectItem value="reject">Reject CAPA</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div>
                                    <Label>Comments</Label>
                                    <Textarea
                                      value={comments}
                                      onChange={(e) => setComments(e.target.value)}
                                      placeholder="Enter review comments..."
                                      rows={4}
                                    />
                                  </div>
                                  
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      variant="outline" 
                                      onClick={() => setShowApprovalDialog(false)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      onClick={handleApprovalAction}
                                      disabled={updateCAPAStatusMutation.isPending}
                                    >
                                      {approvalAction === "approve" ? (
                                        <><CheckCircle className="h-4 w-4 mr-2" /> Approve</>
                                      ) : (
                                        <><XCircle className="h-4 w-4 mr-2" /> Reject</>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approvals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Approval Workflow History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Workflow Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Comments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalWorkflows.map((workflow) => (
                      <TableRow key={workflow.id}>
                        <TableCell>
                          {new Date(workflow.submitted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{workflow.workflow_type}</TableCell>
                        <TableCell>
                          <Badge variant={workflow.status === "APPROVED" ? "default" : "destructive"}>
                            {workflow.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {workflow.comments}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* CAPA Initiation Dialog */}
        <Dialog open={showCAPADialog} onOpenChange={setShowCAPADialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Initiate Vendor CAPA</DialogTitle>
            </DialogHeader>
            
            {selectedRejection && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>Part:</strong> {selectedRejection.raw_materials?.material_code}</div>
                    <div><strong>Quantity:</strong> {selectedRejection.quantity_rejected}</div>
                    <div><strong>Date:</strong> {new Date(selectedRejection.rejection_date).toLocaleDateString()}</div>
                    <div><strong>Voucher:</strong> {selectedRejection.production_orders?.voucher_number}</div>
                  </div>
                </div>
                
                <div>
                  <Label>CAPA Document</Label>
                  <Input
                    type="file"
                    onChange={(e) => setCAPAFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx"
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCAPADialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCAPAUpload} 
                    disabled={createCAPAMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Initiate CAPA
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default VendorCAPAManagement;
