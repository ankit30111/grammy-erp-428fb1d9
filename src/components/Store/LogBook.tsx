
import { useState, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle } from "lucide-react";
import { MovementFilters } from "./LogBook/MovementFilters";
import { MovementTable } from "./LogBook/MovementTable";
import { EmptyState } from "./LogBook/EmptyState";
import { LoadingState } from "./LogBook/LoadingState";
import { useMovementData } from "./LogBook/useMovementData";

const LogBook = memo(() => {
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { movements, isLoading, refetch } = useMovementData(filterType);

  // Client-side filtering for search functionality
  const filteredMovements = movements.filter(movement => {
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      return (
        movement.raw_materials?.material_code?.toLowerCase().includes(search) ||
        movement.raw_materials?.name?.toLowerCase().includes(search) ||
        movement.reference_number?.toLowerCase().includes(search) ||
        movement.notes?.toLowerCase().includes(search) ||
        movement.movement_type?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Material Movement LogBook ({filteredMovements.length})
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Cleaned & Deduplicated
            </Badge>
            <Badge variant="secondary">Real-time Tracking</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MovementFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterType={filterType}
            onFilterChange={setFilterType}
            totalMovements={movements.length}
            onRefresh={refetch}
          />

          {filteredMovements.length === 0 ? (
            <EmptyState totalMovements={movements.length} />
          ) : (
            <MovementTable movements={filteredMovements} />
          )}
        </CardContent>
      </Card>
    </div>
  );
});

LogBook.displayName = "LogBook";

export default LogBook;
