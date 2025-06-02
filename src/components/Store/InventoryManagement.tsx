
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Package, MapPin, AlertTriangle, TrendingDown, TrendingUp, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/custom/StatusBadge";
import { useInventory, useManualInventorySync } from "@/hooks/useInventory";
import { useToast } from "@/hooks/use-toast";

export default function InventoryManagement() {
  const { data: inventory = [], isLoading, refetch } = useInventory();
  const manualSync = useManualInventorySync();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const getInventoryStatus = (quantity: number, minimumStock: number) => {
    if (quantity === 0) return "OUT_OF_STOCK";
    if (quantity <= minimumStock) return "LOW_STOCK";
    return "IN_STOCK";
  };

  const filteredInventory = inventory.filter(item => {
    const status = getInventoryStatus(item.quantity, item.minimum_stock || 0);
    const materialCode = item.raw_materials?.material_code || "";
    const materialName = item.raw_materials?.name || "";
    
    const matchesSearch = 
      materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.location || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.bin_location || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === "ALL" || status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "IN_STOCK":
        return "approved";
      case "LOW_STOCK":
        return "pending";
      case "OUT_OF_STOCK":
        return "rejected";
      default:
        return "pending";
    }
  };

  const handleManualSync = () => {
    manualSync.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Inventory Synced",
          description: "Inventory has been synced with store confirmed materials",
        });
        refetch();
      },
      onError: (error) => {
        console.error("Sync error:", error);
        toast({
          title: "Sync Failed",
          description: "Failed to sync inventory. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(item => {
    const status = getInventoryStatus(item.quantity, item.minimum_stock || 0);
    return status === "LOW_STOCK";
  }).length;
  const outOfStockItems = inventory.filter(item => {
    const status = getInventoryStatus(item.quantity, item.minimum_stock || 0);
    return status === "OUT_OF_STOCK";
  }).length;
  const totalValue = inventory.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Raw Material Inventory</h3>
        <div className="flex space-x-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={manualSync.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${manualSync.isPending ? 'animate-spin' : ''}`} />
            Sync Inventory
          </Button>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by part code, description, location..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant={filterStatus === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus("ALL")}
          >
            All
          </Button>
          <Button 
            variant={filterStatus === "LOW_STOCK" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus("LOW_STOCK")}
          >
            Low Stock
          </Button>
          <Button 
            variant={filterStatus === "OUT_OF_STOCK" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus("OUT_OF_STOCK")}
          >
            Out of Stock
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold">{totalItems}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">{lowStockItems}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <TrendingDown className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{outOfStockItems}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Quantity</p>
              <p className="text-2xl font-bold">{totalValue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Minimum Stock</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Bin</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory.map((item) => {
              const status = getInventoryStatus(item.quantity, item.minimum_stock || 0);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-medium">
                    {item.raw_materials?.material_code || "N/A"}
                  </TableCell>
                  <TableCell>{item.raw_materials?.name || "N/A"}</TableCell>
                  <TableCell className={`font-medium ${
                    item.quantity <= (item.minimum_stock || 0) ? "text-red-600" : "text-green-600"
                  }`}>
                    {item.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-gray-600">{item.minimum_stock || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span>{item.location || "Not specified"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.bin_location || "N/A"}</TableCell>
                  <TableCell>{format(new Date(item.last_updated), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    <StatusBadge status={getStatusColor(status)}>
                      {status.replace("_", " ")}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filteredInventory.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="mx-auto h-12 w-12 opacity-50 mb-4" />
          {inventory.length === 0 ? (
            <>
              <p>No inventory items found</p>
              <p className="text-sm">Materials received by store will appear here. Try clicking "Sync Inventory" button.</p>
            </>
          ) : (
            <>
              <p>No inventory items found</p>
              <p className="text-sm">Try adjusting your search or filter criteria</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
