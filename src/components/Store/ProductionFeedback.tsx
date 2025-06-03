
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Clock, Package } from "lucide-react";
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

  // Fetch material returns from production
  const { data: materialReturns = [] } = useQuery({
    queryKey: ["material-returns"],
    queryFn: async () => {
      // In a real implementation, this would fetch from a material_returns table
      // For now, we'll simulate the data structure
      return [];
    },
  });

  // Close discrepancy mutation
  const closeDiscrepancyMutation = useMutation({
    mutationFn: async (discrepancyId: string) => {
      const { error } = await supabase
        .from("material_requests")
        .update({ 
          status: 'RESOLVED',
          approved_by: 'store-user',
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
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'destructive';
      case 'RESOLVED': return 'default';
      default: return 'secondary';
    }
  };

  const parseDiscrepancyReason = (reason: string) => {
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-6 w-6" />
        <h2 className="text-xl font-semibold">Production Feedback & Returns</h2>
      </div>

      <Tabs defaultValue="discrepancies" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="discrepancies">Material Discrepancies</TabsTrigger>
          <TabsTrigger value="returns">Material Returns from Production</TabsTrigger>
        </TabsList>

        <TabsContent value="discrepancies">
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
        </TabsContent>

        <TabsContent value="returns">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Material Returns from Production ({materialReturns.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {materialReturns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                  <p>No material returns from production</p>
                  <p className="text-sm mt-1">
                    When production is completed with shortfall, materials will appear here for verification
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Voucher Number</TableHead>
                      <TableHead>Material Code</TableHead>
                      <TableHead>Material Name</TableHead>
                      <TableHead>Return Quantity</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialReturns.map((returnItem: any) => (
                      <TableRow key={returnItem.id}>
                        <TableCell>{format(new Date(returnItem.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="font-medium">{returnItem.voucher_number}</TableCell>
                        <TableCell className="font-mono">{returnItem.material_code}</TableCell>
                        <TableCell>{returnItem.material_name}</TableCell>
                        <TableCell>{returnItem.return_quantity}</TableCell>
                        <TableCell>{returnItem.reason}</TableCell>
                        <TableCell>
                          <Badge variant={returnItem.verified ? "default" : "secondary"}>
                            {returnItem.verified ? "Verified" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {!returnItem.verified && (
                            <Button size="sm" variant="outline">
                              Verify & Add to Inventory
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionFeedback;
