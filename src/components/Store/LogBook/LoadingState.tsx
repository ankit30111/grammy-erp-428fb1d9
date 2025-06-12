
import { Package } from "lucide-react";

export const LoadingState = () => {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
        <p className="text-muted-foreground">Loading material movements...</p>
      </div>
    </div>
  );
};
