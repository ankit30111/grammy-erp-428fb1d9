import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ExternalLink, CheckCircle, XCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CAPAApproval {
  id: string;
  capa_category: string;
  reference_id: string;
  part_or_process: string;
  capa_document_url: string | null;
  status: string;
  submitted_at: string | null;
  submitted_by: string | null;
  remarks: string | null;
  vendor_name: string | null;
  created_at: string;
}

const CAPAApprovalsTab = () => {
  const [capaApprovals, setCAPAApprovals] = useState<CAPAApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCapa, setSelectedCapa] = useState<CAPAApproval | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [remarks, setRemarks] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchCAPAApprovals();
  }, []);

  const fetchCAPAApprovals = async () => {
    try {
      const { data, error } = await supabase
        .from('capa_approvals_view')
        .select('*')
        .eq('status', 'RECEIVED')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCAPAApprovals(data || []);
    } catch (error) {
      console.error('Error fetching CAPA approvals:', error);
      toast({
        title: "Error",
        description: "Failed to fetch CAPA approvals",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedCapa || !actionType) return;

    try {
      const newStatus = actionType === 'approve' ? 'APPROVED' : 'AWAITED';
      let updateData: any = {};

      // Update the appropriate table based on CAPA category
      if (selectedCapa.capa_category === 'VENDOR') {
        updateData = {
          capa_status: newStatus,
          approved_at: actionType === 'approve' ? new Date().toISOString() : null,
          approved_by: actionType === 'approve' ? (await supabase.auth.getUser()).data.user?.id : null,
          rejection_reason: actionType === 'reject' ? remarks : null,
          // Clear document URL if rejected to allow re-upload
          capa_document_url: actionType === 'reject' ? null : undefined
        };
        
        const { error } = await supabase
          .from('iqc_vendor_capa')
          .update(updateData)
          .eq('id', selectedCapa.id);
        
        if (error) throw error;
      } else if (selectedCapa.capa_category === 'PRODUCTION') {
        updateData = {
          capa_status: newStatus,
          approved_at: actionType === 'approve' ? new Date().toISOString() : null,
          approved_by: actionType === 'approve' ? (await supabase.auth.getUser()).data.user?.id : null,
          rejection_reason: actionType === 'reject' ? remarks : null,
          // Clear document URL if rejected to allow re-upload
          capa_document_url: actionType === 'reject' ? null : undefined
        };
        
        const { error } = await supabase
          .from('production_capa')
          .update(updateData)
          .eq('id', selectedCapa.id);
        
        if (error) throw error;
      } else if (selectedCapa.capa_category === 'LINE_REJECTION') {
        updateData = {
          approval_status: newStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
          approved_at: actionType === 'approve' ? new Date().toISOString() : null,
          approved_by: actionType === 'approve' ? (await supabase.auth.getUser()).data.user?.id : null,
          rejection_reason: actionType === 'reject' ? remarks : null,
          // Clear document URL if rejected to allow re-upload
          rca_file_url: actionType === 'reject' ? null : undefined
        };
        
        const { error } = await supabase
          .from('rca_reports')
          .update(updateData)
          .eq('id', selectedCapa.id);
        
        if (error) throw error;
      } else if (selectedCapa.capa_category === 'PART_ANALYSIS') {
        updateData = {
          status: actionType === 'approve' ? 'CLOSED' : 'PENDING',
          closed_at: actionType === 'approve' ? new Date().toISOString() : null,
          closed_by: actionType === 'approve' ? (await supabase.auth.getUser()).data.user?.id : null,
          remarks: remarks,
          // Clear document URL if rejected to allow re-upload
          capa_document_url: actionType === 'reject' ? null : undefined
        };
        
        const { error } = await supabase
          .from('customer_complaint_parts')
          .update(updateData)
          .eq('id', selectedCapa.id);
        
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `CAPA ${actionType === 'approve' ? 'approved' : 'rejected'} successfully${actionType === 'reject' ? '. Document can be re-uploaded.' : ''}`
      });

      setSelectedCapa(null);
      setActionType(null);
      setRemarks("");
      fetchCAPAApprovals();
    } catch (error) {
      console.error('Error updating CAPA:', error);
      toast({
        title: "Error",
        description: "Failed to update CAPA status",
        variant: "destructive"
      });
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'VENDOR': return 'bg-blue-100 text-blue-800';
      case 'PRODUCTION': return 'bg-green-100 text-green-800';
      case 'LINE_REJECTION': return 'bg-red-100 text-red-800';
      case 'PART_ANALYSIS': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED': return 'bg-blue-100 text-blue-800';
      case 'PENDING': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="p-4">Loading CAPA approvals...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          CAPA Approvals
        </CardTitle>
      </CardHeader>
      <CardContent>
        {capaApprovals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4" />
            <p>No CAPAs awaiting approval</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Part/Process</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capaApprovals.map((capa) => (
                <TableRow key={capa.id}>
                  <TableCell>
                    <Badge className={getCategoryColor(capa.capa_category)}>
                      {capa.capa_category.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{capa.part_or_process}</TableCell>
                  <TableCell>{capa.vendor_name || '-'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(capa.status)}>
                      Under Review
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {capa.submitted_at ? new Date(capa.submitted_at).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    {capa.capa_document_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(
                          `https://oacdhvmpkuadlyvvvbpq.supabase.co/storage/v1/object/public/capa-documents/${capa.capa_document_url}`, 
                          '_blank'
                        )}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCapa(capa);
                              setActionType('approve');
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Approve CAPA</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p>Are you sure you want to approve this CAPA for <strong>{capa.part_or_process}</strong>?</p>
                            <div className="space-y-2">
                              <Label htmlFor="approval-remarks">Approval Remarks (Optional)</Label>
                              <Textarea
                                id="approval-remarks"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Add any approval remarks..."
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setSelectedCapa(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleAction}>
                                Approve CAPA
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedCapa(capa);
                              setActionType('reject');
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reject CAPA</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p>Are you sure you want to reject this CAPA for <strong>{capa.part_or_process}</strong>?</p>
                            <div className="bg-yellow-50 p-3 rounded-lg">
                              <p className="text-sm text-yellow-800">
                                <strong>Note:</strong> Rejecting this CAPA will allow the document to be re-uploaded for review.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                              <Textarea
                                id="rejection-reason"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Please provide reason for rejection..."
                                required
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setSelectedCapa(null)}>
                                Cancel
                              </Button>
                              <Button 
                                variant="destructive" 
                                onClick={handleAction}
                                disabled={!remarks.trim()}
                              >
                                Reject CAPA
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default CAPAApprovalsTab;
