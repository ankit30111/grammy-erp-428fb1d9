
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, CheckCircle, Clock, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CAPATracking {
  id: string;
  capa_number: string;
  /** `source` on the unified `capa` table replaced the old per-table category. */
  capa_category: string;
  part_or_process: string;
  vendor_name: string | null;
  approved_at: string | null;
  /** capa.status — ACCEPTED while being implemented, CLOSED once done. */
  implementation_status: string;
  implementation_deadline: string | null;
}

const CAPATrackingTab = () => {
  const [capaTracking, setCAPATracking] = useState<CAPATracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCapa, setSelectedCapa] = useState<CAPATracking | null>(null);
  const [implementationStatus, setImplementationStatus] = useState("");
  const [deadline, setDeadline] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchCAPATracking();
  }, []);

  const fetchCAPATracking = async () => {
    try {
      // capa_approvals_view is gone — approved CAPAs are `capa` rows with
      // status ACCEPTED (the old APPROVED).
      const { data, error } = await supabase
        .from('capa')
        .select(`
          id,
          capa_number,
          source,
          status,
          due_date,
          updated_at,
          parts (name, part_code),
          vendors (name)
        `)
        .in('status', ['ACCEPTED', 'CLOSED'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setCAPATracking(
        (data || []).map((row: any) => ({
          id: row.id,
          capa_number: row.capa_number,
          capa_category: row.source || 'UNKNOWN',
          part_or_process: row.parts?.name || row.parts?.part_code || row.capa_number,
          vendor_name: row.vendors?.name ?? null,
          approved_at: row.updated_at,
          implementation_status: row.status,
          implementation_deadline: row.due_date,
        }))
      );
    } catch (error) {
      console.error('Error fetching CAPA tracking:', error);
      toast({
        title: "Error",
        description: "Failed to fetch CAPA tracking data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateImplementation = async () => {
    if (!selectedCapa) return;

    try {
      // One `capa` table now — and the only implementation fields that survived
      // the rebuild are status and due_date.
      const updateData: Record<string, unknown> = {
        status: implementationStatus,
        due_date: deadline || null,
      };

      if (implementationStatus === 'CLOSED') {
        updateData.closed_at = new Date().toISOString();
        updateData.closed_by = (await supabase.auth.getUser()).data.user?.id ?? null;
      }

      const { error } = await supabase
        .from('capa')
        .update(updateData)
        .eq('id', selectedCapa.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "CAPA implementation status updated successfully"
      });

      setSelectedCapa(null);
      setImplementationStatus("");
      setDeadline("");
      fetchCAPATracking();
    } catch (error) {
      console.error('Error updating CAPA implementation:', error);
      toast({
        title: "Error",
        description: "Failed to update CAPA implementation status",
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

  const getImplementationStatusColor = (status: string) => {
    switch (status) {
      case 'CLOSED': return 'bg-success-wash text-success';
      case 'ACCEPTED': return 'bg-accent text-primary';
      case 'OPEN': return 'bg-destructive-wash text-destructive';
      default: return 'bg-muted text-foreground';
    }
  };

  const getImplementationIcon = (status: string) => {
    switch (status) {
      case 'CLOSED': return <CheckCircle className="h-4 w-4" />;
      case 'ACCEPTED': return <Clock className="h-4 w-4" />;
      case 'OPEN': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // capa_implementation_checks has no replacement table after the rebuild, so
  // there is no IQC compliance data to show. Say so rather than render zeroes.
  const renderComplianceIndicator = (_capaId: string) => (
    <span className="text-xs text-muted-foreground">
      Not available after rebuild
    </span>
  );

  if (loading) {
    return <div className="p-4">Loading CAPA tracking...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          CAPA Implementation Tracking
        </CardTitle>
      </CardHeader>
      <CardContent>
        {capaTracking.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4" />
            <p>No approved CAPAs to track</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Part/Process</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Approved Date</TableHead>
                <TableHead>Implementation Status</TableHead>
                <TableHead>IQC Compliance</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capaTracking.map((capa) => (
                <TableRow key={capa.id}>
                  <TableCell>
                    <Badge className={getCategoryColor(capa.capa_category)}>
                      {capa.capa_category.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{capa.part_or_process}</TableCell>
                  <TableCell>{capa.vendor_name || '-'}</TableCell>
                  <TableCell>
                    {capa.approved_at ? new Date(capa.approved_at).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={getImplementationStatusColor(capa.implementation_status)}>
                      {getImplementationIcon(capa.implementation_status)}
                      <span className="ml-1">{capa.implementation_status.replace('_', ' ')}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {renderComplianceIndicator(capa.id)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {capa.implementation_deadline ? new Date(capa.implementation_deadline).toLocaleDateString() : 'Not set'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCapa(capa);
                            setImplementationStatus(capa.implementation_status);
                            setDeadline(capa.implementation_deadline || "");
                          }}
                        >
                          Update Status
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Update Implementation Status</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="implementation-status">Implementation Status</Label>
                              <Select value={implementationStatus} onValueChange={setImplementationStatus}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="OPEN">Pending</SelectItem>
                                  <SelectItem value="ACCEPTED">In Progress</SelectItem>
                                  <SelectItem value="CLOSED">Implemented</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="deadline">Implementation Deadline</Label>
                              <Input
                                id="deadline"
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>IQC Compliance Summary</Label>
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-xs text-muted-foreground">
                                Not available after the rebuild — the CAPA
                                implementation-check table was removed, and
                                assignee / free-text implementation remarks no
                                longer have a column to live in.
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setSelectedCapa(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleUpdateImplementation}>
                              Update Status
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
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

export default CAPATrackingTab;
