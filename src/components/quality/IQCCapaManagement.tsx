
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Eye, Calendar } from "lucide-react";

const IQCCapaManagement = () => {
  const [selectedCapa, setSelectedCapa] = useState<any>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [capaDocument, setCapaDocument] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch IQC-related CAPAs
  const { data: iqcCapas = [] } = useQuery({
    queryKey: ["iqc-vendor-capas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iqc_vendor_capa")
        .select(`
          *,
          grn_items!inner(
            raw_materials!inner(material_code, name),
            grn!inner(
              grn_number,
              purchase_orders!inner(po_number)
            )
          ),
          vendors!inner(name, vendor_code)
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching IQC CAPAs:", error);
        throw error;
      }
      
      return data || [];
    },
  });

  // Upload CAPA document
  const uploadCapaMutation = useMutation({
    mutationFn: async ({ capaId, file, remarks }: { capaId: string; file: File; remarks: string }) => {
      // Upload file to storage
      const fileName = `capa-document-${capaId}-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("capa-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Update CAPA record
      const { error: updateError } = await supabase
        .from("iqc_vendor_capa")
        .update({
          capa_status: 'RECEIVED',
          capa_document_url: fileName,
          received_at: new Date().toISOString(),
          remarks: remarks
        })
        .eq("id", capaId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iqc-vendor-capas"] });
      toast({
        title: "CAPA Document Uploaded",
        description: "The CAPA document has been uploaded successfully",
      });
      setShowUploadDialog(false);
      setCapaDocument(null);
      setRemarks("");
      setSelectedCapa(null);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload CAPA document",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AWAITED':
        return <Badge variant="secondary">Awaited</Badge>;
      case 'RECEIVED':
        return <Badge variant="outline">Received</Badge>;
      case 'APPROVED':
        return <Badge variant="default">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleUploadDocument = (capa: any) => {
    setSelectedCapa(capa);
    setShowUploadDialog(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCapaDocument(file);
    }
  };

  const handleSubmitDocument = () => {
    if (!selectedCapa || !capaDocument) return;
    
    uploadCapaMutation.mutate({
      capaId: selectedCapa.id,
      file: capaDocument,
      remarks
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            IQC Related CAPAs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {iqcCapas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No IQC-related CAPAs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN Number</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Initiated Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {iqcCapas.map((capa) => (
                  <TableRow key={capa.id}>
                    <TableCell className="font-medium">
                      {capa.grn_items?.grn?.grn_number}
                    </TableCell>
                    <TableCell className="text-blue-600">
                      {capa.grn_items?.grn?.purchase_orders?.po_number}
                    </TableCell>
                    <TableCell className="font-mono">
                      {capa.grn_items?.raw_materials?.material_code}
                    </TableCell>
                    <TableCell>
                      {capa.grn_items?.raw_materials?.name}
                    </TableCell>
                    <TableCell>
                      {capa.vendors?.name}
                    </TableCell>
                    <TableCell>
                      {new Date(capa.initiated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(capa.capa_status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {capa.capa_status === 'AWAITED' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleUploadDocument(capa)}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload CAPA
                          </Button>
                        )}
                        {capa.capa_document_url && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(
                              `https://oacdhvmpkuadlyvvvbpq.supabase.co/storage/v1/object/public/capa-documents/${capa.capa_document_url}`,
                              '_blank'
                            )}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View Document
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

      {/* Upload CAPA Document Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload CAPA Document</DialogTitle>
          </DialogHeader>
          
          {selectedCapa && (
            <div className="space-y-4">
              <div className="bg-muted/20 p-3 rounded text-sm">
                <div><strong>Material:</strong> {selectedCapa.grn_items?.raw_materials?.material_code}</div>
                <div><strong>GRN:</strong> {selectedCapa.grn_items?.grn?.grn_number}</div>
                <div><strong>Vendor:</strong> {selectedCapa.vendors?.name}</div>
              </div>
              
              <div>
                <Label>CAPA Document (PDF)</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks about the CAPA..."
                  className="mt-1"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowUploadDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitDocument}
                  disabled={!capaDocument || uploadCapaMutation.isPending}
                >
                  {uploadCapaMutation.isPending ? "Uploading..." : "Upload Document"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IQCCapaManagement;
