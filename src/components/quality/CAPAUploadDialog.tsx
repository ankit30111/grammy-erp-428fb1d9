
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CAPAUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  capaId: string;
  capaType: 'vendor' | 'production' | 'line_rejection' | 'part_analysis';
  itemDetails: {
    materialName?: string;
    vendorName?: string;
    grnNumber?: string;
    productionOrder?: string;
    complaintId?: string;
  };
}

const CAPAUploadDialog = ({ isOpen, onClose, capaId, capaType, itemDetails }: CAPAUploadDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadCAPADocument = useMutation({
    mutationFn: async ({ file, remarks }: { file: File; remarks: string }) => {
      // Upload file to Supabase Storage
      const fileName = `capa-${capaType}-${capaId}-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("capa-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Update the appropriate CAPA table based on type
      const updateData = {
        capa_document_url: fileName,
        capa_status: 'RECEIVED',
        received_at: new Date().toISOString(),
        remarks: remarks
      };

      let updateQuery;
      switch (capaType) {
        case 'vendor':
          updateQuery = supabase
            .from("iqc_vendor_capa")
            .update(updateData)
            .eq("id", capaId);
          break;
        case 'production':
          updateQuery = supabase
            .from("production_capa")
            .update(updateData)
            .eq("id", capaId);
          break;
        case 'line_rejection':
          updateQuery = supabase
            .from("rca_reports")
            .update({ 
              rca_file_url: fileName, 
              uploaded_by: null // Would be set from auth in real app
            })
            .eq("line_rejection_id", capaId);
          break;
        case 'part_analysis':
          updateQuery = supabase
            .from("customer_complaint_parts")
            .update({ 
              capa_document_url: fileName,
              status: 'CAPA_RECEIVED'
            })
            .eq("id", capaId);
          break;
        default:
          throw new Error("Invalid CAPA type");
      }

      const { error } = await updateQuery;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iqc-capas'] });
      queryClient.invalidateQueries({ queryKey: ['production-capas'] });
      queryClient.invalidateQueries({ queryKey: ['line-rejection-capas'] });
      queryClient.invalidateQueries({ queryKey: ['part-analysis-capas'] });
      queryClient.invalidateQueries({ queryKey: ['completed-iqc-items'] });
      
      toast({
        title: "CAPA Document Uploaded",
        description: "CAPA document has been uploaded successfully and status updated to RECEIVED",
      });
      
      setSelectedFile(null);
      setRemarks("");
      onClose();
    },
    onError: (error) => {
      console.error("Error uploading CAPA document:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload CAPA document",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadCAPADocument.mutate({ file: selectedFile, remarks });
    }
  };

  const getTitle = () => {
    switch (capaType) {
      case 'vendor':
        return `Upload Vendor CAPA - ${itemDetails.materialName}`;
      case 'production':
        return `Upload Production CAPA - ${itemDetails.productionOrder}`;
      case 'line_rejection':
        return `Upload RCA/CAPA - Line Rejection`;
      case 'part_analysis':
        return `Upload Analysis CAPA - Complaint #${itemDetails.complaintId}`;
      default:
        return "Upload CAPA Document";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {getTitle()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/20 p-3 rounded-md text-sm">
            {capaType === 'vendor' && (
              <>
                <div><strong>Material:</strong> {itemDetails.materialName}</div>
                <div><strong>Vendor:</strong> {itemDetails.vendorName}</div>
                <div><strong>GRN:</strong> {itemDetails.grnNumber}</div>
              </>
            )}
            {capaType === 'production' && (
              <div><strong>Production Order:</strong> {itemDetails.productionOrder}</div>
            )}
            {capaType === 'part_analysis' && (
              <div><strong>Complaint ID:</strong> {itemDetails.complaintId}</div>
            )}
          </div>
          
          <div>
            <Label>Upload CAPA Document</Label>
            <div className="flex items-center gap-2 mt-1">
              <div className="relative w-full">
                <Input
                  type="file"
                  id="capa-document"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.png,.doc,.docx"
                />
                <Input
                  readOnly
                  value={selectedFile?.name || ''}
                  placeholder="Select a file..."
                  onClick={() => document.getElementById('capa-document')?.click()}
                  className="cursor-pointer pr-10"
                />
                <Upload className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
          
          <div>
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter any additional remarks..."
              className="mt-1"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!selectedFile || uploadCAPADocument.isPending}
              className="gap-2"
            >
              {uploadCAPADocument.isPending ? "Uploading..." : "Upload CAPA"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CAPAUploadDialog;
