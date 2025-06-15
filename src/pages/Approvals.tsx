
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import CAPAApprovals from "@/components/quality/CAPAApprovals";

const Approvals = () => {
  // Fetch pending approvals from approval_workflows table
  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_workflows")
        .select("*")
        .eq("status", "PENDING")
        .order("submitted_at", { ascending: true });
      
      if (error) {
        console.error("Error fetching pending approvals:", error);
        throw error;
      }
      
      return data || [];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'APPROVED':
        return <Badge variant="default">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getWorkflowTypeBadge = (type: string) => {
    switch (type) {
      case 'PURCHASE_ORDER':
        return <Badge variant="outline">Purchase Order</Badge>;
      case 'PRODUCTION_SCHEDULE':
        return <Badge variant="outline">Production Schedule</Badge>;
      case 'QUALITY_REPORT':
        return <Badge variant="outline">Quality Report</Badge>;
      case 'VENDOR_CAPA':
        return <Badge variant="outline">Vendor CAPA</Badge>;
      default:
        return <Badge variant="outline">{type.replace('_', ' ')}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Approvals Dashboard</h1>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {pendingApprovals.length} items pending approval
            </span>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General Approvals</TabsTrigger>
            <TabsTrigger value="capa">CAPA</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Pending Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingApprovals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No items pending approval
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workflow Type</TableHead>
                        <TableHead>Reference ID</TableHead>
                        <TableHead>Submitted By</TableHead>
                        <TableHead>Submitted Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingApprovals.map((approval) => (
                        <TableRow key={approval.id}>
                          <TableCell>
                            {getWorkflowTypeBadge(approval.workflow_type)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {approval.reference_id.slice(-8).toUpperCase()}
                          </TableCell>
                          <TableCell>
                            {approval.submitted_by ? 'User' : 'System'}
                          </TableCell>
                          <TableCell>
                            {new Date(approval.submitted_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(approval.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive">
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
          </TabsContent>

          <TabsContent value="capa">
            <CAPAApprovals />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Approvals;
