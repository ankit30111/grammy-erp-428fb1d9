
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Mail, CreditCard, Truck, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import StoreDiscrepancyActionDialog from "./StoreDiscrepancyActionDialog";
import { format } from "date-fns";

const StoreDiscrepancies = () => {
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<any>(null);
  const [actionType, setActionType] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: storeDiscrepancies, isLoading } = useQuery({
    queryKey: ['store-discrepancies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_discrepancies')
        .select(`
          *,
          grn (
            grn_number,
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
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleAction = (discrepancy: any, action: string) => {
    setSelectedDiscrepancy(discrepancy);
    setActionType(action);
    setDialogOpen(true);
  };

  const getDiscrepancyTypeInfo = (discrepancy: any) => {
    if (discrepancy.discrepancy_type === 'SHORTAGE') {
      return { 
        type: 'Material Shortage', 
        color: 'destructive' as const, 
        text: `-${discrepancy.discrepancy_quantity}`,
        description: 'Store received less than IQC approved'
      };
    } else {
      return { 
        type: 'Material Excess', 
        color: 'warning' as const, 
        text: `+${discrepancy.discrepancy_quantity}`,
        description: 'Store received more than IQC approved'
      };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-muted-foreground">Loading store discrepancies...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Store Physical Verification Discrepancies
            {storeDiscrepancies && storeDiscrepancies.length > 0 && (
              <Badge variant="secondary">{storeDiscrepancies.length} items</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {storeDiscrepancies && storeDiscrepancies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN Number</TableHead>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>IQC Approved Qty</TableHead>
                  <TableHead>Store Physical Qty</TableHead>
                  <TableHead>Discrepancy</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reported Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeDiscrepancies.map((discrepancy) => {
                  const discrepancyInfo = getDiscrepancyTypeInfo(discrepancy);
                  
                  return (
                    <TableRow key={discrepancy.id}>
                      <TableCell className="font-mono">{discrepancy.grn?.grn_number}</TableCell>
                      <TableCell className="font-mono">{discrepancy.raw_materials?.material_code}</TableCell>
                      <TableCell>{discrepancy.raw_materials?.name}</TableCell>
                      <TableCell>{discrepancy.grn?.vendors?.name}</TableCell>
                      <TableCell>{discrepancy.iqc_accepted_quantity}</TableCell>
                      <TableCell>{discrepancy.store_physical_quantity}</TableCell>
                      <TableCell className="font-medium">
                        <span className={discrepancyInfo.color === 'destructive' ? 'text-red-600' : 'text-orange-600'}>
                          {discrepancyInfo.text}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={discrepancyInfo.color}>
                          {discrepancyInfo.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(discrepancy.reported_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(discrepancy, 'notify-vendor')}
                            className="gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            Notify
                          </Button>
                          {discrepancy.discrepancy_type === 'SHORTAGE' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction(discrepancy, 'credit-note')}
                                className="gap-1"
                              >
                                <CreditCard className="h-3 w-3" />
                                Credit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction(discrepancy, 'request-delivery')}
                                className="gap-1"
                              >
                                <Truck className="h-3 w-3" />
                                Request
                              </Button>
                            </>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(discrepancy, 'accept-discrepancy')}
                            className="gap-1"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Accept
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Store Discrepancies Found</h3>
              <p className="text-muted-foreground">
                All physical verification quantities match the IQC approved quantities.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <StoreDiscrepancyActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        discrepancy={selectedDiscrepancy}
        actionType={actionType}
      />
    </>
  );
};

export default StoreDiscrepancies;
