
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, XCircle, AlertTriangle, Package, RefreshCw, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface DiscrepancyItem {
  id: string;
  production_order_id: string;
  raw_material_id: string;
  quantity_received: number;
  sent_quantity: number;
  discrepancy_quantity: number;
  discrepancy_type: string;
  discrepancy_status: string;
  created_at: string;
  notes?: string;
  raw_materials: {
    material_code: string;
    name: string;
  };
  production_orders: {
    voucher_number: string;
    products: {
      name: string;
    };
  };
}

const EnhancedProductionFeedback = () => {
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<DiscrepancyItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [resolutionAction, setResolutionAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const queryClient = useQueryClient();

  // Fetch production material receipts with discrepancies
  const { data: discrepancies = [], isLoading, refetch } = useQuery({
    queryKey: ["production-discrepancies"],
    queryFn: async () => {
      console.log("🔍 Fetching production material receipt discrepancies...");
      
      const { data, error } = await supabase
        .from("production_material_receipts")
        .select(`
          id,
          production_order_id,
          raw_material_id,
          quantity_received,
          sent_quantity,
          discrepancy_quantity,
          discrepancy_type,
          discrepancy_status,
          created_at,
          notes,
          raw_materials!raw_material_id (
            material_code,
            name
          ),
          production_orders!production_order_id (
            voucher_number,
            products!product_id (
              name
            )
          )
        `)
        .eq("discrepancy_status", "PENDING")
        .not("discrepancy_quantity", "is", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching discrepancies:", error);
        throw error;
      }

      console.log("📋 Discrepancy items found:", data?.length || 0);
      return data || [];
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Mutation to resolve discrepancies
  const resolveDiscrepancyMutation = useMutation({
    mutationFn: async ({ 
      discrepancyId, 
      action, 
      notes 
    }: {
      discrepancyId: string;
      action: 'APPROVE' | 'REJECT';
      notes: string;
    }) => {
      console.log(`🔄 Resolving discrepancy ${action}:`, { discrepancyId, notes });

      // Call the database function to resolve the discrepancy
      const { data, error } = await supabase.rpc('resolve_production_receipt_discrepancy', {
        p_receipt_id: discrepancyId,
        p_action: action,
        p_resolved_by: (await supabase.auth.getUser()).data.user?.id,
        p_resolution_notes: notes
      });

      if (error) {
        console.error("❌ Error resolving discrepancy:", error);
        throw error;
      }

      console.log("✅ Discrepancy resolved successfully");
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-discrepancies"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      
      toast.success(
        variables.action === 'APPROVE' 
          ? "Discrepancy approved - inventory updated accordingly" 
          : "Discrepancy rejected - original quantities maintained"
      );
      
      setShowResolutionDialog(false);
      setSelectedDiscrepancy(null);
      setResolutionNotes("");
    },
    onError: (error) => {
      console.error("❌ Error resolving discrepancy:", error);
      toast.error("Failed to resolve discrepancy");
    },
  });

  const handleResolveDiscrepancy = (discrepancy: DiscrepancyItem, action: 'APPROVE' | 'REJECT') => {
    setSelectedDiscrepancy(discrepancy);
    setResolutionAction(action);
    setShowResolutionDialog(true);
  };

  const confirmResolution = () => {
    if (!selectedDiscrepancy) return;
    
    resolveDiscrepancyMutation.mutate({
      discrepancyId: selectedDiscrepancy.id,
      action: resolutionAction,
      notes: resolutionNotes
    });
  };

  const getDiscrepancyTypeBadge = (type: string) => {
    switch (type) {
      case 'SHORTAGE':
        return <Badge variant="destructive">Shortage</Badge>;
      case 'EXCESS':
        return <Badge variant="secondary">Excess</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending Review</Badge>;
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
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
          <p className="text-muted-foreground">Loading production discrepancies...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Production Material Discrepancies ({discrepancies.length})
            <Badge variant="outline">Quantity Mismatches</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="ml-auto gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {discrepancies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>No pending discrepancies</p>
              <p className="text-sm mt-1">
                Quantity mismatches between sent and received materials will appear here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher Number</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Qty Sent by Store</TableHead>
                    <TableHead>Qty Received by Production</TableHead>
                    <TableHead>Discrepancy</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discrepancies.map((discrepancy) => (
                    <TableRow key={discrepancy.id}>
                      <TableCell>
                        {format(new Date(discrepancy.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-mono">
                        {discrepancy.production_orders?.voucher_number}
                      </TableCell>
                      <TableCell>
                        {discrepancy.production_orders?.products?.name}
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {discrepancy.raw_materials?.material_code}
                      </TableCell>
                      <TableCell>
                        {discrepancy.raw_materials?.name}
                      </TableCell>
                      <TableCell className="font-medium text-blue-600">
                        {discrepancy.sent_quantity}
                      </TableCell>
                      <TableCell className="font-medium text-orange-600">
                        {discrepancy.quantity_received}
                      </TableCell>
                      <TableCell className="font-medium text-red-600">
                        {discrepancy.discrepancy_quantity}
                      </TableCell>
                      <TableCell>{getDiscrepancyTypeBadge(discrepancy.discrepancy_type)}</TableCell>
                      <TableCell>{getStatusBadge(discrepancy.discrepancy_status)}</TableCell>
                      <TableCell>
                        {discrepancy.discrepancy_status === 'PENDING' && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolveDiscrepancy(discrepancy, 'APPROVE')}
                              className="gap-1"
                              disabled={resolveDiscrepancyMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolveDiscrepancy(discrepancy, 'REJECT')}
                              className="gap-1"
                              disabled={resolveDiscrepancyMutation.isPending}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discrepancy Resolution Dialog */}
      <Dialog open={showResolutionDialog} onOpenChange={setShowResolutionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {resolutionAction === 'APPROVE' ? 'Approve' : 'Reject'} Discrepancy
            </DialogTitle>
          </DialogHeader>
          
          {selectedDiscrepancy && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <span className="text-sm text-muted-foreground">Voucher:</span>
                  <p className="font-medium">{selectedDiscrepancy.production_orders?.voucher_number}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Material:</span>
                  <p className="font-medium">{selectedDiscrepancy.raw_materials?.material_code}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Sent Quantity:</span>
                  <p className="font-medium text-blue-600">{selectedDiscrepancy.sent_quantity}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Received Quantity:</span>
                  <p className="font-medium text-orange-600">{selectedDiscrepancy.quantity_received}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Discrepancy:</span>
                  <p className="font-medium text-red-600">
                    {selectedDiscrepancy.discrepancy_quantity} ({selectedDiscrepancy.discrepancy_type})
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution Notes:</label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder={
                    resolutionAction === 'APPROVE' 
                      ? "Explain why you are approving this discrepancy..." 
                      : "Explain why you are rejecting this discrepancy..."
                  }
                  rows={3}
                />
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">
                  {resolutionAction === 'APPROVE' ? 'Approval Impact:' : 'Rejection Impact:'}
                </h4>
                <p className="text-sm text-yellow-700">
                  {resolutionAction === 'APPROVE' ? (
                    selectedDiscrepancy.discrepancy_type === 'SHORTAGE' ? (
                      `Inventory will be increased by ${selectedDiscrepancy.discrepancy_quantity} units to reflect the shortage.`
                    ) : (
                      `Production receipt will be adjusted to match the sent quantity.`
                    )
                  ) : (
                    `Original sent quantity (${selectedDiscrepancy.sent_quantity}) will be maintained. No inventory adjustment.`
                  )}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowResolutionDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmResolution}
                  disabled={resolveDiscrepancyMutation.isPending}
                  variant={resolutionAction === 'APPROVE' ? 'default' : 'destructive'}
                >
                  {resolveDiscrepancyMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {resolutionAction === 'APPROVE' ? (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      {resolutionAction === 'APPROVE' ? 'Approve Discrepancy' : 'Reject Discrepancy'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EnhancedProductionFeedback;
