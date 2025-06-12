
import { Package } from "lucide-react";

interface EmptyStateProps {
  totalMovements: number;
}

export const EmptyState = ({ totalMovements }: EmptyStateProps) => {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
      <p>No material movements found</p>
      <p className="text-sm mt-1">
        {totalMovements === 0 
          ? "Material movements will appear here as they occur (GRN receipts, production dispatch, returns, etc.)"
          : "Try adjusting your search or filter criteria"
        }
      </p>
    </div>
  );
};
