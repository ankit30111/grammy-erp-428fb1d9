
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search } from "lucide-react";

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
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by material code, name, reference, movement type, or notes..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex gap-2">
        <Select value={filterType} onValueChange={onFilterChange}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Movements ({totalMovements})</SelectItem>
            <SelectItem value="ISSUED_TO_PRODUCTION">Issued to Production</SelectItem>
            <SelectItem value="PRODUCTION_RETURN">Production Returns</SelectItem>
            <SelectItem value="PRODUCTION_FEEDBACK_RETURN">Feedback Returns</SelectItem>
            <SelectItem value="GRN_RECEIPT">GRN Receipts</SelectItem>
            <SelectItem value="MATERIAL_REQUEST_CREATED">Material Requests</SelectItem>
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
