
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProductDocumentsViewProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDocumentsView({ product, open, onOpenChange }: ProductDocumentsViewProps) {
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
      a.download = `${product.product_code}_${label}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Documents for {product.name} ({product.product_code})</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {documents.map(({ key, label }) => (
            <Card key={key}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <span className="font-medium">{label}</span>
                  </div>
                  {product[key] ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownload(product[key], label)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-sm">Not uploaded</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
