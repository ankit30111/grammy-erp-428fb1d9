
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, CheckCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

const GRNReceiving = () => {
  const [physicalQuantities, setPhysicalQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch GRN items that are ready for store receipt (IQC approved)
  const { data: grnItems = [], isLoading } = useQuery({
    queryKey: ['grn-items-for-store'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grn_items')
        .select(`
          *,
          grn (
            grn_number,
            received_date,
            vendors (
              name,
              vendor_code
            )
          ),
          raw_materials (
            material_code,
            name
          )
        `)
        .in('iqc_status', ['APPROVED', 'SEGREGATED'])
        .neq('accepted_quantity', 0)
        .is('store_confirmed', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Filter items that have actual accepted quantity > 0
      return data?.filter(item => (item.accepted_quantity || 0) > 0) || [];
    },
  });

  // Mutation to handle physical verification and store confirmation
  const confirmPhysicalVerificationMutation = useMutation({
    mutationFn: async ({ itemId, physicalQuantity }: { itemId: string; physicalQuantity: number }) => {
      const { error } = await supabase
        .from('grn_items')
        .update({
          store_physical_quantity: physicalQuantity,
          physical_verification_date: new Date().toISOString(),
          physical_verified_by: null, // Would be set from auth in real app
          store_confirmed: true,
          store_confirmed_at: new Date().toISOString(),
          store_confirmed_by: null, // Would be set from auth in real app
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn-items-for-store'] });
      queryClient.invalidateQueries({ queryKey: ['store-discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setPhysicalQuantities({});
      toast({
        title: "Physical Verification Complete",
        description: "Material has been received to store and inventory updated",
      });
    },
    onError: (error) => {
      console.error('Error confirming physical verification:', error);
      toast({
        title: "Error",
        description: "Failed to confirm physical verification",
        variant: "destructive",
      });
    },
  });

  const handlePhysicalQuantityChange = (itemId: string, quantity: string) => {
    const numQuantity = parseInt(quantity) || 0;
    setPhysicalQuantities(prev => ({
      ...prev,
      [itemId]: numQuantity
    }));
  };

  const handleConfirmReceipt = (item: any) => {
    const physicalQuantity = physicalQuantities[item.id];
    
    if (physicalQuantity === undefined || physicalQuantity < 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid physical quantity",
        variant: "destructive",
      });
      return;
    }

    confirmPhysicalVerificationMutation.mutate({
      itemId: item.id,
      physicalQuantity
    });
  };

  const getAcceptedQuantity = (item: any) => {
    // For SEGREGATED items, show the accepted quantity, for APPROVED items show received quantity
    return item.iqc_status === 'SEGREGATED' ? item.accepted_quantity : item.received_quantity;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-muted-foreground">Loading GRN items for receipt...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          Materials Ready for Store Receipt
          {grnItems.length > 0 && (
            <Badge variant="secondary">{grnItems.length} items</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {grnItems.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN Number</TableHead>
                <TableHead>Material Code</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Received Date</TableHead>
                <TableHead>IQC Status</TableHead>
                <TableHead>Qty Forwarded by IQC</TableHead>
                <TableHead>Physical Qty Verified</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grnItems.map((item) => {
                const acceptedQty = getAcceptedQuantity(item);
                const physicalQty = physicalQuantities[item.id];
                
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.grn?.grn_number}</TableCell>
                    <TableCell className="font-mono text-blue-600">
                      {item.raw_materials?.material_code}
                    </TableCell>
                    <TableCell>{item.raw_materials?.name}</TableCell>
                    <TableCell>{item.grn?.vendors?.name}</TableCell>
                    <TableCell>
                      {item.grn?.received_date ? format(new Date(item.grn.received_date), 'MMM dd, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={item.iqc_status === 'APPROVED' ? 'default' : 'secondary'}
                        className={item.iqc_status === 'APPROVED' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {item.iqc_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-lg">
                      {acceptedQty}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max={acceptedQty}
                        value={physicalQty || ''}
                        onChange={(e) => handlePhysicalQuantityChange(item.id, e.target.value)}
                        placeholder="Enter physical count"
                        className="w-32"
                      />
                      {physicalQty !== undefined && physicalQty !== acceptedQty && (
                        <div className="text-xs mt-1">
                          {physicalQty < acceptedQty ? (
                            <span className="text-red-600">
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              Shortage: {acceptedQty - physicalQty}
                            </span>
                          ) : (
                            <span className="text-orange-600">
                              Excess: {physicalQty - acceptedQty}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => handleConfirmReceipt(item)}
                        disabled={
                          physicalQty === undefined || 
                          confirmPhysicalVerificationMutation.isPending
                        }
                        className="gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Confirm Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Items Ready for Receipt</h3>
            <p className="text-muted-foreground">
              All materials forwarded by IQC have been received to store.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GRNReceiving;
