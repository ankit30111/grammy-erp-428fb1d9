
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const ProductionFeedback = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch material requests (discrepancies)
  const { data: materialRequests = [] } = useQuery({
    queryKey: ["material-discrepancies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_requests")
        .select(`
          *,
          production_orders!inner(voucher_number),
          raw_materials!inner(material_code, name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Close discrepancy mutation
  const closeDiscrepancyMutation = useMutation({
    mutationFn: async (discrepancyId: string) => {
      const { error } = await supabase
        .from("material_requests")
        .update({ 
          status: 'RESOLVED',
          approved_by: 'store-user', // Replace with actual user ID when auth is implemented
          approved_quantity: 0
        })
        .eq("id", discrepancyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-discrepancies"] });
      toast({
        title: "Discrepancy Closed",
        description: "Material discrepancy has been marked as resolved",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to close discrepancy",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'destructive';
      case 'RESOLVED': return 'default';
      default: return 'secondary';
    }
  };

  const parseDiscrepancyReason = (reason: string) => {
    // Parse the reason field to extract structured data
    const match = reason.match(/Discrepancy: Sent (\d+), Received (\d+)\. Section: (.+)/);
    if (match) {
      return {
        quantitySent: parseInt(match[1]),
        quantityReceived: parseInt(match[2]),
        section: match[3],
        difference: parseInt(match[2]) - parseInt(match[1])
      };
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Production Feedback & Discrepancies ({materialRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {materialRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No material discrepancies found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Voucher Number</TableHead>
                <TableHead>Raw Material Code</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Quantity Sent</TableHead>
                <TableHead>Quantity Received</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialRequests.map((request) => {
                const discrepancyData = parseDiscrepancyReason(request.reason || '');
                
                return (
                  <TableRow key={request.id}>
                    <TableCell>{format(new Date(request.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{request.production_orders?.voucher_number}</TableCell>
                    <TableCell className="font-mono">{request.raw_materials?.material_code}</TableCell>
                    <TableCell>{request.raw_materials?.name}</TableCell>
                    <TableCell>{discrepancyData?.quantitySent || '-'}</TableCell>
                    <TableCell>{discrepancyData?.quantityReceived || '-'}</TableCell>
                    <TableCell className={discrepancyData?.difference && discrepancyData.difference !== 0 ? "text-red-600 font-medium" : ""}>
                      {discrepancyData?.difference ? (discrepancyData.difference > 0 ? `+${discrepancyData.difference}` : discrepancyData.difference) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{discrepancyData?.section || 'Unknown'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(request.status) as any} className="gap-1">
                        {request.status === 'PENDING' ? (
                          <>
                            <Clock className="h-3 w-3" />
                            Pending
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Resolved
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => closeDiscrepancyMutation.mutate(request.id)}
                          disabled={closeDiscrepancyMutation.isPending}
                        >
                          Close Discrepancy
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductionFeedback;
