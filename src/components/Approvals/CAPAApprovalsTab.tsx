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
import { SignedStorageLink } from "@/components/ui/signed-storage-link";

interface CAPAApproval {
  id: string;
  capa_number: string;
  /** `source` on the unified `capa` table replaced the old per-table category. */
  capa_category: string;
  part_or_process: string;
  capa_document_url: string | null;
  status: string;
  submitted_at: string | null;
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
      // The six old CAPA tables (and capa_approvals_view) collapsed into `capa`.
      // Old status RECEIVED == awaiting approval == SUBMITTED.
      const { data, error } = await supabase
        .from('capa')
        .select(`
          id,
          capa_number,
          source,
          status,
          document_url,
          created_at,
          parts (name, part_code),
          vendors (name)
        `)
        .eq('status', 'SUBMITTED')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCAPAApprovals(
        (data || []).map((row: any) => ({
          id: row.id,
          capa_number: row.capa_number,
          capa_category: row.source || 'UNKNOWN',
          part_or_process: row.parts?.name || row.parts?.part_code || row.capa_number,
          capa_document_url: row.document_url,
          status: row.status,
          submitted_at: row.created_at,
          vendor_name: row.vendors?.name ?? null,
          created_at: row.created_at,
        }))
      );
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
      // One table now, so one update — the old per-category branches are gone.
      const updateData: Record<string, unknown> =
        actionType === 'approve'
          ? {
              status: 'ACCEPTED',
            }
          : {
              // Rejected CAPAs go back to OPEN so the document can be re-uploaded.
              status: 'OPEN',
              document_url: null,
            };

      const { error } = await supabase
        .from('capa')
        .update(updateData)
        .eq('id', selectedCapa.id);

      if (error) throw error;

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
      case 'VENDOR':
      case 'IQC': return 'bg-accent text-primary';
      case 'PRODUCTION': return 'bg-success-wash text-success';
      case 'LINE_REJECTION': return 'bg-destructive-wash text-destructive';
      case 'CUSTOMER':
      case 'PART_ANALYSIS': return 'bg-purple-100 text-purple-800';
      default: return 'bg-muted text-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'bg-accent text-primary';
      case 'OPEN': return 'bg-warning-wash text-warning';
      default: return 'bg-muted text-foreground';
    }
  };

  if (loading) {
    return <div className="p-4">Loading CAPA approvals...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
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
                      <SignedStorageLink
                        bucket="capa-documents"
                        path={capa.capa_document_url}
                        variant="ghost"
                        size="sm"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </SignedStorageLink>
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
                            <div className="bg-warning-wash p-3 rounded-lg">
                              <p className="text-sm text-warning">
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
