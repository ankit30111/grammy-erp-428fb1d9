import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Download, 
  Clock, 
  User, 
  CheckCircle, 
  AlertCircle,
  Microscope
} from "lucide-react";
import { format } from "date-fns";

interface PartAnalysisCardProps {
  part: any;
}

export const PartAnalysisCard = ({ part }: PartAnalysisCardProps) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary">Pending</Badge>;
      case "UNDER_ANALYSIS":
        return <Badge variant="default">Under Analysis</Badge>;
      case "ANALYZED":
        return <Badge variant="outline">Analysis Complete</Badge>;
      case "CLOSED":
        return <Badge variant="default">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "UNDER_ANALYSIS":
        return <Microscope className="h-4 w-4 text-blue-500" />;
      case "ANALYZED":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "CLOSED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getDaysInStage = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            {getStatusIcon(part.status)}
            <span>{part.raw_materials?.material_code}</span>
            <span className="font-normal text-muted-foreground">
              - {part.raw_materials?.name}
            </span>
          </div>
          {getStatusBadge(part.status)}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Part Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium">Serial Number</div>
            <div className="text-muted-foreground">{part.serial_number || "Not assigned"}</div>
          </div>
          <div>
            <div className="font-medium">Reason</div>
            <div className="text-muted-foreground">{part.reason || "-"}</div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          {part.sent_to_iqc_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Sent to IQC</span>
              <span>•</span>
              <span>{format(new Date(part.sent_to_iqc_at), 'MMM dd, yyyy')}</span>
              {part.profiles?.full_name && (
                <>
                  <span>•</span>
                  <span>by {part.profiles.full_name}</span>
                </>
              )}
            </div>
          )}
          
          {part.analyzed_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span>Analysis Completed</span>
              <span>•</span>
              <span>{format(new Date(part.analyzed_at), 'MMM dd, yyyy')}</span>
              {part.analyzed_profiles?.full_name && (
                <>
                  <span>•</span>
                  <span>by {part.analyzed_profiles.full_name}</span>
                </>
              )}
            </div>
          )}
          
          {part.closed_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Closed</span>
              <span>•</span>
              <span>{format(new Date(part.closed_at), 'MMM dd, yyyy')}</span>
              {part.closed_profiles?.full_name && (
                <>
                  <span>•</span>
                  <span>by {part.closed_profiles.full_name}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Documents */}
        {(part.rca_document_url || part.capa_document_url) && (
          <div className="border-t pt-3">
            <div className="text-sm font-medium mb-2">Documents</div>
            <div className="flex gap-2">
              {part.rca_document_url && (
                <Button size="sm" variant="outline" className="gap-2">
                  <FileText className="h-3 w-3" />
                  RCA Document
                  <Download className="h-3 w-3" />
                </Button>
              )}
              {part.capa_document_url && (
                <Button size="sm" variant="outline" className="gap-2">
                  <FileText className="h-3 w-3" />
                  CAPA Document
                  <Download className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Remarks */}
        {part.remarks && (
          <div className="border-t pt-3">
            <div className="text-sm font-medium">Remarks</div>
            <div className="text-sm text-muted-foreground mt-1">{part.remarks}</div>
          </div>
        )}

        {/* Days in current stage */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {getDaysInStage(part.sent_to_iqc_at || part.created_at)} days in {part.status.toLowerCase().replace('_', ' ')} stage
          </span>
        </div>
      </CardContent>
    </Card>
  );
};