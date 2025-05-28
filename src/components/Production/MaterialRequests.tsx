
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MaterialShortageRequest, mockMaterialRequests, mockReceivedKits } from "@/types/production";
import { Plus, Package, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function MaterialRequests() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<MaterialShortageRequest[]>(mockMaterialRequests);
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [newRequest, setNewRequest] = useState<{
    voucherNumber: string;
    partCode: string;
    description: string;
    requiredQuantity: number;
    reason: "SHORT_MATERIAL" | "DAMAGED_MATERIAL";
    notes: string;
  }>({
    voucherNumber: "",
    partCode: "",
    description: "",
    requiredQuantity: 0,
    reason: "SHORT_MATERIAL",
    notes: ""
  });

  // Get available vouchers and their BOM items
  const availableVouchers = mockReceivedKits.filter(kit => kit.verificationStatus === "VERIFIED");
  const selectedVoucherKit = availableVouchers.find(kit => kit.voucherNumber === newRequest.voucherNumber);

  const handleSubmitRequest = () => {
    if (!newRequest.voucherNumber || !newRequest.partCode || newRequest.requiredQuantity <= 0) {
      toast({
        title: "Invalid Request",
        description: "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }

    const request: MaterialShortageRequest = {
      id: `MSR-${String(requests.length + 1).padStart(3, '0')}`,
      voucherNumber: newRequest.voucherNumber,
      partCode: newRequest.partCode,
      description: newRequest.description,
      requiredQuantity: newRequest.requiredQuantity,
      reason: newRequest.reason,
      requestDate: new Date().toISOString().split('T')[0],
      status: "PENDING",
      notes: newRequest.notes
    };

    setRequests(prev => [...prev, request]);
    setNewRequest({
      voucherNumber: "",
      partCode: "",
      description: "",
      requiredQuantity: 0,
      reason: "SHORT_MATERIAL",
      notes: ""
    });
    setShowNewRequestForm(false);

    toast({
      title: "Material Request Submitted",
      description: "Your material request has been sent to the store team",
    });
  };

  const getStatusBadge = (status: MaterialShortageRequest["status"]) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const getReasonBadge = (reason: MaterialShortageRequest["reason"]) => {
    switch (reason) {
      case "SHORT_MATERIAL":
        return <Badge variant="outline" className="text-blue-800 border-blue-300">Short Material</Badge>;
      case "DAMAGED_MATERIAL":
        return <Badge variant="outline" className="text-red-800 border-red-300">Damaged Material</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Material Requests</h3>
        <Button onClick={() => setShowNewRequestForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* New Request Form */}
      {showNewRequestForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Material Request</CardTitle>
            <CardDescription>
              Request additional materials for shortage or damage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Voucher Number</label>
                <Select value={newRequest.voucherNumber} onValueChange={(value) => setNewRequest(prev => ({ ...prev, voucherNumber: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select voucher" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVouchers.map(kit => (
                      <SelectItem key={kit.voucherNumber} value={kit.voucherNumber}>
                        {kit.voucherNumber} - {kit.modelName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Reason</label>
                <Select value={newRequest.reason} onValueChange={(value: "SHORT_MATERIAL" | "DAMAGED_MATERIAL") => setNewRequest(prev => ({ ...prev, reason: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHORT_MATERIAL">Short Material</SelectItem>
                    <SelectItem value="DAMAGED_MATERIAL">Damaged Material</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedVoucherKit && (
                <div>
                  <label className="text-sm font-medium">Part Code</label>
                  <Select value={newRequest.partCode} onValueChange={(value) => {
                    const selectedItem = selectedVoucherKit.bomItems.find(item => item.partCode === value);
                    setNewRequest(prev => ({ 
                      ...prev, 
                      partCode: value,
                      description: selectedItem?.description || ""
                    }));
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select part" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedVoucherKit.bomItems.map(item => (
                        <SelectItem key={item.partCode} value={item.partCode}>
                          {item.partCode} - {item.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Required Quantity</label>
                <Input
                  type="number"
                  value={newRequest.requiredQuantity || ""}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, requiredQuantity: parseInt(e.target.value) || 0 }))}
                  placeholder="Enter quantity"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={newRequest.notes}
                onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Provide additional details about the request..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowNewRequestForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitRequest}>
                Submit Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Material Request History</CardTitle>
          <CardDescription>
            Track status of all material requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length > 0 ? (
                  requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.id}</TableCell>
                      <TableCell>{format(new Date(request.requestDate), "MMM dd, yyyy")}</TableCell>
                      <TableCell>{request.voucherNumber}</TableCell>
                      <TableCell className="font-mono">{request.partCode}</TableCell>
                      <TableCell>{request.description}</TableCell>
                      <TableCell>{request.requiredQuantity}</TableCell>
                      <TableCell>{getReasonBadge(request.reason)}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="max-w-xs truncate">{request.notes}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-32 text-muted-foreground">
                      No material requests found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
