
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, FileText } from "lucide-react";

interface ApprovalWorkflowManagerProps {
  workflowType?: string;
}

const ApprovalWorkflowManager = ({ workflowType }: ApprovalWorkflowManagerProps) => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState("");
  const [reviewComments, setReviewComments] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch approval workflows
  const { data: workflows = [] } = useQuery({
    queryKey: ["approval-workflows", workflowType],
    queryFn: async () => {
      let query = supabase
        .from("approval_workflows")
        .select("*")
        .order("submitted_at", { ascending: false });
      
      if (workflowType) {
        query = query.eq("workflow_type", workflowType);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Review workflow mutation
  const reviewWorkflowMutation = useMutation({
    mutationFn: async ({ workflowId, status, comments }: any) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("approval_workflows")
        .update({
          status,
          reviewed_by: user.data.user.id,
          reviewed_at: new Date().toISOString(),
          comments
        })
        .eq("id", workflowId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Workflow reviewed successfully",
      });
      setShowReviewDialog(false);
      setReviewAction("");
      setReviewComments("");
      queryClient.invalidateQueries({ queryKey: ["approval-workflows"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to review workflow",
        variant: "destructive",
      });
    },
  });

  const handleReviewAction = () => {
    if (!reviewAction || !reviewComments.trim()) {
      toast({
        title: "Validation Error",
        description: "Please select an action and provide comments",
        variant: "destructive",
      });
      return;
    }

    reviewWorkflowMutation.mutate({
      workflowId: selectedWorkflow.id,
      status: reviewAction,
      comments: reviewComments
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'secondary';
      case 'APPROVED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  const getWorkflowTypeIcon = (type: string) => {
    switch (type) {
      case 'VENDOR_CAPA': return <FileText className="h-4 w-4" />;
      case 'RCA_REPORT': return <FileText className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Approval Workflows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submitted Date</TableHead>
                <TableHead>Workflow Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Reviewed By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell>
                    {new Date(workflow.submitted_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getWorkflowTypeIcon(workflow.workflow_type)}
                      {workflow.workflow_type.replace('_', ' ')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(workflow.status) as any}>
                      {workflow.status}
                    </Badge>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    {workflow.reviewed_at ? 
                      new Date(workflow.reviewed_at).toLocaleDateString() : 
                      "-"
                    }
                  </TableCell>
                  <TableCell>
                    {workflow.status === "PENDING" && (
                      <Dialog open={showReviewDialog && selectedWorkflow?.id === workflow.id} onOpenChange={setShowReviewDialog}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedWorkflow(workflow)}
                          >
                            Review
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Review Workflow</DialogTitle>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div className="bg-muted p-4 rounded">
                              <div className="text-sm space-y-2">
                                <div><strong>Type:</strong> {workflow.workflow_type}</div>
                                <div><strong>Submitted:</strong> {new Date(workflow.submitted_at).toLocaleDateString()}</div>
                                <div><strong>Reference ID:</strong> {workflow.reference_id}</div>
                              </div>
                            </div>
                            
                            <div>
                              <Label>Review Action</Label>
                              <Select value={reviewAction} onValueChange={setReviewAction}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select action" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="APPROVED">Approve</SelectItem>
                                  <SelectItem value="REJECTED">Reject</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label>Review Comments</Label>
                              <Textarea
                                value={reviewComments}
                                onChange={(e) => setReviewComments(e.target.value)}
                                placeholder="Enter review comments..."
                                rows={4}
                              />
                            </div>
                            
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                onClick={() => setShowReviewDialog(false)}
                              >
                                Cancel
                              </Button>
                              <Button 
                                onClick={handleReviewAction}
                                disabled={reviewWorkflowMutation.isPending}
                              >
                                {reviewAction === "APPROVED" ? (
                                  <><CheckCircle className="h-4 w-4 mr-2" /> Approve</>
                                ) : (
                                  <><XCircle className="h-4 w-4 mr-2" /> Reject</>
                                )}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {workflows.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No approval workflows found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovalWorkflowManager;
