
import { ArrowRight, ArrowLeft, Plus, RotateCcw, Package, AlertCircle, CheckCircle, X } from "lucide-react";
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
    case "MATERIAL_REQUEST_CREATED":
      return <AlertCircle className="h-4 w-4 text-orange-600" />;
    case "PRODUCTION_DISCREPANCY_REJECTED":
      return <X className="h-4 w-4 text-red-600" />;
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
      return <Badge className="bg-green-100 text-green-800">Feedback Return</Badge>;
    case "GRN_RECEIPT":
      return <Badge className="bg-green-100 text-green-800">GRN Receipt</Badge>;
    case "MATERIAL_REQUEST_CREATED":
      return <Badge className="bg-orange-100 text-orange-800">Material Request</Badge>;
    case "PRODUCTION_DISCREPANCY_REJECTED":
      return <Badge variant="destructive">Discrepancy Rejected</Badge>;
    case "STOCK_ADJUSTMENT":
      return <Badge variant="secondary">Stock Adjustment</Badge>;
    case "STOCK_RECONCILIATION":
      return <Badge variant="outline">Stock Reconciliation</Badge>;
    default:
      return <Badge variant="outline">{type.replace(/_/g, ' ')}</Badge>;
  }
};

export const getQuantityStyle = (movementType: string) => {
  const returnTypes = ['PRODUCTION_RETURN', 'PRODUCTION_FEEDBACK_RETURN', 'GRN_RECEIPT'];
  const requestTypes = ['MATERIAL_REQUEST_CREATED'];
  
  if (returnTypes.some(t => movementType.includes(t))) {
    return 'text-green-600';
  } else if (requestTypes.some(t => movementType.includes(t))) {
    return 'text-orange-600';
  } else {
    return 'text-blue-600';
  }
};

export const getQuantityPrefix = (movementType: string) => {
  const returnTypes = ['PRODUCTION_RETURN', 'PRODUCTION_FEEDBACK_RETURN', 'GRN_RECEIPT'];
  const requestTypes = ['MATERIAL_REQUEST_CREATED', 'PRODUCTION_DISCREPANCY_REJECTED'];
  
  if (returnTypes.some(t => movementType.includes(t))) {
    return '+';
  } else if (requestTypes.some(t => movementType.includes(t))) {
    return '±';
  } else {
    return '-';
  }
};
