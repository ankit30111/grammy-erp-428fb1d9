
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
import { AlertTriangle, CheckCircle, Scale, Search, Filter } from "lucide-react";

const StockReconciliation = () => {
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [selectedReasonCodes, setSelectedReasonCodes] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
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

  const categories = [
    "Connector",
    "Consumables", 
    "Gasket",
    "Loudspeaker",
    "Metal",
    "Others",
    "Packaging",
    "PCB",
    "Plastic",
    "Remote",
    "Screw",
    "Sticker",
    "Transformer",
    "Wire",
    "Wooden"
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

  // Filter inventory based on search term and category
  const filteredInventory = inventory.filter(item => {
    const materialCode = item.raw_materials?.material_code || "";
    const materialName = item.raw_materials?.name || "";
    const materialCategory = item.raw_materials?.category || "";
    
    // Search filter
    const matchesSearch = searchTerm === "" || 
      materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materialName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Category filter
    const matchesCategory = selectedCategory === "ALL" || materialCategory === selectedCategory;
    
    return matchesSearch && matchesCategory;
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
    return filteredInventory.some(item => {
      const variance = getVariance(item.raw_material_id, item.quantity);
      return variance !== 0 && physicalCounts[item.raw_material_id] !== undefined;
    });
  };

  const getVariancesForSubmission = () => {
    return filteredInventory
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

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("ALL");
  };

  const hasActiveFilters = searchTerm !== "" || selectedCategory !== "ALL";

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

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by material code or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="w-full sm:w-48">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters} size="sm">
              Clear Filters
            </Button>
          )}
        </div>

        {/* Results Summary */}
        {hasActiveFilters && (
          <div className="text-sm text-muted-foreground">
            Showing {filteredInventory.length} of {inventory.length} materials
            {searchTerm && (
              <span> matching "{searchTerm}"</span>
            )}
            {selectedCategory !== "ALL" && (
              <span> in {selectedCategory} category</span>
            )}
          </div>
        )}

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
            {filteredInventory.map((item) => {
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

        {filteredInventory.length === 0 && inventory.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="mx-auto h-12 w-12 opacity-50 mb-4" />
            <p>No materials found matching your search criteria</p>
            <p className="text-sm">Try adjusting your search term or category filter</p>
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
