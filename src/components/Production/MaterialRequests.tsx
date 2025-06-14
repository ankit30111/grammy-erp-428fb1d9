import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Package, Plus, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const MaterialRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    productionOrderId: '',
    rawMaterialId: '',
    requestedQuantity: 0,
    reason: ''
  });

  // Fetch running production orders (IN_PROGRESS status)
  const { data: runningProductions = [] } = useQuery({
    queryKey: ["running-production-orders"],
    queryFn: async () => {
      console.log("🔍 Fetching running production orders...");
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          id,
          voucher_number,
          quantity,
          status,
          production_lines,
          products!inner(
            id,
            name,
            product_code
          )
        `)
        .eq("status", "IN_PROGRESS")
        .order("voucher_number");
      
      if (error) {
        console.error("❌ Error fetching running productions:", error);
        throw error;
      }
      
      console.log("🏭 Running productions:", data);
      return data || [];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch BOM materials for selected production order
  const { data: bomMaterials = [] } = useQuery({
    queryKey: ["bom-materials", newRequest.productionOrderId],
    queryFn: async () => {
      if (!newRequest.productionOrderId) return [];
      
      console.log("🔍 Fetching BOM materials for production:", newRequest.productionOrderId);
      
      // Get the product ID from the selected production order
      const selectedProduction = runningProductions.find(p => p.id === newRequest.productionOrderId);
      if (!selectedProduction) return [];
      
      const { data, error } = await supabase
        .from("bom")
        .select(`
          id,
          quantity,
          bom_type,
          raw_materials!inner(
            id,
            material_code,
            name,
            category
          )
        `)
        .eq("product_id", selectedProduction.products.id);
      
      if (error) {
        console.error("❌ Error fetching BOM materials:", error);
        throw error;
      }
      
      console.log("📋 BOM materials:", data);
      return data || [];
    },
    enabled: !!newRequest.productionOrderId && runningProductions.length > 0,
  });

  // Fetch existing material requests
  const { data: materialRequests = [], refetch } = useQuery({
    queryKey: ["material-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_requests")
        .select(`
          *,
          production_orders!inner(
            voucher_number,
            products!inner(
              name
            )
          ),
          raw_materials!inner(
            name, 
            material_code
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("❌ Error fetching material requests:", error);
        throw error;
      }
      
      return data || [];
    },
    refetchInterval: 5000, // Real-time updates
  });

  // Create material request mutation
  const createRequestMutation = useMutation({
    mutationFn: async (requestData: typeof newRequest) => {
      console.log("🔄 Creating material request:", requestData);
      
      const { data, error } = await supabase
        .from("material_requests")
        .insert({
          production_order_id: requestData.productionOrderId,
          raw_material_id: requestData.rawMaterialId,
          requested_quantity: requestData.requestedQuantity,
          reason: requestData.reason,
          requested_by: null
        })
        .select()
        .single();
      
      if (error) {
        console.error("❌ Error creating material request:", error);
        throw error;
      }
      
      console.log("✅ Material request created:", data);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Request Submitted",
        description: "Material request has been sent to store for approval",
      });
      
      // Reset form
      setNewRequest({
        productionOrderId: '',
        rawMaterialId: '',
        requestedQuantity: 0,
        reason: ''
      });
      setShowCreateForm(false);
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["material-requests"] });
    },
    onError: (error: Error) => {
      console.error("❌ Failed to create material request:", error);
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitRequest = () => {
    if (!newRequest.productionOrderId || !newRequest.rawMaterialId || 
        newRequest.requestedQuantity <= 0 || !newRequest.reason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    createRequestMutation.mutate(newRequest);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'default';
      case 'REJECTED': return 'destructive';
      case 'PENDING': return 'secondary';
      default: return 'outline';
    }
  };

  const getProductionLineDisplay = (productionLines: any) => {
    if (!productionLines || typeof productionLines !== 'object') return 'Not Assigned';
    
    const lines = Object.values(productionLines).filter(Boolean);
    return lines.length > 0 ? lines.join(', ') : 'Not Assigned';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Material Requests ({materialRequests.length})
            <Badge variant="outline">Real-time Updates</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
            <Button onClick={() => setShowCreateForm(!showCreateForm)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showCreateForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Request Additional Material</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Production Order *</label>
                    <Select
                      value={newRequest.productionOrderId}
                      onValueChange={(value) => setNewRequest(prev => ({ 
                        ...prev, 
                        productionOrderId: value,
                        rawMaterialId: '' // Reset material selection
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select running production order" />
                      </SelectTrigger>
                      <SelectContent>
                        {runningProductions.map((production) => (
                          <SelectItem key={production.id} value={production.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {production.voucher_number} - {production.products.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Qty: {production.quantity} | Lines: {getProductionLineDisplay(production.production_lines)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Raw Material *</label>
                    <Select
                      value={newRequest.rawMaterialId}
                      onValueChange={(value) => setNewRequest(prev => ({ ...prev, rawMaterialId: value }))}
                      disabled={!newRequest.productionOrderId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select material from BOM" />
                      </SelectTrigger>
                      <SelectContent>
                        {bomMaterials.map((bomItem) => (
                          <SelectItem key={bomItem.raw_materials.id} value={bomItem.raw_materials.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {bomItem.raw_materials.material_code} - {bomItem.raw_materials.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Category: {bomItem.raw_materials.category} | Type: {bomItem.bom_type} | BOM Qty: {bomItem.quantity}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Requested Quantity *</label>
                    <Input
                      type="number"
                      min="1"
                      value={newRequest.requestedQuantity || ''}
                      onChange={(e) => setNewRequest(prev => ({ 
                        ...prev, 
                        requestedQuantity: parseInt(e.target.value) || 0 
                      }))}
                      placeholder="Enter quantity needed"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Reason *</label>
                    <Textarea
                      value={newRequest.reason}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Explain why additional material is needed (e.g., shortage discovered, damaged material, etc.)"
                      rows={3}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-4">
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitRequest}
                    disabled={createRequestMutation.isPending}
                  >
                    {createRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {materialRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>No material requests found</p>
              <p className="text-sm mt-1">Create a request when you need additional materials for production</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Production Order</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Requested Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {request.production_orders?.voucher_number}
                    </TableCell>
                    <TableCell>
                      {request.production_orders?.products?.name}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.raw_materials?.material_code}</p>
                        <p className="text-sm text-muted-foreground">{request.raw_materials?.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {request.requested_quantity} units
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{request.reason}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(request.status) as any}>
                        {request.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MaterialRequests;
