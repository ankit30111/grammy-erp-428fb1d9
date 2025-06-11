
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Mail, RotateCcw, FileText, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import IQCDiscrepancyActionDialog from "./IQCDiscrepancyActionDialog";

const IQCDiscrepancies = () => {
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<any>(null);
  const [actionType, setActionType] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: iqcDiscrepancies, isLoading } = useQuery({
    queryKey: ['iqc-discrepancies'],
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
        .in('iqc_status', ['SEGREGATED', 'FAILED', 'REJECTED'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleAction = (discrepancy: any, action: string) => {
    setSelectedDiscrepancy(discrepancy);
    setActionType(action);
    setDialogOpen(true);
  };

  const getDiscrepancyQuantity = (item: any) => {
    if (item.iqc_status === 'SEGREGATED') {
      return item.rejected_quantity || 0;
    } else if (item.iqc_status === 'FAILED' || item.iqc_status === 'REJECTED') {
      return item.received_quantity || 0;
    }
    return 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SEGREGATED':
        return 'warning';
      case 'FAILED':
      case 'REJECTED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-muted-foreground">Loading IQC discrepancies...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            IQC Quality Discrepancies
            {iqcDiscrepancies && iqcDiscrepancies.length > 0 && (
              <Badge variant="secondary">{iqcDiscrepancies.length} items</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {iqcDiscrepancies && iqcDiscrepancies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN Number</TableHead>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>PO Quantity</TableHead>
                  <TableHead>Received Quantity</TableHead>
                  <TableHead>Discrepant Quantity</TableHead>
                  <TableHead>IQC Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {iqcDiscrepancies.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.grn?.grn_number}</TableCell>
                    <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                    <TableCell>{item.raw_materials?.name}</TableCell>
                    <TableCell>{item.grn?.vendors?.name}</TableCell>
                    <TableCell>{item.po_quantity}</TableCell>
                    <TableCell>{item.received_quantity}</TableCell>
                    <TableCell className="font-medium text-red-600">
                      {getDiscrepancyQuantity(item)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(item.iqc_status)}>
                        {item.iqc_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(item, 'inform-vendor')}
                          className="gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          Inform
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(item, 'send-back')}
                          className="gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Return
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(item, 'request-capa')}
                          className="gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          CAPA
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(item, 'close-remarks')}
                          className="gap-1"
                        >
                          <X className="h-3 w-3" />
                          Close
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No IQC Discrepancies Found</h3>
              <p className="text-muted-foreground">
                All received materials have passed IQC without quality issues.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <IQCDiscrepancyActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        discrepancy={selectedDiscrepancy}
        actionType={actionType}
      />
    </>
  );
};

export default IQCDiscrepancies;
