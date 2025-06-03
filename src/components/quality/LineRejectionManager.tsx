
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileUp, Upload, CheckCircle, AlertTriangle } from "lucide-react";

const LineRejectionManager = () => {
  const [selectedRejection, setSelectedRejection] = useState<any>(null);
  const [showRCADialog, setShowRCADialog] = useState(false);
  const [showCAPADialog, setShowCAPADialog] = useState(false);
  const [receivedQuantity, setReceivedQuantity] = useState("");
  const [rcaFile, setRcaFile] = useState<File | null>(null);
  const [capaFile, setCAPAFile] = useState<File | null>(null);
  const [capaStatus, setCAPAStatus] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all line rejections
  const { data: lineRejections = [] } = useQuery({
    queryKey: ["all-line-rejections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("line_rejections")
        .select(`
          *,
          raw_materials!inner(material_code, name),
          production_orders!inner(voucher_number, products!inner(name))
        `)
        .order("rejection_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch RCA reports for rejections
  const { data: rcaReports = [] } = useQuery({
    queryKey: ["rca-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rca_reports")
        .select("*");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch vendor CAPA records
  const { data: vendorCAPAs = [] } = useQuery({
    queryKey: ["vendor-capas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_capa")
        .select(`
          *,
          vendors!inner(name)
        `);
      
      if (error) throw error;
      return data || [];
    },
  });

  const updateRCAMutation = useMutation({
    mutationFn: async ({ rejectionId, quantity, fileUrl }: any) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("rca_reports")
        .insert([{
          line_rejection_id: rejectionId,
          received_quantity: quantity,
          rca_file_url: fileUrl || "pending_upload",
          uploaded_by: user.data.user.id
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "RCA report uploaded successfully",
      });
      setShowRCADialog(false);
      setReceivedQuantity("");
      setRcaFile(null);
      queryClient.invalidateQueries({ queryKey: ["rca-reports"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload RCA report",
        variant: "destructive",
      });
    },
  });

  const createCAPAMutation = useMutation({
    mutationFn: async ({ rejectionId, fileUrl, vendorId }: any) => {
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
          vendor_id: materialVendor?.vendor_id || vendorId,
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
        description: "CAPA initiated successfully",
      });
      setShowCAPADialog(false);
      setCAPAFile(null);
      queryClient.invalidateQueries({ queryKey: ["vendor-capas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate CAPA",
        variant: "destructive",
      });
    },
  });

  const closeCAPAMutation = useMutation({
    mutationFn: async (capaId: string) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("vendor_capa")
        .update({
          status: "Closed",
          closed_by: user.data.user.id,
          closed_at: new Date().toISOString()
        })
        .eq("id", capaId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "CAPA marked as closed",
      });
      queryClient.invalidateQueries({ queryKey: ["vendor-capas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to close CAPA",
        variant: "destructive",
      });
    },
  });

  const handleRCAUpload = () => {
    if (!receivedQuantity || !rcaFile) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseInt(receivedQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    updateRCAMutation.mutate({
      rejectionId: selectedRejection.id,
      quantity,
      fileUrl: rcaFile.name // In real implementation, upload to storage first
    });
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

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'User Mishandling': return 'secondary';
      case 'Part Faulty': return 'destructive';
      default: return 'outline';
    }
  };

  const hasRCA = (rejectionId: string) => {
    return rcaReports.some(rca => rca.line_rejection_id === rejectionId);
  };

  const hasCAPAForRejection = (rejectionId: string) => {
    return vendorCAPAs.some(capa => capa.line_rejection_id === rejectionId);
  };

  const getCAPAForRejection = (rejectionId: string) => {
    return vendorCAPAs.find(capa => capa.line_rejection_id === rejectionId);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Line Rejections from Production
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lineRejections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No line rejections found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher Number</TableHead>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineRejections.map((rejection) => {
                  const hasRCAReport = hasRCA(rejection.id);
                  const capa = getCAPAForRejection(rejection.id);
                  const needsCAPAForFaultyPart = rejection.reason === 'Part Faulty' && hasRCAReport && !capa;
                  const canCloseCAPAForFaultyPart = rejection.reason === 'Part Faulty' && hasRCAReport && capa && capa.status === 'Open';

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
                      <TableCell>
                        <Badge variant={getReasonColor(rejection.reason) as any}>
                          {rejection.reason}
                        </Badge>
                      </TableCell>
                      <TableCell>{rejection.quantity_rejected}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {hasRCAReport ? (
                            <Badge variant="default" className="text-xs">RCA Done</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">RCA Pending</Badge>
                          )}
                          {rejection.reason === 'Part Faulty' && (
                            capa ? (
                              <Badge 
                                variant={capa.status === 'Closed' ? 'default' : 'destructive'} 
                                className="text-xs"
                              >
                                CAPA {capa.status}
                              </Badge>
                            ) : hasRCAReport ? (
                              <Badge variant="secondary" className="text-xs">CAPA Pending</Badge>
                            ) : null
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {!hasRCAReport && (
                            <Dialog open={showRCADialog && selectedRejection?.id === rejection.id} onOpenChange={setShowRCADialog}>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedRejection(rejection)}
                                >
                                  RCA
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Upload RCA Report</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="received-qty">Received Quantity</Label>
                                    <Input
                                      id="received-qty"
                                      type="number"
                                      value={receivedQuantity}
                                      onChange={(e) => setReceivedQuantity(e.target.value)}
                                      placeholder="Enter received quantity"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="rca-file">RCA Document</Label>
                                    <Input
                                      id="rca-file"
                                      type="file"
                                      onChange={(e) => setRcaFile(e.target.files?.[0] || null)}
                                    />
                                  </div>
                                  <Button onClick={handleRCAUpload} disabled={updateRCAMutation.isPending}>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload RCA
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}

                          {needsCAPAForFaultyPart && (
                            <Dialog open={showCAPADialog && selectedRejection?.id === rejection.id} onOpenChange={setShowCAPADialog}>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedRejection(rejection)}
                                >
                                  CAPA
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Initiate Vendor CAPA</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="capa-file">CAPA Document</Label>
                                    <Input
                                      id="capa-file"
                                      type="file"
                                      onChange={(e) => setCAPAFile(e.target.files?.[0] || null)}
                                    />
                                  </div>
                                  <Button onClick={handleCAPAUpload} disabled={createCAPAMutation.isPending}>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Initiate CAPA
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}

                          {canCloseCAPAForFaultyPart && (
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => closeCAPAMutation.mutate(capa.id)}
                              disabled={closeCAPAMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Close CAPA
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LineRejectionManager;
