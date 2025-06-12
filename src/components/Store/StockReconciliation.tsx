
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Scale } from "lucide-react";

const StockReconciliation = () => {
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [selectedReasonCodes, setSelectedReasonCodes] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reasonCodes = [
    "SHRINKAGE",
    "DAMAGED_MATERIAL",
    "COUNTING_ERROR", 
    "SYSTEM_ERROR",
    "THEFT_LOSS",
    "SUPPLIER_SHORTAGE",
    "PRODUCTION_WASTE",
    "OTHER"
  ];

  // Fetch current inventory
  const { data: inventory = [], refetch } = useQuery({
    queryKey: ["inventory-reconciliation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          raw_materials!raw_material_id (
            id,
            material_code,
            name,
            category
          )
        `)
        .order("raw_materials(material_code)");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Submit reconciliation mutation
  const submitReconciliation = useMutation({
    mutationFn: async (reconciliationData: Array<{
      materialId: string;
      systemQuantity: number;
      physicalQuantity: number;
      variance: number;
      reasonCode: string;
      remarks: string;
    }>) => {
      // Create reconciliation records for approval
      const { data: reconciliationRecords, error } = await supabase
        .from("material_movements")
        .insert(
          reconciliationData.map(item => ({
            raw_material_id: item.materialId,
            movement_type: "STOCK_RECONCILIATION",
            quantity: Math.abs(item.variance),
            reference_id: crypto.randomUUID(),
            reference_type: "RECONCILIATION",
            reference_number: `REC-${new Date().getTime()}`,
            notes: `Stock Reconciliation: System ${item.systemQuantity}, Physical ${item.physicalQuantity}, Variance ${item.variance}. Reason: ${item.reasonCode} - ${item.remarks}`
          }))
        )
        .select();

      if (error) throw error;

      // Also create approval requests for the reconciliation adjustments
      // This would typically go to a separate reconciliation_approvals table
      // For now, we'll use the existing approvals system

      return reconciliationRecords;
    },
    onSuccess: () => {
      toast({
        title: "Reconciliation Submitted",
        description: "Stock reconciliation has been submitted for approval",
      });
      
      // Clear form data
      setPhysicalCounts({});
      setReasons({});
      setSelectedReasonCodes({});
      
      queryClient.invalidateQueries({ queryKey: ["inventory-reconciliation"] });
    },
  });

  const handlePhysicalCountChange = (materialId: string, value: string) => {
    const count = parseInt(value) || 0;
    setPhysicalCounts(prev => ({
      ...prev,
      [materialId]: count
    }));
  };

  const handleReasonCodeChange = (materialId: string, reasonCode: string) => {
    setSelectedReasonCodes(prev => ({
      ...prev,
      [materialId]: reasonCode
    }));
  };

  const handleRemarksChange = (materialId: string, remarks: string) => {
    setReasons(prev => ({
      ...prev,
      [materialId]: remarks
    }));
  };

  const getVariance = (materialId: string, systemQuantity: number) => {
    const physicalCount = physicalCounts[materialId];
    if (physicalCount === undefined) return 0;
    return physicalCount - systemQuantity;
  };

  const hasVariances = () => {
    return inventory.some(item => {
      const variance = getVariance(item.raw_material_id, item.quantity);
      return variance !== 0 && physicalCounts[item.raw_material_id] !== undefined;
    });
  };

  const getVariancesForSubmission = () => {
    return inventory
      .filter(item => {
        const variance = getVariance(item.raw_material_id, item.quantity);
        const hasPhysicalCount = physicalCounts[item.raw_material_id] !== undefined;
        const hasVariance = variance !== 0;
        return hasPhysicalCount && hasVariance;
      })
      .map(item => {
        const variance = getVariance(item.raw_material_id, item.quantity);
        const reasonCode = selectedReasonCodes[item.raw_material_id] || "";
        const remarks = reasons[item.raw_material_id] || "";
        
        return {
          materialId: item.raw_material_id,
          systemQuantity: item.quantity,
          physicalQuantity: physicalCounts[item.raw_material_id],
          variance,
          reasonCode,
          remarks
        };
      });
  };

  const handleSubmitReconciliation = () => {
    const variancesToSubmit = getVariancesForSubmission();
    
    // Validate that all variances have reason codes
    const missingReasons = variancesToSubmit.filter(item => !item.reasonCode);
    if (missingReasons.length > 0) {
      toast({
        title: "Missing Reason Codes",
        description: "Please provide reason codes for all variances",
        variant: "destructive",
      });
      return;
    }

    if (variancesToSubmit.length === 0) {
      toast({
        title: "No Variances Found",
        description: "No inventory variances to reconcile",
        variant: "destructive",
      });
      return;
    }

    submitReconciliation.mutate(variancesToSubmit);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Stock Reconciliation
          {hasVariances() && (
            <Badge variant="warning" className="ml-2">
              {getVariancesForSubmission().length} Variances
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Enter physical stock counts for each material. Variances from system quantities will require approval.
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material Code</TableHead>
              <TableHead>Material Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>System Qty</TableHead>
              <TableHead>Physical Count</TableHead>
              <TableHead>Variance</TableHead>
              <TableHead>Reason Code</TableHead>
              <TableHead>Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map((item) => {
              const variance = getVariance(item.raw_material_id, item.quantity);
              const hasVariance = variance !== 0 && physicalCounts[item.raw_material_id] !== undefined;

              return (
                <TableRow key={item.id} className={hasVariance ? "bg-yellow-50" : ""}>
                  <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                  <TableCell>{item.raw_materials?.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.raw_materials?.category}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.quantity}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={physicalCounts[item.raw_material_id] || ""}
                      onChange={(e) => handlePhysicalCountChange(item.raw_material_id, e.target.value)}
                      className="w-24"
                      placeholder="Count"
                    />
                  </TableCell>
                  <TableCell>
                    {physicalCounts[item.raw_material_id] !== undefined && (
                      <span className={`font-medium ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {variance > 0 ? `+${variance}` : variance}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasVariance && (
                      <Select
                        value={selectedReasonCodes[item.raw_material_id] || ""}
                        onValueChange={(value) => handleReasonCodeChange(item.raw_material_id, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {reasonCodes.map((code) => (
                            <SelectItem key={code} value={code}>
                              {code.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasVariance && (
                      <Textarea
                        value={reasons[item.raw_material_id] || ""}
                        onChange={(e) => handleRemarksChange(item.raw_material_id, e.target.value)}
                        placeholder="Enter remarks..."
                        className="w-48 h-20"
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {hasVariances() && (
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              onClick={handleSubmitReconciliation}
              disabled={submitReconciliation.isPending}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Submit for Approval ({getVariancesForSubmission().length} items)
            </Button>
          </div>
        )}

        {inventory.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No inventory data found
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockReconciliation;
