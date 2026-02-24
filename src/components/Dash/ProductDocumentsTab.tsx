import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDashProductDocuments, useDashProductDocumentMutations } from "@/hooks/useDashProducts";
import { Upload, FileText, ExternalLink, Loader2 } from "lucide-react";
import { useRef } from "react";
import { format } from "date-fns";

const DOCUMENT_TYPES = [
  "QSG", "Box Design Artwork", "MRP Label Artwork",
  "BIS Documents", "Rating Label", "Product Images",
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

  const getDocsForType = (type: string) => {
    return documents?.filter((d: any) => d.document_type === type) || [];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {DOCUMENT_TYPES.map((type) => {
        const docs = getDocsForType(type);
        const currentDoc = docs.find((d: any) => d.is_current);

        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{type}</CardTitle>
                {currentDoc && <Badge variant="outline">v{currentDoc.version}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentDoc ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate flex-1">{currentDoc.file_name}</span>
                    <a href={currentDoc.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uploaded {format(new Date(currentDoc.created_at), "dd MMM yyyy")}
                    {currentDoc.uploaded_by && ` by ${currentDoc.uploaded_by}`}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No document uploaded</p>
              )}

              <input
                type="file"
                className="hidden"
                ref={(el) => { fileRefs.current[type] = el; }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(type, file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileRefs.current[type]?.click()}
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
                        <span>v{d.version} — {d.file_name}</span>
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                          <ExternalLink className="h-3 w-3" />
                        </a>
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
