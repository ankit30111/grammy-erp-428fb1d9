
import { ArrowRight, ArrowLeft, Plus, RotateCcw, Package, AlertCircle, CheckCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const getMovementIcon = (type: string) => {
  switch (type) {
    case "ISSUED_TO_PRODUCTION":
      return <ArrowRight className="h-4 w-4 text-primary" />;
    case "PRODUCTION_RETURN":
    case "PRODUCTION_FEEDBACK_RETURN":
      return <ArrowLeft className="h-4 w-4 text-success" />;
    case "GRN_RECEIPT":
      return <Plus className="h-4 w-4 text-success" />;
    case "MATERIAL_REQUEST_CREATED":
      return <AlertCircle className="h-4 w-4 text-warning" />;
    case "PRODUCTION_DISCREPANCY_REJECTED":
      return <X className="h-4 w-4 text-destructive" />;
    case "STOCK_ADJUSTMENT":
      return <RotateCcw className="h-4 w-4 text-purple-600" />;
    default:
      return <Package className="h-4 w-4 text-muted-foreground" />;
  }
};

export const getMovementBadge = (type: string) => {
  switch (type) {
    case "ISSUED_TO_PRODUCTION":
      return <Badge variant="default">Issued to Production</Badge>;
    case "PRODUCTION_RETURN":
      return <Badge variant="secondary">Production Return</Badge>;
    case "PRODUCTION_FEEDBACK_RETURN":
      return <Badge className="bg-success-wash text-success">Feedback Return</Badge>;
    case "GRN_RECEIPT":
      return <Badge className="bg-success-wash text-success">GRN Receipt</Badge>;
    case "MATERIAL_REQUEST_CREATED":
      return <Badge className="bg-warning-wash text-warning">Material Request</Badge>;
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

/**
 * Direction comes from the ledger's signed qty_delta, not from guessing at the
 * movement type string. Positive = into stock, negative = out of stock.
 */
export const getQuantityStyle = (qtyDelta: number) =>
  qtyDelta > 0 ? 'text-success' : 'text-primary';

export const getQuantityPrefix = (qtyDelta: number) => (qtyDelta > 0 ? '+' : '-');
