import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ComplaintStatusTimeline } from "./ComplaintStatusTimeline";
import { PartAnalysisCard } from "./PartAnalysisCard";
import { FileText, ExternalLink, Clock, User } from "lucide-react";

interface ComplaintStatusDialogProps {
  complaint: any;
  isOpen: boolean;
  onClose: () => void;
}

export const ComplaintStatusDialog = ({ complaint, isOpen, onClose }: ComplaintStatusDialogProps) => {
  // Early return if complaint is null
  if (!complaint) {
    return null;
  }

  // Fetch complaint parts and their analysis status
  const { data: complaintParts = [] } = useQuery({
    queryKey: ["complaint-parts", complaint?.id],
    queryFn: async () => {
      if (!complaint?.id) return [];
      
      const { data, error } = await supabase
        .from("customer_complaint_parts")
        .select(`
          *,
          raw_materials(name, material_code),
          profiles:sent_to_iqc_by(full_name),
          analyzed_profiles:analyzed_by(full_name),
          closed_profiles:closed_by(full_name)
        `)
        .eq("complaint_id", complaint.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!complaint?.id && isOpen,
  });

  // Calculate overall status based on parts
  const calculateOverallStatus = () => {
    if (complaintParts.length === 0) return "Open";
    
    const allClosed = complaintParts.every(part => part.status === "CLOSED");
    if (allClosed) return "Closed";
    
    const hasAnalysis = complaintParts.some(part => part.status === "UNDER_ANALYSIS");
    if (hasAnalysis) return "IQC Analysis";
    
    const hasCapaRequired = complaintParts.some(part => 
      part.status === "ANALYZED" && (part.rca_document_url || part.capa_document_url)
    );
    if (hasCapaRequired) return "CAPA Required";
    
    const hasCapa = complaintParts.some(part => part.capa_document_url);
    if (hasCapa) return "CAPA Implemented";
    
    return "Open";
  };

  // Calculate progress percentage
  const calculateProgress = () => {
    if (complaintParts.length === 0) return 0;
    const closedParts = complaintParts.filter(part => part.status === "CLOSED").length;
    return Math.round((closedParts / complaintParts.length) * 100);
  };

  const overallStatus = calculateOverallStatus();
  const progressPercentage = calculateProgress();

  // Days in current stage
  const getDaysInStage = () => {
    const createdDate = new Date(complaint.created_at);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - createdDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Complaint Status - {complaint.complaint_number}</span>
            <Badge variant={overallStatus === "Closed" ? "default" : "secondary"}>
              {overallStatus}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progress Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ComplaintStatusTimeline 
                currentStatus={overallStatus} 
                progressPercentage={progressPercentage} 
              />
              
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{getDaysInStage()} days</div>
                    <div className="text-xs text-muted-foreground">in current stage</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{complaint.customers?.name}</div>
                    <div className="text-xs text-muted-foreground">Customer</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{complaint.brand_name}</div>
                    <div className="text-xs text-muted-foreground">Brand</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Complaint Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Complaint Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Date Received</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(complaint.complaint_date), 'MMM dd, yyyy')}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Bill Number</div>
                  <div className="text-sm text-muted-foreground">{complaint.bill_number}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm font-medium">Complaint Reason</div>
                  <div className="text-sm text-muted-foreground">{complaint.complaint_reason}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parts Analysis */}
          {complaintParts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parts Analysis Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {complaintParts.map((part) => (
                    <PartAnalysisCard key={part.id} part={part} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No parts sent to IQC yet */}
          {complaintParts.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No Parts Sent to IQC</p>
                  <p className="text-sm">This complaint hasn't been processed yet</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {complaint.status !== 'IQC_COMPLETED' && complaintParts.length === 0 && (
              <Button variant="default">
                Process Complaint
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};