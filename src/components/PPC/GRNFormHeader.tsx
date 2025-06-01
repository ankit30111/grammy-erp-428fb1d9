
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Package, RefreshCw } from "lucide-react";

interface GRNFormHeaderProps {
  onRefresh: () => void;
  isLoading: boolean;
}

const GRNFormHeader = ({ onRefresh, isLoading }: GRNFormHeaderProps) => {
  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Create GRN (Goods Receipt Note)
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh POs
        </Button>
      </div>
    </CardHeader>
  );
};

export default GRNFormHeader;
