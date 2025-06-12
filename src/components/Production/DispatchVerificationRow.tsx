
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, AlertTriangle, Package } from "lucide-react";

interface DispatchVerificationRowProps {
  kitItem: any;
  rawMaterial: any;
  requiredQuantity: number;
  onVerify: (kitItemId: string, receivedQuantity: number, notes: string) => void;
  isProcessing: boolean;
}

const DispatchVerificationRow = ({ 
  kitItem, 
  rawMaterial, 
  requiredQuantity, 
  onVerify, 
  isProcessing 
}: DispatchVerificationRowProps) => {
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [receivedQuantity, setReceivedQuantity] = useState(kitItem.actual_quantity);
  const [notes, setNotes] = useState("");

  const isVerified = kitItem.verified_by_production;
  const sentQuantity = kitItem.actual_quantity;
  const difference = sentQuantity - receivedQuantity;

  const handleVerify = () => {
    onVerify(kitItem.id, receivedQuantity, notes);
    setIsVerifyDialogOpen(false);
    setNotes("");
  };

  const getStatusBadge = () => {
    if (isVerified) {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Verified
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Package className="h-3 w-3" />
        Pending
      </Badge>
    );
  };

  const getDifferenceDisplay = () => {
    if (!isVerified && difference === 0) return "-";
    if (difference > 0) {
      return (
        <span className="text-green-600 font-medium">
          +{difference} (Return)
        </span>
      );
    } else if (difference < 0) {
      return (
        <span className="text-red-600 font-medium">
          {difference} (Shortage)
        </span>
      );
    }
    return <span className="text-gray-600">0</span>;
  };

  return (
    <TableRow className={isVerified ? "bg-green-50" : ""}>
      <TableCell className="font-mono">{rawMaterial.material_code}</TableCell>
      <TableCell>{rawMaterial.name}</TableCell>
      <TableCell className="font-semibold">{requiredQuantity}</TableCell>
      <TableCell className="font-medium text-blue-600">{sentQuantity}</TableCell>
      <TableCell className="font-medium">
        {isVerified ? receivedQuantity : "-"}
      </TableCell>
      <TableCell>{getDifferenceDisplay()}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {!isVerified && (
            <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Verify Quantity
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Verify Material Dispatch</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Material:</span>
                      <p className="font-medium">{rawMaterial.material_code}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sent Quantity:</span>
                      <p className="font-medium text-blue-600">{sentQuantity}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Actually Received</label>
                    <Input
                      type="number"
                      value={receivedQuantity}
                      onChange={(e) => setReceivedQuantity(Number(e.target.value))}
                      min="0"
                      max={sentQuantity}
                      className="mt-1"
                    />
                    {difference !== 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {difference > 0 
                          ? `${difference} units will be returned to inventory`
                          : `${Math.abs(difference)} units shortage will be logged`
                        }
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Notes (Optional)</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any notes about the verification..."
                      className="mt-1"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsVerifyDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleVerify}
                      disabled={isProcessing}
                    >
                      {isProcessing ? "Processing..." : "Verify & Update Inventory"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default DispatchVerificationRow;
