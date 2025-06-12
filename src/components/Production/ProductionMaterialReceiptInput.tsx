import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, Package } from "lucide-react";

interface ProductionMaterialReceiptInputProps {
  materialCode: string;
  materialName: string;
  requiredQuantity: number;
  sentQuantity: number;
  receivedQuantity: number;
  onReceiptLog: (quantity: number, notes?: string) => void;
  isLogging: boolean;
}

export default function ProductionMaterialReceiptInput({
  materialCode,
  materialName,
  requiredQuantity,
  sentQuantity,
  receivedQuantity,
  onReceiptLog,
  isLogging
}: ProductionMaterialReceiptInputProps) {
  const [inputQuantity, setInputQuantity] = useState<string>("");
  const [notes, setNotes] = useState("");

  const remainingQuantity = Math.max(0, sentQuantity - receivedQuantity);
  const isFullyReceived = receivedQuantity >= sentQuantity;
  const isOverReceived = receivedQuantity > sentQuantity;
  const willCreateDiscrepancy = inputQuantity && parseInt(inputQuantity) !== remainingQuantity;

  const handleSubmit = () => {
    const quantity = parseInt(inputQuantity);
    if (quantity > 0) {
      onReceiptLog(quantity, notes.trim() || undefined);
      setInputQuantity("");
      setNotes("");
    }
  };

  const getStatusBadge = () => {
    if (isOverReceived) {
      return <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Over Received
      </Badge>;
    }
    if (isFullyReceived) {
      return <Badge className="bg-green-100 text-green-800 gap-1">
        <CheckCircle className="h-3 w-3" />
        Fully Received
      </Badge>;
    }
    if (receivedQuantity > 0) {
      return <Badge variant="secondary" className="gap-1">
        <Package className="h-3 w-3" />
        Partially Received
      </Badge>;
    }
    return <Badge variant="outline">Awaiting Receipt</Badge>;
  };

  const getDiscrepancyWarning = () => {
    if (!inputQuantity || !willCreateDiscrepancy) return null;

    const quantity = parseInt(inputQuantity);
    const expectedQuantity = remainingQuantity;
    const discrepancyType = quantity > expectedQuantity ? 'EXCESS' : 'SHORTAGE';
    const discrepancyAmount = Math.abs(quantity - expectedQuantity);

    return (
      <Alert className="border-orange-200 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>Quantity Mismatch Detected:</strong> {discrepancyType.toLowerCase()} of {discrepancyAmount} units.
          This will create a discrepancy record for store review.
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium text-sm">{materialCode}</div>
          <div className="text-xs text-muted-foreground">{materialName}</div>
        </div>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Required:</span>
          <div className="font-medium">{requiredQuantity}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Sent:</span>
          <div className="font-medium text-blue-600">{sentQuantity}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Received:</span>
          <div className={`font-medium ${isOverReceived ? 'text-red-600' : receivedQuantity > 0 ? 'text-green-600' : 'text-gray-500'}`}>
            {receivedQuantity}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Remaining:</span>
          <div className="font-medium text-orange-600">{remainingQuantity}</div>
        </div>
      </div>

      {!isFullyReceived && (
        <div className="space-y-2">
          {getDiscrepancyWarning()}
          
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Enter actual qty received"
              value={inputQuantity}
              onChange={(e) => setInputQuantity(e.target.value)}
              min={1}
              className="flex-1"
              disabled={isLogging}
            />
            <Button 
              size="sm" 
              onClick={handleSubmit}
              disabled={!inputQuantity || parseInt(inputQuantity) <= 0 || isLogging}
              className="gap-1"
            >
              {isLogging ? (
                "Logging..."
              ) : (
                <>
                  <CheckCircle className="h-3 w-3" />
                  Log Receipt
                </>
              )}
            </Button>
          </div>
          <Input
            placeholder="Add notes (optional, required for discrepancies)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-xs"
            disabled={isLogging}
          />
          <div className="text-xs text-muted-foreground">
            Expected: {remainingQuantity} units. Enter actual quantity received by production.
          </div>
        </div>
      )}

      {isFullyReceived && !isOverReceived && (
        <div className="text-xs text-green-600 font-medium">
          ✓ All materials received successfully
        </div>
      )}

      {isOverReceived && (
        <div className="text-xs text-red-600 font-medium">
          ⚠️ Over received by {receivedQuantity - sentQuantity} units - discrepancy created for store review
        </div>
      )}
    </div>
  );
}
