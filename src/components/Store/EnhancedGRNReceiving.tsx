import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, PackageOpen, Search, ShoppingCart, Truck, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isPermissionError, formatPermissionMessage, describeError } from "@/lib/permissions";
import { AccessDenied } from "@/components/Auth/AccessDenied";

interface EnhancedGRNReceivingProps {
  onReceiveGRN?: (id: string, quantity: number) => void;
  onDiscrepancyReport?: (grnId: string, expectedQty: number, receivedQty: number, poNumber: string) => void;
}

const EnhancedGRNReceiving = ({
  onReceiveGRN,
  onDiscrepancyReport
}: EnhancedGRNReceivingProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [verifiedQuantities, setVerifiedQuantities] = useState<Record<string, number>>({});

  // Fetch GRNs that have passed IQC but not yet received by store
  const { data: pendingGRNs = [], error: pendingError, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-store-grns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grn")
        .select(`
          *,
          vendors (name),
          purchase_orders (po_number),
          grn_items (
            id,
            raw_material_id,
            po_quantity,
            received_quantity,
            accepted_quantity,
            rejected_quantity,
            iqc_status,
            store_confirmed,
            store_confirmed_at,
            raw_materials (id, name, material_code)
          )
        `)
        .eq("status", "IQC_COMPLETED")
        .order("received_date", { ascending: false });

      if (error) throw error;

      // Filter out GRNs where all items are already confirmed by store
      return (data || []).filter(grn =>
        grn.grn_items.some((item: any) =>
          !item.store_confirmed &&
          (item.iqc_status === 'APPROVED' ||
           (item.iqc_status === 'SEGREGATED' && item.accepted_quantity > 0))
        )
      );
    },
    retry: (failureCount, error) => !isPermissionError(error) && failureCount < 2,
  });

  // Fetch already confirmed GRNs
  const { data: confirmedGRNs = [], error: confirmedError } = useQuery({
    queryKey: ["confirmed-store-grns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grn")
        .select(`
          *,
          vendors (name),
          purchase_orders (po_number),
          grn_items (
            id,
            raw_material_id,
            po_quantity,
            received_quantity,
            accepted_quantity,
            rejected_quantity,
            iqc_status,
            store_confirmed,
            store_confirmed_at,
            raw_materials (id, name, material_code)
          )
        `)
        .eq("status", "STORE_RECEIVED")
        .order("received_date", { ascending: false })
        .limit(20);

      if (error) throw error;

      return data || [];
    },
    retry: (failureCount, error) => !isPermissionError(error) && failureCount < 2,
  });

  // If RLS denied access (likely the user's department doesn't have the
  // 'store' permission), surface a clear "Access Denied" card up front
  // instead of leaving the table empty.
  const accessDenied = isPermissionError(pendingError) || isPermissionError(confirmedError);

  // Filter GRNs based on search query
  const filteredPendingGRNs = useMemo(() => {
    if (!searchQuery) return pendingGRNs;
    
    return pendingGRNs.filter(grn => 
      grn.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (grn.purchase_orders?.po_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (grn.vendors?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pendingGRNs, searchQuery]);

  // Initialize verified quantities when opening dialog
  const handleOpenReceiveDialog = (grn: any) => {
    const initialQuantities: Record<string, number> = {};
    
    grn.grn_items.forEach((item: any) => {
      if (!item.store_confirmed) {
        if (item.iqc_status === 'APPROVED') {
          initialQuantities[item.id] = item.received_quantity;
        } else if (item.iqc_status === 'SEGREGATED') {
          initialQuantities[item.id] = item.accepted_quantity;
        }
      }
    });
    
    setVerifiedQuantities(initialQuantities);
    setSelectedGRN(grn);
    setReceiveDialogOpen(true);
  };

  // Handle confirmation of GRN by store
  const confirmGRNMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGRN) return;
      
      // Update each GRN item
      const updatePromises = Object.entries(verifiedQuantities).map(async ([itemId, quantity]) => {
        const { error } = await supabase
          .from("grn_items")
          .update({
            store_confirmed: true,
            store_confirmed_at: new Date().toISOString(),
            store_confirmed_by: null,
            accepted_quantity: quantity,
          })
          .eq("id", itemId);
        
        if (error) throw error;

        // Get material info for logging
        const grnItem = selectedGRN.grn_items.find((item: any) => item.id === itemId);
        if (grnItem) {
          // Auto-log GRN receipt with proper reference
          const { error: logError } = await supabase.rpc('log_material_movement', {
            p_raw_material_id: grnItem.raw_material_id,
            p_movement_type: 'GRN_RECEIPT',
            p_quantity: quantity,
            p_reference_id: selectedGRN.id,
            p_reference_type: 'GRN',
            p_reference_number: selectedGRN.grn_number,
            p_notes: `GRN material received to store. PO: ${selectedGRN.purchase_orders?.po_number || 'N/A'}, Vendor: ${selectedGRN.vendors?.name || 'N/A'}`
          });

          if (logError) {
            console.error("❌ Error logging GRN receipt:", logError);
          }
        }
      });
      
      await Promise.all(updatePromises);
      
      // Check if all items in the GRN are now confirmed
      const allItemsConfirmed = selectedGRN.grn_items.every((item: any) => 
        item.store_confirmed || verifiedQuantities[item.id] !== undefined
      );
      
      if (allItemsConfirmed) {
        await supabase
          .from("grn")
          .update({ status: "STORE_RECEIVED" })
          .eq("id", selectedGRN.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-store-grns"] });
      queryClient.invalidateQueries({ queryKey: ["confirmed-store-grns"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      
      toast({
        title: "GRN Received",
        description: "Materials have been added to inventory",
      });
      
      setReceiveDialogOpen(false);
      setSelectedGRN(null);
      setVerifiedQuantities({});
    },
    onError: (error) => {
      const description = isPermissionError(error)
        ? formatPermissionMessage("Store / GRN receiving", "modify")
        : `Failed to confirm GRN reception: ${describeError(error)}`;
      toast({
        title: isPermissionError(error) ? "Access denied" : "Error",
        description,
        variant: "destructive",
      });
    },
  });

  if (accessDenied) {
    return <AccessDenied area="GRN Receiving" variant="inline" />;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="pending">Pending GRNs</TabsTrigger>
          <TabsTrigger value="received">Received GRNs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending GRNs ({filteredPendingGRNs.length})
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by GRN or PO..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredPendingGRNs.length === 0 ? (
                <div className="text-center py-8">
                  <PackageOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending GRNs to receive</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GRN Number</TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Received Date</TableHead>
                      <TableHead>IQC Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPendingGRNs.map((grn) => (
                      <TableRow key={grn.id}>
                        <TableCell className="font-medium">{grn.grn_number}</TableCell>
                        <TableCell>{grn.purchase_orders?.po_number}</TableCell>
                        <TableCell>{grn.vendors?.name}</TableCell>
                        <TableCell>{new Date(grn.received_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            IQC Completed
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReceiveDialog(grn)}
                            className="gap-2"
                          >
                            <Truck className="h-4 w-4" />
                            Receive Material
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="received">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Received GRNs ({confirmedGRNs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {confirmedGRNs.length === 0 ? (
                <div className="text-center py-8">
                  <PackageOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No GRNs have been received yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GRN Number</TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Received Date</TableHead>
                      <TableHead>Confirmed Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {confirmedGRNs.map((grn) => (
                      <TableRow key={grn.id}>
                        <TableCell className="font-medium">{grn.grn_number}</TableCell>
                        <TableCell>{grn.purchase_orders?.po_number}</TableCell>
                        <TableCell>{grn.vendors?.name}</TableCell>
                        <TableCell>{new Date(grn.received_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {grn.grn_items[0]?.store_confirmed_at
                            ? new Date(grn.grn_items[0].store_confirmed_at).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Received
                          </Badge>
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

      {/* GRN Receive Dialog */}
      {selectedGRN && (
        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Receive GRN: {selectedGRN.grn_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/20 p-4 rounded-md text-sm">
                <div><strong>PO Number:</strong> {selectedGRN.purchase_orders?.po_number}</div>
                <div><strong>Vendor:</strong> {selectedGRN.vendors?.name}</div>
                <div><strong>Received Date:</strong> {new Date(selectedGRN.received_date).toLocaleDateString()}</div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Materials to Receive</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>IQC Accepted Qty</TableHead>
                      <TableHead>Physically Verified Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGRN.grn_items.filter((item: any) => 
                      !item.store_confirmed && 
                      (item.iqc_status === 'APPROVED' || 
                      (item.iqc_status === 'SEGREGATED' && item.accepted_quantity > 0))
                    ).map((item: any) => {
                      const maxQty = item.iqc_status === 'APPROVED' 
                        ? item.received_quantity 
                        : item.accepted_quantity;
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">
                            {item.raw_materials?.material_code}
                          </TableCell>
                          <TableCell>{item.raw_materials?.name}</TableCell>
                          <TableCell>{maxQty}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={maxQty}
                              value={verifiedQuantities[item.id] || 0}
                              onChange={(e) => {
                                const value = Math.min(parseInt(e.target.value) || 0, maxQty);
                                setVerifiedQuantities(prev => ({
                                  ...prev,
                                  [item.id]: value
                                }));
                              }}
                              className="w-24"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => confirmGRNMutation.mutate()}
                  disabled={confirmGRNMutation.isPending}
                >
                  {confirmGRNMutation.isPending ? "Processing..." : "Confirm Receipt"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default EnhancedGRNReceiving;
