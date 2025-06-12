
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Download, Search, TrendingDown, TrendingUp, BookOpen, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MaterialMovement {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  reference_number: string;
  material_code: string;
  material_name: string;
  quantity: number;
  source_destination: string;
  handled_by: string;
  notes?: string;
}

const LogBook = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ENHANCED: Fetch material movements from multiple sources with real-time updates
  const { data: movements = [], isLoading, refetch } = useQuery({
    queryKey: ["material-movements-logbook"],
    queryFn: async () => {
      console.log("📚 FETCHING COMPREHENSIVE MATERIAL MOVEMENTS FOR LOGBOOK...");
      const movements: MaterialMovement[] = [];

      // CRITICAL: Fetch from material_movements table (includes dispatches)
      console.log("📋 Fetching from material_movements table...");
      const { data: movementData, error: movementError } = await supabase
        .from("material_movements")
        .select(`
          *,
          raw_materials(material_code, name)
        `)
        .order("created_at", { ascending: false });

      if (movementError) {
        console.error("❌ Error fetching material movements:", movementError);
        throw movementError;
      }

      console.log("📦 Material movements found:", movementData?.length || 0);

      // Process material movements (store dispatches and other movements)
      movementData?.forEach((item) => {
        movements.push({
          id: item.id,
          date: item.created_at,
          type: item.movement_type === 'ISSUED_TO_PRODUCTION' ? 'OUT' : 'IN',
          reference_number: item.reference_number || 'N/A',
          material_code: item.raw_materials?.material_code || "Unknown",
          material_name: item.raw_materials?.name || "Unknown Material",
          quantity: item.quantity,
          source_destination: item.movement_type === 'ISSUED_TO_PRODUCTION' ? 'Production' : (item.issued_to || "Unknown"),
          handled_by: "Store Team",
          notes: item.notes || `${item.movement_type} movement`
        });
      });

      // Fetch GRN receipts (Material IN)
      console.log("📋 Fetching GRN receipts...");
      const { data: grnData, error: grnError } = await supabase
        .from("grn_items")
        .select(`
          *,
          grn!inner(
            grn_number,
            received_date,
            purchase_orders(po_number),
            vendors(name)
          ),
          raw_materials(material_code, name)
        `)
        .eq("store_confirmed", true)
        .order("store_confirmed_at", { ascending: false });

      if (grnError) {
        console.error("❌ Error fetching GRN data:", grnError);
        throw grnError;
      }

      console.log("📦 GRN items found:", grnData?.length || 0);

      // Process GRN data
      grnData?.forEach((item) => {
        movements.push({
          id: `grn-${item.id}`,
          date: item.store_confirmed_at || item.grn.received_date,
          type: 'IN',
          reference_number: `${item.grn.grn_number} / ${item.grn.purchase_orders?.po_number || 'N/A'}`,
          material_code: item.raw_materials?.material_code || "Unknown",
          material_name: item.raw_materials?.name || "Unknown Material",
          quantity: item.accepted_quantity || 0,
          source_destination: item.grn.vendors?.name || "Unknown Vendor",
          handled_by: "Store Team",
          notes: `GRN Receipt - Accepted: ${item.accepted_quantity}, Rejected: ${item.rejected_quantity || 0}`
        });
      });

      // Sort by date (newest first)
      const sortedMovements = movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      console.log("📚 TOTAL MOVEMENTS PROCESSED:", sortedMovements.length);
      console.log("📊 MOVEMENT BREAKDOWN:", {
        total: sortedMovements.length,
        incoming: sortedMovements.filter(m => m.type === 'IN').length,
        outgoing: sortedMovements.filter(m => m.type === 'OUT').length
      });

      return sortedMovements;
    },
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });

  const filteredMovements = movements.filter(movement => {
    const matchesSearch = 
      movement.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.reference_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.source_destination.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === "ALL" || movement.type === filterType;
    
    const movementDate = new Date(movement.date);
    const matchesDateFrom = !dateFrom || movementDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || movementDate <= new Date(dateTo);
    
    return matchesSearch && matchesType && matchesDateFrom && matchesDateTo;
  });

  const getMovementTypeColor = (type: string) => {
    return type === 'IN' ? "default" : "secondary";
  };

  const getMovementIcon = (type: string) => {
    return type === 'IN' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const handleExport = () => {
    // Simple CSV export
    const headers = [
      "Date", "Type", "Reference", "Material Code", "Material Name", 
      "Quantity", "Source/Destination", "Handled By", "Notes"
    ];
    
    const csvData = [
      headers.join(","),
      ...filteredMovements.map(movement => [
        format(new Date(movement.date), "yyyy-MM-dd HH:mm:ss"),
        movement.type,
        movement.reference_number,
        movement.material_code,
        movement.material_name,
        movement.quantity,
        movement.source_destination,
        movement.handled_by,
        movement.notes || ""
      ].map(field => `"${field}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `material-movements-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Loading material movements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Material Movement Log Book ({filteredMovements.length} entries)
            </div>
            <div className="flex gap-2">
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search materials, reference, source..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="IN">Received</SelectItem>
                <SelectItem value="OUT">Issued</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                placeholder="From Date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                placeholder="To Date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36"
              />
            </div>
          </div>

          {/* Enhanced Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="flex items-center p-4">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Materials Received</p>
                  <p className="text-2xl font-bold text-green-600">
                    {movements.filter(m => m.type === 'IN').length}
                  </p>
                  <p className="text-xs text-gray-500">Total incoming transactions</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center p-4">
                <TrendingDown className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Materials Issued</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {movements.filter(m => m.type === 'OUT').length}
                  </p>
                  <p className="text-xs text-gray-500">Dispatched to production</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center p-4">
                <Calendar className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Transactions</p>
                  <p className="text-2xl font-bold text-purple-600">{movements.length}</p>
                  <p className="text-xs text-gray-500">All material movements</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Movements Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Source/Destination</TableHead>
                  <TableHead>Handled By</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm">
                        {format(new Date(movement.date), "MMM dd, yyyy")}
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(movement.date), "HH:mm:ss")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getMovementTypeColor(movement.type) as any} className="gap-1">
                        {getMovementIcon(movement.type)}
                        {movement.type === 'IN' ? 'Received' : 'Issued'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{movement.reference_number}</TableCell>
                    <TableCell className="font-mono font-medium">{movement.material_code}</TableCell>
                    <TableCell>{movement.material_name}</TableCell>
                    <TableCell className="font-medium">
                      <span className={movement.type === 'IN' ? "text-green-600" : "text-blue-600"}>
                        {movement.type === 'IN' ? '+' : '-'}{movement.quantity}
                      </span>
                    </TableCell>
                    <TableCell>{movement.source_destination}</TableCell>
                    <TableCell>{movement.handled_by}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {movement.notes}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredMovements.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="mx-auto h-12 w-12 opacity-50 mb-4" />
              <p>No material movements found</p>
              <p className="text-sm">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LogBook;
