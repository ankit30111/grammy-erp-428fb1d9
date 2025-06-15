
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Eye, FileText } from "lucide-react";

const CAPAApprovals = () => {
  const [selectedCapa, setSelectedCapa] = useState<any>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch CAPAs pending approval
  const { data: pendingCapas = [] } = useQuery({
    queryKey: ["pending-capa-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iqc_vendor_capa")
        .select(`
          *,
          grn_items!inner(
            raw_materials!inner(material_code, name),
            grn!inner(
              grn_number,
              purchase_orders!inner(po_number)
            )
          ),
          vendors!inner(name, vendor_code)
        `)
        .eq("capa_status", "RECEIVED")
        .order("received_at", { ascending: true });
      
      if (error) {
        console.error("Error fetching pending CAPA approvals:", error);
        throw error;
      }
      
      return data || [];
    },
  });

  // Approve or reject CAPA
  const approveMutation = useMutation({
    mutationFn: async ({ capaId, action, remarks }: { capaId: string; action: 'APPROVE' | 'REJECT'; remarks: string }) => {
      const updateData = {
        capa_status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approved_by: null, // Would be set from auth in real app
        approved_at: new Date().toISOString(),
        rejection_reason: action === 'REJECT' ? remarks : null,
        remarks: remarks
      };

      const { error } = await supabase
        .from("iqc_vendor_capa")
        .update(updateData)
        .eq("id", capaId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pending-capa-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["iqc-vendor-capas"] });
      toast({
        title: `CAPA ${variables.action === 'APPROVE' ? 'Approved' : 'Rejected'}`,
        description: `The CAPA has been ${variables.action.toLowerCase()} successfully`,
      });
      setShowApprovalDialog(false);
      setApprovalRemarks("");
      setSelectedCapa(null);
    },
    onError: (error: any) => {
      toast({
        title: "Action Failed",
        description: error.message || "Failed to process CAPA approval",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AWAITED':
        return <Badge variant="secondary">Awaited</Badge>;
      case 'RECEIVED':
        return <Badge variant="outline">Pending Approval</Badge>;
      case 'APPROVED':
        return <Badge variant="default">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleApprovalAction = (capa: any, action: 'APPROVE' | 'REJECT') => {
    setSelectedCapa(capa);
    setApprovalAction(action);
    setShowApprovalDialog(true);
  };

  const handleSubmitApproval = () => {
    if (!selectedCapa) return;
    
    approveMutation.mutate({
      capaId: selectedCapa.id,
      action: approvalAction,
      remarks: approvalRemarks
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CAPA Approvals ({pendingCapas.length} pending)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingCapas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No CAPAs pending approval
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CAPA ID</TableHead>
                  <TableHead>GRN Number</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Initiated Date</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCapas.map((capa) => (
                  <TableRow key={capa.id}>
                    <TableCell className="font-medium">
                      IQC-CAPA-{capa.id.slice(-6).toUpperCase()}
                    </TableCell>
                    <TableCell className="text-blue-600">
                      {capa.grn_items?.grn?.grn_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-mono text-sm">
                          {capa.grn_items?.raw_materials?.material_code}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {capa.grn_items?.raw_materials?.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {capa.vendors?.name}
                    </TableCell>
                    <TableCell>
                      {new Date(capa.initiated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {capa.received_at ? new Date(capa.received_at).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(capa.capa_status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {capa.capa_document_url && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(
                              `https://oacdhvmpkuadlyvvvbpq.supabase.co/storage/v1/object/public/capa-documents/${capa.capa_document_url}`,
                              '_blank'
                            )}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          onClick={() => handleApprovalAction(capa, 'APPROVE')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleApprovalAction(capa, 'REJECT')}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'APPROVE' ? 'Approve CAPA' : 'Reject CAPA'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCapa && (
            <div className="space-y-4">
              <div className="bg-muted/20 p-3 rounded text-sm">
                <div><strong>CAPA ID:</strong> IQC-CAPA-{selectedCapa.id.slice(-6).toUpperCase()}</div>
                <div><strong>Material:</strong> {selectedCapa.grn_items?.raw_materials?.material_code}</div>
                <div><strong>Vendor:</strong> {selectedCapa.vendors?.name}</div>
                <div><strong>GRN:</strong> {selectedCapa.grn_items?.grn?.grn_number}</div>
              </div>
              
              <div>
                <Label>
                  {approvalAction === 'APPROVE' ? 'Approval Remarks' : 'Rejection Reason'}
                </Label>
                <Textarea
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder={
                    approvalAction === 'APPROVE' 
                      ? "Enter approval remarks..."
                      : "Enter reason for rejection..."
                  }
                  className="mt-1"
                  required={approvalAction === 'REJECT'}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowApprovalDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitApproval}
                  disabled={approveMutation.isPending || (approvalAction === 'REJECT' && !approvalRemarks.trim())}
                  className={approvalAction === 'APPROVE' ? "bg-green-600 hover:bg-green-700" : ""}
                  variant={approvalAction === 'REJECT' ? "destructive" : "default"}
                >
                  {approveMutation.isPending ? "Processing..." : approvalAction === 'APPROVE' ? 'Approve CAPA' : 'Reject CAPA'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CAPAApprovals;
