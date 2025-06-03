
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const LineRejectionManager = () => {
  const [selectedRejection, setSelectedRejection] = useState<any>(null);
  const [receivedQuantity, setReceivedQuantity] = useState("");
  const [rcaFile, setRcaFile] = useState<File | null>(null);
  const [vendorCapaFile, setVendorCapaFile] = useState<File | null>(null);
  const [showRCADialog, setShowRCADialog] = useState(false);
  const [showCapaDialog, setShowCapaDialog] = useState(false);
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
          production_orders!inner(voucher_number, products!inner(name)),
          rca_reports(*),
          vendor_capa(*)
        `)
        .order("rejection_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Create RCA Report mutation
  const createRCAMutation = useMutation({
    mutationFn: async ({ rejectionId, data }: { rejectionId: string; data: any }) => {
      const { data: result, error } = await supabase
        .from("rca_reports")
        .insert([{
          line_rejection_id: rejectionId,
          received_quantity: parseInt(data.receivedQuantity),
          rca_file_url: data.rcaFileUrl || null,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "RCA report created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["all-line-rejections"] });
      setShowRCADialog(false);
      setReceivedQuantity("");
      setRcaFile(null);
    },
  });

  // Create Vendor CAPA mutation
  const createVendorCapaMutation = useMutation({
    mutationFn: async ({ rejectionId, vendorId, capaFileUrl }: any) => {
      const { data, error } = await supabase
        .from("vendor_capa")
        .insert([{
          line_rejection_id: rejectionId,
          vendor_id: vendorId,
          capa_file_url: capaFileUrl || null,
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
      queryClient.invalidateQueries({ queryKey: ["all-line-rejections"] });
      setShowCapaDialog(false);
      setVendorCapaFile(null);
    },
  });

  // Close CAPA mutation
  const closeCapaMutation = useMutation({
    mutationFn: async (capaId: string) => {
      const { data, error } = await supabase
        .from("vendor_capa")
        .update({
          status: "Closed",
          closed_at: new Date().toISOString(),
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
      queryClient.invalidateQueries({ queryKey: ["all-line-rejections"] });
    },
  });

  const handleCreateRCA = async () => {
    if (!selectedRejection || !receivedQuantity) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const data = {
      receivedQuantity,
      rcaFileUrl: rcaFile ? `temp_url_for_${rcaFile.name}` : null,
    };

    createRCAMutation.mutate({ rejectionId: selectedRejection.id, data });
  };

  const handleInitiateCapa = async () => {
    if (!selectedRejection) return;

    // In a real implementation, you'd need to determine the vendor ID
    // For now, using a placeholder
    const vendorId = "placeholder-vendor-id";
    const capaFileUrl = vendorCapaFile ? `temp_url_for_${vendorCapaFile.name}` : null;

    createVendorCapaMutation.mutate({
      rejectionId: selectedRejection.id,
      vendorId,
      capaFileUrl,
    });
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'User Mishandling': return 'secondary';
      case 'Part Faulty': return 'destructive';
      default: return 'outline';
    }
  };

  const getCapaStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'destructive';
      case 'Closed': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Line Rejections - IQC Management</CardTitle>
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
                  <TableHead>Voucher</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>RCA Status</TableHead>
                  <TableHead>CAPA Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineRejections.map((rejection) => (
                  <TableRow key={rejection.id}>
                    <TableCell>
                      {new Date(rejection.rejection_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {rejection.production_orders.voucher_number}
                    </TableCell>
                    <TableCell>
                      {rejection.production_orders.products.name}
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
                      {rejection.rca_reports.length > 0 ? (
                        <Badge variant="default">Completed</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {rejection.vendor_capa.length > 0 ? (
                        <Badge variant={getCapaStatusColor(rejection.vendor_capa[0].status) as any}>
                          {rejection.vendor_capa[0].status}
                        </Badge>
                      ) : rejection.reason === 'Part Faulty' ? (
                        <Badge variant="secondary">Not Initiated</Badge>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {rejection.rca_reports.length === 0 && (
                          <Dialog open={showRCADialog} onOpenChange={setShowRCADialog}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedRejection(rejection)}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                RCA
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Create RCA Report</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="received-quantity">Received Quantity</Label>
                                  <Input
                                    id="received-quantity"
                                    type="number"
                                    value={receivedQuantity}
                                    onChange={(e) => setReceivedQuantity(e.target.value)}
                                    placeholder="Enter received quantity"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="rca-file">RCA Report PDF</Label>
                                  <Input
                                    id="rca-file"
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => setRcaFile(e.target.files?.[0] || null)}
                                  />
                                </div>
                                <Button onClick={handleCreateRCA} className="w-full">
                                  <Upload className="h-4 w-4 mr-2" />
                                  Create RCA Report
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        {rejection.reason === 'Part Faulty' && rejection.vendor_capa.length === 0 && (
                          <Dialog open={showCapaDialog} onOpenChange={setShowCapaDialog}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedRejection(rejection)}
                              >
                                Initiate CAPA
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Initiate Vendor CAPA</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="capa-file">Vendor CAPA Document</Label>
                                  <Input
                                    id="capa-file"
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => setVendorCapaFile(e.target.files?.[0] || null)}
                                  />
                                </div>
                                <Button onClick={handleInitiateCapa} className="w-full">
                                  <Upload className="h-4 w-4 mr-2" />
                                  Initiate CAPA
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        {rejection.vendor_capa.length > 0 && rejection.vendor_capa[0].status === 'Open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => closeCapaMutation.mutate(rejection.vendor_capa[0].id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Close CAPA
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
    </div>
  );
};

export default LineRejectionManager;
