
import { ArrowRight, ArrowLeft, Plus, RotateCcw, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const getMovementIcon = (type: string) => {
  switch (type) {
    case "ISSUED_TO_PRODUCTION":
      return <ArrowRight className="h-4 w-4 text-blue-600" />;
    case "PRODUCTION_RETURN":
    case "PRODUCTION_FEEDBACK_RETURN":
      return <ArrowLeft className="h-4 w-4 text-green-600" />;
    case "GRN_RECEIPT":
      return <Plus className="h-4 w-4 text-green-600" />;
    case "STOCK_ADJUSTMENT":
      return <RotateCcw className="h-4 w-4 text-purple-600" />;
    default:
      return <Package className="h-4 w-4 text-gray-600" />;
  }
};

export const getMovementBadge = (type: string) => {
  switch (type) {
    case "ISSUED_TO_PRODUCTION":
      return <Badge variant="default">Issued to Production</Badge>;
    case "PRODUCTION_RETURN":
      return <Badge variant="secondary">Production Return</Badge>;
    case "PRODUCTION_FEEDBACK_RETURN":
      return <Badge variant="outline">Feedback Return</Badge>;
    case "GRN_RECEIPT":
      return <Badge className="bg-green-100 text-green-800">GRN Receipt</Badge>;
    case "STOCK_ADJUSTMENT":
      return <Badge variant="secondary">Stock Adjustment</Badge>;
    case "STOCK_RECONCILIATION":
      return <Badge variant="outline">Stock Reconciliation</Badge>;
    default:
      return <Badge variant="outline">{type.replace('_', ' ')}</Badge>;
  }
};

export const getQuantityStyle = (movementType: string) => {
  return movementType.includes('RETURN') || movementType.includes('RECEIPT')
    ? 'text-green-600' 
    : 'text-blue-600';
};

export const getQuantityPrefix = (movementType: string) => {
  return movementType.includes('RETURN') || movementType.includes('RECEIPT') 
    ? '+' : '-';
};
