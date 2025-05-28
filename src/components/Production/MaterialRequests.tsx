
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Package, Plus } from "lucide-react";
import { mockMaterialRequests } from "@/types/production";
import { useState } from "react";

const MaterialRequests = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    voucherNumber: '',
    partCode: '',
    description: '',
    requiredQuantity: 0,
    reason: 'SHORT_MATERIAL' as 'SHORT_MATERIAL' | 'DAMAGED_MATERIAL',
    notes: ''
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
    return reason === 'SHORT_MATERIAL' ? 
      <Package className="h-4 w-4" /> : 
      <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Material Requests ({mockMaterialRequests.length})
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Voucher Number</label>
                    <Input
                      value={newRequest.voucherNumber}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, voucherNumber: e.target.value }))}
                      placeholder="e.g., 05-01"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Part Code</label>
                    <Input
                      value={newRequest.partCode}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, partCode: e.target.value }))}
                      placeholder="e.g., PCB-123"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={newRequest.description}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Component description"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Required Quantity</label>
                    <Input
                      type="number"
                      value={newRequest.requiredQuantity}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, requiredQuantity: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Reason</label>
                    <Select
                      value={newRequest.reason}
                      onValueChange={(value: 'SHORT_MATERIAL' | 'DAMAGED_MATERIAL') => setNewRequest(prev => ({ ...prev, reason: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SHORT_MATERIAL">Short Material</SelectItem>
                        <SelectItem value="DAMAGED_MATERIAL">Damaged Material</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={newRequest.notes}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional details about the request"
                  />
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
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request ID</TableHead>
                <TableHead>Voucher</TableHead>
                <TableHead>Part Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockMaterialRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.id}</TableCell>
                  <TableCell>{request.voucherNumber}</TableCell>
                  <TableCell>{request.partCode}</TableCell>
                  <TableCell>{request.description}</TableCell>
                  <TableCell>{request.requiredQuantity}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getReasonIcon(request.reason)}
                      {request.reason === 'SHORT_MATERIAL' ? 'Short Material' : 'Damaged Material'}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(request.requestDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(request.status) as any}>
                      {request.status}
                    </Badge>
                  </TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default MaterialRequests;
