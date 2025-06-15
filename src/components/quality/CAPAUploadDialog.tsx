
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CAPAUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  capaId: string;
  capaType: 'vendor' | 'production' | 'line_rejection' | 'part_analysis';
  itemDetails: any;
  onUploadSuccess?: (capaId: string, capaType: string) => void;
}

const CAPAUploadDialog = ({ 
  isOpen, 
  onClose, 
  capaId, 
  capaType, 
  itemDetails,
  onUploadSuccess 
}: CAPAUploadDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!allowedTypes.includes(fileExtension)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload PDF, DOC, DOCX, XLS, or XLSX files only",
          variant: "destructive"
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload files smaller than 10MB",
          variant: "destructive"
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !capaId) return;

    setUploading(true);
    try {
      // Generate unique filename
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `${capaType}_${capaId}_${Date.now()}.${fileExtension}`;

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('capa-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Update the appropriate CAPA table with document URL and remarks
      let updateQuery;
      const updateData: any = {
        capa_document_url: fileName,
        remarks: remarks || null
      };

      switch (capaType) {
        case 'vendor':
          updateQuery = supabase
            .from('iqc_vendor_capa')
            .update(updateData)
            .eq('id', capaId);
          break;
        case 'production':
          updateQuery = supabase
            .from('production_capa')
            .update(updateData)
            .eq('id', capaId);
          break;
        case 'line_rejection':
          updateQuery = supabase
            .from('rca_reports')
            .update({
              rca_file_url: fileName,
              remarks: remarks || null
            })
            .eq('line_rejection_id', capaId);
          break;
        case 'part_analysis':
          updateQuery = supabase
            .from('customer_complaint_parts')
            .update({
              capa_document_url: fileName,
              remarks: remarks || null
            })
            .eq('id', capaId);
          break;
        default:
          throw new Error('Invalid CAPA type');
      }

      const { error: updateError } = await updateQuery;
      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "CAPA document uploaded successfully"
      });

      // Call the success callback if provided
      if (onUploadSuccess) {
        onUploadSuccess(capaId, capaType);
      }

      // Reset form and close dialog
      setSelectedFile(null);
      setRemarks("");
      onClose();

    } catch (error) {
      console.error('Error uploading CAPA:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload CAPA document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setRemarks("");
    onClose();
  };

  const getDialogTitle = () => {
    switch (capaType) {
      case 'vendor':
        return 'Upload Vendor CAPA Document';
      case 'production':
        return 'Upload Production CAPA Document';
      case 'line_rejection':
        return 'Upload RCA Document';
      case 'part_analysis':
        return 'Upload Part Analysis CAPA';
      default:
        return 'Upload CAPA Document';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Item details */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-1">
            {itemDetails.materialName && (
              <div className="text-sm">
                <span className="font-medium">Material:</span> {itemDetails.materialName}
              </div>
            )}
            {itemDetails.vendorName && (
              <div className="text-sm">
                <span className="font-medium">Vendor:</span> {itemDetails.vendorName}
              </div>
            )}
            {itemDetails.grnNumber && (
              <div className="text-sm">
                <span className="font-medium">GRN:</span> {itemDetails.grnNumber}
              </div>
            )}
            {itemDetails.productionOrder && (
              <div className="text-sm">
                <span className="font-medium">Production Order:</span> {itemDetails.productionOrder}
              </div>
            )}
            {itemDetails.complaintId && (
              <div className="text-sm">
                <span className="font-medium">Complaint ID:</span> {itemDetails.complaintId}
              </div>
            )}
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <Label htmlFor="capa-file">
              {capaType === 'line_rejection' ? 'RCA Document' : 'CAPA Document'} *
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <div className="text-sm text-gray-600 mb-2">
                    Click to upload or drag and drop
                  </div>
                  <div className="text-xs text-gray-500">
                    PDF, DOC, DOCX, XLS, XLSX (max 10MB)
                  </div>
                  <Input
                    id="capa-file"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="capa-file"
                    className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700"
                  >
                    Choose File
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks (Optional)</Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any additional remarks or comments..."
              rows={3}
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CAPAUploadDialog;
