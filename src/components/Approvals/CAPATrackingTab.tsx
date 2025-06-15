
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, CheckCircle, Clock, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CAPATracking {
  id: string;
  capa_category: string;
  reference_id: string;
  part_or_process: string;
  vendor_name: string | null;
  approved_at: string | null;
  approved_by: string | null;
  implementation_assigned_to: string | null;
  implementation_deadline: string | null;
  implementation_status: string;
  implementation_remarks: string | null;
  implementation_completed_at: string | null;
  implementation_completed_by: string | null;
}

const CAPATrackingTab = () => {
  const [capaTracking, setCAPATracking] = useState<CAPATracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCapa, setSelectedCapa] = useState<CAPATracking | null>(null);
  const [implementationStatus, setImplementationStatus] = useState("");
  const [implementationRemarks, setImplementationRemarks] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [deadline, setDeadline] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchCAPATracking();
  }, []);

  const fetchCAPATracking = async () => {
    try {
      const { data, error } = await supabase
        .from('capa_approvals_view')
        .select('*')
        .eq('status', 'APPROVED')
        .order('approved_at', { ascending: false });

      if (error) throw error;
      setCAPATracking(data || []);
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
      const updateData: any = {
        implementation_status: implementationStatus,
        implementation_remarks: implementationRemarks,
        implementation_assigned_to: assignedTo || null,
        implementation_deadline: deadline || null
      };

      if (implementationStatus === 'IMPLEMENTED') {
        updateData.implementation_completed_at = new Date().toISOString();
        updateData.implementation_completed_by = (await supabase.auth.getUser()).data.user?.id;
      }

      // Update the appropriate table based on CAPA category
      let tableName = '';
      if (selectedCapa.capa_category === 'VENDOR') {
        tableName = 'iqc_vendor_capa';
      } else if (selectedCapa.capa_category === 'PRODUCTION') {
        tableName = 'production_capa';
      }

      if (tableName) {
        const { error } = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', selectedCapa.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "CAPA implementation status updated successfully"
      });

      setSelectedCapa(null);
      setImplementationStatus("");
      setImplementationRemarks("");
      setAssignedTo("");
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
      case 'VENDOR': return 'bg-blue-100 text-blue-800';
      case 'PRODUCTION': return 'bg-green-100 text-green-800';
      case 'LINE_REJECTION': return 'bg-red-100 text-red-800';
      case 'PART_ANALYSIS': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getImplementationStatusColor = (status: string) => {
    switch (status) {
      case 'IMPLEMENTED': return 'bg-green-100 text-green-800';
      case 'PARTIALLY_IMPLEMENTED': return 'bg-yellow-100 text-yellow-800';
      case 'PENDING': return 'bg-red-100 text-red-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getImplementationIcon = (status: string) => {
    switch (status) {
      case 'IMPLEMENTED': return <CheckCircle className="h-4 w-4" />;
      case 'IN_PROGRESS': return <Clock className="h-4 w-4" />;
      case 'PENDING': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <div className="p-4">Loading CAPA tracking...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
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
                <TableHead>Deadline</TableHead>
                <TableHead>Assigned To</TableHead>
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
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {capa.implementation_deadline ? new Date(capa.implementation_deadline).toLocaleDateString() : 'Not set'}
                    </div>
                  </TableCell>
                  <TableCell>{capa.implementation_assigned_to || 'Unassigned'}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCapa(capa);
                            setImplementationStatus(capa.implementation_status);
                            setImplementationRemarks(capa.implementation_remarks || "");
                            setAssignedTo(capa.implementation_assigned_to || "");
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
                                  <SelectItem value="PENDING">Pending</SelectItem>
                                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                  <SelectItem value="PARTIALLY_IMPLEMENTED">Partially Implemented</SelectItem>
                                  <SelectItem value="IMPLEMENTED">Implemented</SelectItem>
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
                            <Label htmlFor="assigned-to">Assigned To</Label>
                            <Input
                              id="assigned-to"
                              value={assignedTo}
                              onChange={(e) => setAssignedTo(e.target.value)}
                              placeholder="Enter user ID or department"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="implementation-remarks">Implementation Remarks</Label>
                            <Textarea
                              id="implementation-remarks"
                              value={implementationRemarks}
                              onChange={(e) => setImplementationRemarks(e.target.value)}
                              placeholder="Add implementation notes, progress updates, or completion details..."
                              rows={4}
                            />
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
