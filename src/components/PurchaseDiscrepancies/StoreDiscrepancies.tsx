import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Mail, CreditCard, Truck, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import StoreDiscrepancyActionDialog from "./StoreDiscrepancyActionDialog";

const StoreDiscrepancies = () => {
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<any>(null);
  const [actionType, setActionType] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: storeDiscrepancies, isLoading } = useQuery({
    queryKey: ['store-discrepancies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grn_items')
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
        .not('accepted_quantity', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Filter to only include items where received_quantity != accepted_quantity
      return data?.filter(item => {
        const receivedQty = Number(item.received_quantity) || 0;
        const acceptedQty = Number(item.accepted_quantity) || 0;
        return receivedQty !== acceptedQty;
      }) || [];
    },
  });

  const handleAction = (discrepancy: any, action: string) => {
    setSelectedDiscrepancy(discrepancy);
    setActionType(action);
    setDialogOpen(true);
  };

  const getDiscrepancyAmount = (item: any) => {
    return (Number(item.received_quantity) || 0) - (Number(item.accepted_quantity) || 0);
  };

  const getDiscrepancyType = (discrepancy: number) => {
    if (discrepancy > 0) {
      return { type: 'Excess', color: 'warning' as const, text: `+${discrepancy}` };
    } else {
      return { type: 'Shortage', color: 'destructive' as const, text: `${discrepancy}` };
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
            Store Receiving Discrepancies
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
                  <TableHead>GRN Quantity</TableHead>
                  <TableHead>Store Accepted</TableHead>
                  <TableHead>Discrepancy</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeDiscrepancies.map((item) => {
                  const discrepancy = getDiscrepancyAmount(item);
                  const discrepancyInfo = getDiscrepancyType(discrepancy);
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.grn?.grn_number}</TableCell>
                      <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                      <TableCell>{item.raw_materials?.name}</TableCell>
                      <TableCell>{item.grn?.vendors?.name}</TableCell>
                      <TableCell>{item.received_quantity}</TableCell>
                      <TableCell>{item.accepted_quantity}</TableCell>
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
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(item, 'notify-vendor')}
                            className="gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            Notify
                          </Button>
                          {discrepancy < 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(item, 'credit-note')}
                              className="gap-1"
                            >
                              <CreditCard className="h-3 w-3" />
                              Credit
                            </Button>
                          )}
                          {discrepancy < 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(item, 'request-delivery')}
                              className="gap-1"
                            >
                              <Truck className="h-3 w-3" />
                              Request
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(item, 'accept-delivery')}
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
                All GRN quantities match the store accepted quantities.
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
