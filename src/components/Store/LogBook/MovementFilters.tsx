
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface MovementFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: string;
  onFilterChange: (value: string) => void;
  totalMovements: number;
  onRefresh: () => void;
}

export const MovementFilters = ({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  totalMovements,
  onRefresh,
}: MovementFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1">
        <Input
          placeholder="Search by material code, name, reference, or notes..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="flex gap-2">
        <Select value={filterType} onValueChange={onFilterChange}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Movements ({totalMovements})</SelectItem>
            <SelectItem value="ISSUED_TO_PRODUCTION">Issued to Production</SelectItem>
            <SelectItem value="PRODUCTION_RETURN">Production Returns</SelectItem>
            <SelectItem value="PRODUCTION_FEEDBACK_RETURN">Feedback Returns</SelectItem>
            <SelectItem value="GRN_RECEIPT">GRN Receipts</SelectItem>
            <SelectItem value="STOCK_ADJUSTMENT">Stock Adjustments</SelectItem>
            <SelectItem value="STOCK_RECONCILIATION">Stock Reconciliation</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>
    </div>
  );
};
