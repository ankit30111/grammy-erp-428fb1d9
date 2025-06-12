
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, XCircle, ArrowLeftRight, Package } from "lucide-react";
import { toast } from "sonner";

const MaterialRequestsTab = () => {
  const queryClient = useQueryClient();

  const { data: materialRequests = [], isLoading } = useQuery({
    queryKey: ["material-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_requests")
        .select(`
          *,
          raw_materials!inner(
            material_code,
            name
          ),
          production_orders!inner(
            voucher_number,
            products!inner(
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
  });

  const handleRequestMutation = useMutation({
    mutationFn: async ({ requestId, action, approvedQuantity }: {
      requestId: string;
      action: 'APPROVE' | 'REJECT';
      approvedQuantity?: number;
    }) => {
      const { error } = await supabase
        .from("material_requests")
        .update({ 
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          approved_quantity: action === 'APPROVE' ? approvedQuantity : 0,
          approved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      toast.success("Material request processed successfully");
    },
    onError: () => {
      toast.error("Failed to process material request");
    },
  });

  const handleApprove = (request: any) => {
    handleRequestMutation.mutate({
      requestId: request.id,
      action: 'APPROVE',
      approvedQuantity: request.requested_quantity
    });
  };

  const handleReject = (request: any) => {
    handleRequestMutation.mutate({
      requestId: request.id,
      action: 'REJECT'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'APPROVED':
        return <Badge variant="default">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Loading material requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Material Requests ({materialRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {materialRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowLeftRight className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>No material requests found</p>
              <p className="text-sm mt-1">Additional material requests from production will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher No.</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Requested Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {format(new Date(request.created_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-mono">
                      {request.production_orders?.voucher_number}
                    </TableCell>
                    <TableCell>
                      {request.production_orders?.products?.name}
                    </TableCell>
                    <TableCell className="font-mono">
                      {request.raw_materials?.material_code}
                    </TableCell>
                    <TableCell>
                      {request.raw_materials?.name}
                    </TableCell>
                    <TableCell>
                      {request.requested_quantity} units
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {request.reason || 'No reason provided'}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {request.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(request)}
                            className="gap-1"
                            disabled={handleRequestMutation.isPending}
                          >
                            <CheckCircle className="h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(request)}
                            className="gap-1"
                            disabled={handleRequestMutation.isPending}
                          >
                            <XCircle className="h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MaterialRequestsTab;
