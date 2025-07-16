
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Download, Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductDocumentsViewProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentUpdate?: () => void;
}

export function ProductDocumentsView({ product, open, onOpenChange, onDocumentUpdate }: ProductDocumentsViewProps) {
  const [uploadingStates, setUploadingStates] = useState<Record<string, boolean>>({});
  const [localProduct, setLocalProduct] = useState(product);
  const { toast } = useToast();
  
  const documents = [
    { key: 'bom_url', label: 'BOM Document' },
    { key: 'wi_url', label: 'Work Instruction (WI)' },
    { key: 'pqc_checklist_url', label: 'PQC Checklist' },
    { key: 'oqc_checklist_url', label: 'OQC Checklist' },
    { key: 'ccl_url', label: 'CCL Document' },
    { key: 'crs_url', label: 'CRS Document' },
  ];

  const handleDownload = async (fileName: string, label: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('product-documents')
        .download(fileName);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${localProduct.product_code}_${label}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Download failed",
        description: "Failed to download the document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (file: File, documentKey: string, label: string) => {
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file only.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive"
      });
      return;
    }

    setUploadingStates(prev => ({ ...prev, [documentKey]: true }));

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${localProduct.product_code}_${documentKey}_${Date.now()}.${fileExt}`;
      const filePath = `${localProduct.product_code}/${fileName}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('product-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Update the product record in the database
      const { error: updateError } = await supabase
        .from('products')
        .update({ [documentKey]: filePath })
        .eq('id', localProduct.id);

      if (updateError) throw updateError;

      // Update local state
      setLocalProduct(prev => ({ ...prev, [documentKey]: filePath }));

      toast({
        title: "Upload successful",
        description: `${label} has been uploaded successfully.`,
      });

      // Notify parent component of update
      onDocumentUpdate?.();

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload the document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploadingStates(prev => ({ ...prev, [documentKey]: false }));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, documentKey: string, label: string) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, documentKey, label);
    }
    // Reset the input
    event.target.value = '';
  };

  if (!localProduct) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Documents for {localProduct.name} ({localProduct.product_code})</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {documents.map(({ key, label }) => (
            <Card key={key}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <span className="font-medium">{label}</span>
                    {localProduct[key] && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {localProduct[key] ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDownload(localProduct[key], label)}
                        disabled={uploadingStates[key]}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not uploaded</span>
                    )}
                    
                    <div className="relative">
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileSelect(e, key, label)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploadingStates[key]}
                      />
                      <Button
                        variant={localProduct[key] ? "secondary" : "default"}
                        size="sm"
                        disabled={uploadingStates[key]}
                      >
                        {uploadingStates[key] ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploadingStates[key] ? "Uploading..." : (localProduct[key] ? "Replace" : "Upload")}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
