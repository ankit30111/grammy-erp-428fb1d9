import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDashCustomerDocuments, useDashCustomerDocumentMutations } from "@/hooks/useDashCustomers";
import { Upload, FileText, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { SignedStorageLink } from "@/components/ui/signed-storage-link";

const documentTypes = ["GST Certificate", "MSME Certificate", "Cancelled Cheque", "PAN Card", "Other"];

interface Props {
  form: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
  customerId?: string;
}

export function CustomerDocumentsTab({ form, onChange, customerId }: Props) {
  const { data: documents } = useDashCustomerDocuments(customerId);
  const { addDocument, deleteDocument } = useDashCustomerDocumentMutations();
  const [uploading, setUploading] = useState<string | null>(null);

  const handleUpload = async (docType: string, file: File) => {
    if (!customerId) {
      toast.error("Save the customer first before uploading documents");
      return;
    }
    setUploading(docType);
    try {
      const filePath = `customers/${customerId}/${docType.replace(/\s+/g, '_')}_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("dash-documents").upload(filePath, file);
      if (uploadError) throw uploadError;

      // Store the raw bucket path. Bucket is being flipped to private (003f);
      // readers use SignedStorageLink to mint short-lived signed URLs.
      await addDocument.mutateAsync({
        customer_id: customerId,
        document_type: docType,
        file_name: file.name,
        file_url: filePath,
      });

      // Also update the URL field on the customer record
      if (docType === "GST Certificate") onChange({ gst_certificate_url: filePath });
      else if (docType === "MSME Certificate") onChange({ msme_certificate_url: filePath });
      else if (docType === "Cancelled Cheque") onChange({ cancelled_cheque_url: filePath });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(null);
    }
  };

  const docsForType = (type: string) => documents?.filter((d: any) => d.document_type === type) || [];

  return (
    <div className="space-y-6">
      {/* KYC fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>GST Number</Label>
          <Input value={form.gst_number || ""} onChange={(e) => onChange({ gst_number: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>PAN Number</Label>
          <Input value={form.pan_number || ""} onChange={(e) => onChange({ pan_number: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>MSME Number</Label>
          <Input value={form.msme_number || ""} onChange={(e) => onChange({ msme_number: e.target.value })} />
        </div>
      </div>

      {/* Bank details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Bank Name</Label>
          <Input value={form.bank_name || ""} onChange={(e) => onChange({ bank_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Account Number</Label>
          <Input value={form.bank_account_number || ""} onChange={(e) => onChange({ bank_account_number: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>IFSC Code</Label>
          <Input value={form.bank_ifsc || ""} onChange={(e) => onChange({ bank_ifsc: e.target.value })} />
        </div>
      </div>

      {/* Document uploads */}
      {customerId && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Document Uploads</h3>
          {documentTypes.map((docType) => {
            const docs = docsForType(docType);
            return (
              <Card key={docType}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{docType}</CardTitle>
                    <div>
                      <Label htmlFor={`upload-${docType}`} className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild disabled={uploading === docType}>
                          <span><Upload className="h-3 w-3 mr-1" />{uploading === docType ? "Uploading..." : "Upload"}</span>
                        </Button>
                      </Label>
                      <input
                        id={`upload-${docType}`}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(docType, file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                </CardHeader>
                {docs.length > 0 && (
                  <CardContent className="py-2 px-4">
                    <div className="space-y-2">
                      {docs.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between text-sm border rounded p-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">{doc.file_name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <SignedStorageLink
                              bucket="dash-documents"
                              path={doc.file_url}
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </SignedStorageLink>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deleteDocument.mutate({ id: doc.id, customerId })}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {!customerId && (
        <p className="text-sm text-muted-foreground">Save the customer first to upload documents.</p>
      )}
    </div>
  );
}
