import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface IQCReportViewerProps {
  reportUrl: string;
  itemId: string;
  materialName: string;
}

export const IQCReportViewer = ({ reportUrl, itemId, materialName }: IQCReportViewerProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleViewReport = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('iqc-reports')
        .createSignedUrl(reportUrl, 3600); // 1 hour expiry

      if (error) {
        throw error;
      }

      if (data.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing IQC report:', error);
      toast({
        title: "Error",
        description: "Failed to load IQC report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  if (!reportUrl) {
    return (
      <Button variant="outline" size="sm" disabled>
        <FileText className="h-3 w-3 mr-1" />
        No Report
      </Button>
    );
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleViewReport}
      disabled={isLoading}
      className="gap-1"
    >
      <ExternalLink className="h-3 w-3" />
      View
    </Button>
  );
};