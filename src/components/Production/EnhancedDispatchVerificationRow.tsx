
import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertTriangle, Eye } from "lucide-react";
import { format } from "date-fns";

interface EnhancedDispatchVerificationRowProps {
  materialData: {
    rawMaterial: any;
    bomItem: any;
    dispatches: any[];
    requiredQuantity: number;
  };
  onVerify: (kitItemId: string, receivedQuantity: number, notes: string) => void;
  isProcessing: boolean;
}

const EnhancedDispatchVerificationRow = ({ 
  materialData, 
  onVerify, 
  isProcessing 
}: EnhancedDispatchVerificationRowProps) => {
  const [verificationInputs, setVerificationInputs] = useState<Record<string, { quantity: string; notes: string }>>({});
  const [showDispatchHistory, setShowDispatchHistory] = useState(false);

  const { rawMaterial, bomItem, dispatches, requiredQuantity } = materialData;

  // Calculate totals
  const totalSent = dispatches.reduce((sum, dispatch) => sum + dispatch.actual_quantity, 0);
  const totalReceived = dispatches
    .filter(dispatch => dispatch.verified_by_production)
    .reduce((sum, dispatch) => sum + dispatch.actual_quantity, 0);
  const pendingQuantity = Math.max(0, requiredQuantity - totalReceived);

  const handleVerificationInputChange = (kitItemId: string, field: 'quantity' | 'notes', value: string) => {
    setVerificationInputs(prev => ({
      ...prev,
      [kitItemId]: {
        ...prev[kitItemId],
        [field]: value
      }
    }));
  };

  const handleVerify = (kitItemId: string, sentQuantity: number) => {
    const input = verificationInputs[kitItemId];
    const receivedQuantity = parseInt(input?.quantity || '0');
    const notes = input?.notes || '';

    // Validation
    if (receivedQuantity <= 0) {
      alert('Please enter a valid received quantity');
      return;
    }

    // Check if receiving this quantity would exceed required amount
    const newTotalReceived = totalReceived + receivedQuantity;
    if (newTotalReceived > requiredQuantity) {
      alert(`Cannot receive ${receivedQuantity}. This would exceed required quantity. Maximum allowed: ${requiredQuantity - totalReceived}`);
      return;
    }

    if (receivedQuantity > sentQuantity) {
      alert(`Cannot receive more than sent quantity (${sentQuantity})`);
      return;
    }

    onVerify(kitItemId, receivedQuantity, notes);
    
    // Clear inputs after verification
    setVerificationInputs(prev => ({
      ...prev,
      [kitItemId]: { quantity: '', notes: '' }
    }));
  };

  // Group dispatches by verification status
  const unverifiedDispatches = dispatches.filter(dispatch => !dispatch.verified_by_production);
  const verifiedDispatches = dispatches.filter(dispatch => dispatch.verified_by_production);

  return (
    <>
      <TableRow>
        <TableCell className="font-mono">{rawMaterial.material_code}</TableCell>
        <TableCell>{rawMaterial.name}</TableCell>
        <TableCell className="font-semibold">{requiredQuantity}</TableCell>
        <TableCell className="text-blue-600 font-medium">
          {totalSent}
          <div className="text-xs text-muted-foreground">
            {dispatches.length} dispatch(es)
          </div>
        </TableCell>
        <TableCell className="text-green-600 font-medium">
          {totalReceived}
          <div className="text-xs text-muted-foreground">
            {verifiedDispatches.length} verified
          </div>
        </TableCell>
        <TableCell className="font-medium">
          {pendingQuantity > 0 ? (
            <span className="text-orange-600">{pendingQuantity}</span>
          ) : (
            <span className="text-green-600">Complete</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-2">
            <Dialog open={showDispatchHistory} onOpenChange={setShowDispatchHistory}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Eye className="h-3 w-3" />
                  View Dispatches
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Dispatch History - {rawMaterial.material_code}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Required</p>
                      <p className="text-lg font-semibold">{requiredQuantity}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Sent</p>
                      <p className="text-lg font-semibold text-blue-600">{totalSent}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Received</p>
                      <p className="text-lg font-semibold text-green-600">{totalReceived}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-lg font-semibold text-orange-600">{pendingQuantity}</p>
                    </div>
                  </div>

                  {/* Unverified Dispatches */}
                  {unverifiedDispatches.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-orange-600 mb-3">Pending Verification ({unverifiedDispatches.length})</h4>
                      <div className="space-y-3">
                        {unverifiedDispatches.map((dispatch) => (
                          <div key={dispatch.id} className="border rounded-lg p-4 bg-orange-50">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-medium">Dispatch ID: {dispatch.id.slice(0, 8)}</p>
                                <p className="text-sm text-muted-foreground">
                                  Sent: {format(new Date(dispatch.created_at), "PPP 'at' p")}
                                </p>
                                <p className="text-sm">Quantity Sent: <span className="font-medium">{dispatch.actual_quantity}</span></p>
                              </div>
                              <Badge variant="secondary">Pending Verification</Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor={`quantity-${dispatch.id}`}>Quantity Received</Label>
                                <Input
                                  id={`quantity-${dispatch.id}`}
                                  type="number"
                                  min="0"
                                  max={Math.min(dispatch.actual_quantity, pendingQuantity + (parseInt(verificationInputs[dispatch.id]?.quantity || '0') || 0))}
                                  value={verificationInputs[dispatch.id]?.quantity || ''}
                                  onChange={(e) => handleVerificationInputChange(dispatch.id, 'quantity', e.target.value)}
                                  placeholder="Enter received quantity"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`notes-${dispatch.id}`}>Notes (Optional)</Label>
                                <Textarea
                                  id={`notes-${dispatch.id}`}
                                  value={verificationInputs[dispatch.id]?.notes || ''}
                                  onChange={(e) => handleVerificationInputChange(dispatch.id, 'notes', e.target.value)}
                                  placeholder="Any discrepancy notes..."
                                  rows={2}
                                />
                              </div>
                            </div>
                            
                            <Button
                              onClick={() => handleVerify(dispatch.id, dispatch.actual_quantity)}
                              disabled={isProcessing || !verificationInputs[dispatch.id]?.quantity}
                              className="mt-3 gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              {isProcessing ? "Verifying..." : "Verify Receipt"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verified Dispatches */}
                  {verifiedDispatches.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-green-600 mb-3">Verified Dispatches ({verifiedDispatches.length})</h4>
                      <div className="space-y-3">
                        {verifiedDispatches.map((dispatch) => (
                          <div key={dispatch.id} className="border rounded-lg p-4 bg-green-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">Dispatch ID: {dispatch.id.slice(0, 8)}</p>
                                <p className="text-sm text-muted-foreground">
                                  Sent: {format(new Date(dispatch.created_at), "PPP 'at' p")}
                                </p>
                                <p className="text-sm">
                                  Sent: <span className="font-medium">{dispatch.actual_quantity}</span> | 
                                  Received: <span className="font-medium text-green-600">{dispatch.actual_quantity}</span>
                                </p>
                              </div>
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {dispatches.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
                      <p>No dispatches found for this material</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </TableCell>
      </TableRow>
    </>
  );
};

export default EnhancedDispatchVerificationRow;
