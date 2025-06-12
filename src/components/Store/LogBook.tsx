
import { useState, useEffect, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Package, ArrowRight, ArrowLeft, Plus, BookOpen, RefreshCw, RotateCcw } from "lucide-react";

interface MaterialMovement {
  id: string;
  created_at: string;
  movement_type: string;
  raw_material_id: string;
  quantity: number;
  reference_id: string;
  reference_type: string;
  reference_number: string;
  notes: string;
  raw_materials?: {
    material_code: string;
    name: string;
    category: string;
  };
}

const LogBook = memo(() => {
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Enhanced query with better performance and data fetching
  const { data: movements = [], isLoading, refetch } = useQuery({
    queryKey: ["material-movements-logbook", filterType],
    queryFn: async () => {
      console.log("🔍 Fetching ALL material movements for LogBook...", { filterType });
      
      let query = supabase
        .from("material_movements")
        .select(`
          id,
          created_at,
          movement_type,
          raw_material_id,
          quantity,
          reference_id,
          reference_type,
          reference_number,
          notes,
          raw_materials!inner(
            material_code,
            name,
            category
          )
        `)
        .order("created_at", { ascending: false });

      // Apply movement type filter
      if (filterType !== "all") {
        query = query.eq("movement_type", filterType);
      }

      const { data, error } = await query.limit(500); // Increased limit for complete view

      if (error) {
        console.error("❌ Error fetching movements:", error);
        throw error;
      }

      console.log("📋 Material movements fetched:", data?.length, "entries");
      
      // Ensure we're getting all types of movements
      const movementTypes = data?.map(m => m.movement_type) || [];
      const uniqueTypes = [...new Set(movementTypes)];
      console.log("📊 Movement types found:", uniqueTypes);
      
      return data || [];
    },
    refetchInterval: 5000, // Real-time updates
    staleTime: 2000,
  });

  // Auto-refresh when new materials are dispatched or received
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'material_dispatched' || e.key === 'material_received') {
        console.log("🔄 AUTO-REFRESH: Material movement detected");
        refetch();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refetch]);

  const getMovementIcon = (type: string) => {
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

  const getMovementBadge = (type: string) => {
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

  // Client-side filtering for better performance
  const filteredMovements = movements.filter(movement => {
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      return (
        movement.raw_materials?.material_code?.toLowerCase().includes(search) ||
        movement.raw_materials?.name?.toLowerCase().includes(search) ||
        movement.reference_number?.toLowerCase().includes(search) ||
        movement.notes?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2 animate-pulse" />
          <p className="text-muted-foreground">Loading material movements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Material Movement LogBook ({filteredMovements.length})
            <Badge variant="outline">Real-time Tracking</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="ml-auto gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Enhanced Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search by material code, name, reference, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Movements ({movements.length})</SelectItem>
                <SelectItem value="ISSUED_TO_PRODUCTION">Issued to Production</SelectItem>
                <SelectItem value="PRODUCTION_RETURN">Production Returns</SelectItem>
                <SelectItem value="PRODUCTION_FEEDBACK_RETURN">Feedback Returns</SelectItem>
                <SelectItem value="GRN_RECEIPT">GRN Receipts</SelectItem>
                <SelectItem value="STOCK_ADJUSTMENT">Stock Adjustments</SelectItem>
                <SelectItem value="STOCK_RECONCILIATION">Stock Reconciliation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Movement History */}
          {filteredMovements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
              <p>No material movements found</p>
              <p className="text-sm mt-1">
                {movements.length === 0 
                  ? "Material movements will appear here as they occur (GRN receipts, production dispatch, returns, etc.)"
                  : "Try adjusting your search or filter criteria"
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getMovementIcon(movement.movement_type)}
                          <div>
                            <p className="font-medium">
                              {format(new Date(movement.created_at), "MMM dd, yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(movement.created_at), "HH:mm:ss")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getMovementBadge(movement.movement_type)}</TableCell>
                      <TableCell className="font-mono font-medium">
                        {movement.raw_materials?.material_code}
                      </TableCell>
                      <TableCell>{movement.raw_materials?.name}</TableCell>
                      <TableCell className="font-semibold">
                        <span className={
                          movement.movement_type.includes('RETURN') || movement.movement_type.includes('RECEIPT')
                            ? 'text-green-600' 
                            : 'text-blue-600'
                        }>
                          {movement.movement_type.includes('RETURN') || movement.movement_type.includes('RECEIPT') 
                            ? '+' : '-'}{movement.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{movement.reference_type}</p>
                          <p className="text-xs text-muted-foreground">{movement.reference_number}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm truncate" title={movement.notes}>
                          {movement.notes}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

LogBook.displayName = "LogBook";

export default LogBook;
