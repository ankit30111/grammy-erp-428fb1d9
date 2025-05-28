
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Package, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const MaterialRequests = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    productionOrderId: '',
    rawMaterialId: '',
    requestedQuantity: 0,
    reason: ''
  });

  const { data: materialRequests = [] } = useQuery({
    queryKey: ["material-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("material_requests")
        .select(`
          *,
          production_orders!inner(voucher_number),
          raw_materials!inner(name, material_code)
        `)
        .order("created_at", { ascending: false });
      
      return data || [];
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'default';
      case 'REJECTED': return 'destructive';
      case 'PENDING': return 'warning';
      default: return 'secondary';
    }
  };

  const getReasonIcon = (reason: string) => {
    return reason === 'shortage' ? 
      <Package className="h-4 w-4" /> : 
      <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Material Requests ({materialRequests.length})
          </CardTitle>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        </CardHeader>
        <CardContent>
          {showCreateForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Create Material Request</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Production Order</label>
                    <Input
                      value={newRequest.productionOrderId}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, productionOrderId: e.target.value }))}
                      placeholder="Select production order"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Raw Material</label>
                    <Input
                      value={newRequest.rawMaterialId}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, rawMaterialId: e.target.value }))}
                      placeholder="Select raw material"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Requested Quantity</label>
                    <Input
                      type="number"
                      value={newRequest.requestedQuantity}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, requestedQuantity: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Reason</label>
                    <Textarea
                      value={newRequest.reason}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Reason for material request"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-4">
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                  <Button>
                    Submit Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {materialRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No material requests found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Production Order</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.id.slice(0, 8)}</TableCell>
                    <TableCell>{request.production_orders?.voucher_number}</TableCell>
                    <TableCell>{request.raw_materials?.name}</TableCell>
                    <TableCell>{request.requested_quantity}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(request.status) as any}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {request.status === 'PENDING' && (
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      )}
                      {request.status === 'APPROVED' && (
                        <Button size="sm" variant="outline">
                          View
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
    </div>
  );
};

export default MaterialRequests;
