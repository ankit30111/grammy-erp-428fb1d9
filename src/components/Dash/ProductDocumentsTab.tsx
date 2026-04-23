import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDashProductDocuments, useDashProductDocumentMutations } from "@/hooks/useDashProducts";
import { Upload, FileText, ExternalLink, Loader2 } from "lucide-react";
import { useRef } from "react";
import { format } from "date-fns";
import { SignedStorageLink } from "@/components/ui/signed-storage-link";

const DOCUMENT_TYPES = [
  { key: "user_manual", label: "User Manual / QSG" },
  { key: "service_manual", label: "Service Manual" },
  { key: "firmware", label: "Firmware" },
  { key: "box_design", label: "Box Design Artwork" },
  { key: "rating_label", label: "Rating Label" },
  { key: "mrp_label", label: "MRP Label Artwork" },
  { key: "bis_certificate", label: "BIS Certificate" },
  { key: "branding_guide", label: "Branding Guide" },
  { key: "product_images", label: "Product Images" },
  { key: "other", label: "Other" },
];

interface ProductDocumentsTabProps {
  productId: string | undefined;
}

export default function ProductDocumentsTab({ productId }: ProductDocumentsTabProps) {
  const { data: documents, isLoading } = useDashProductDocuments(productId);
  const { uploadDocument } = useDashProductDocumentMutations();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!productId) {
    return <p className="text-muted-foreground text-center py-8">Save the product first to upload documents.</p>;
  }

  const handleUpload = async (type: string, file: File) => {
    uploadDocument.mutate({ productId: productId!, documentType: type, file });
  };

  const getDocsForType = (typeKey: string) => {
    return documents?.filter((d: any) => d.document_type === typeKey || d.doc_type === typeKey) || [];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {DOCUMENT_TYPES.map(({ key, label }) => {
        const docs = getDocsForType(key);
        const currentDoc = docs.find((d: any) => d.is_current) || docs[0];

        return (
          <Card key={key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                {currentDoc && <Badge variant="outline">v{currentDoc.version}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentDoc ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate flex-1">{currentDoc.doc_name || currentDoc.file_name}</span>
                    <SignedStorageLink
                      bucket="dash-product-docs"
                      path={currentDoc.file_url}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </SignedStorageLink>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uploaded {format(new Date(currentDoc.created_at), "dd MMM yyyy")}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No document uploaded</p>
              )}

              <input
                type="file"
                className="hidden"
                ref={(el) => { fileRefs.current[key] = el; }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(key, file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileRefs.current[key]?.click()}
                disabled={uploadDocument.isPending}
              >
                {uploadDocument.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                {currentDoc ? "Replace" : "Upload"}
              </Button>

              {docs.length > 1 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Version history ({docs.length})</summary>
                  <div className="mt-1 space-y-1">
                    {docs.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between">
                        <span>v{d.version} — {d.doc_name || d.file_name}</span>
                        <SignedStorageLink
                          bucket="dash-product-docs"
                          path={d.file_url}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-primary"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </SignedStorageLink>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
