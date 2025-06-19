
import { Package } from "lucide-react";

interface GRNEmptyStateProps {
  title: string;
  description: string;
}

export const GRNEmptyState = ({ title, description }: GRNEmptyStateProps) => {
  return (
    <div className="text-center py-8">
      <Package className="h-12 w-12 text-green-500 mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};
