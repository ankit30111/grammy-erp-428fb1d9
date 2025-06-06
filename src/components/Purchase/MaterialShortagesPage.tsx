
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, Calculator, RefreshCw, Eye, ShoppingCart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import MaterialShortageDetails from "./MaterialShortageDetails";

interface MaterialShortage {
  raw_material_id: string;
  material_code: string;
  material_name: string;
  total_required: number;
  available_quantity: number;
  pending_po_quantity: number;
  received_quantity: number;
  shortage_quantity: number;
  is_critical: boolean;
  projection_details: Array<{
    projection_id: string;
    product_name: string;
    customer_name: string;
    projection_quantity: number;
    required_quantity: number;
    delivery_month: string;
  }>;
  has_pending_po: boolean;
}

export const MaterialShortagesPage = () => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialShortage | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  // Fetch material shortages from the updated view
  const { data: materialShortages = [], refetch, isLoading } = useQuery({
    queryKey: ["material-shortages-calculated"],
    queryFn: async () => {
      console.log("Fetching material shortages from calculated view");
      const { data, error } = await supabase
        .from("material_shortages_calculated")
        .select("*")
        .order("shortage_quantity", { ascending: false });
      
      if (error) {
        console.error("Error fetching material shortages:", error);
        throw error;
      }
      
      console.log("Fetched material shortages:", data);
      return data as MaterialShortage[];
    },
  });

  const handleRefreshShortages = async () => {
    setIsCalculating(true);
    try {
      await refetch();
      toast({
        title: "Material Shortages Updated",
        description: `Found ${materialShortages.length} materials with shortages`,
      });
    } catch (error) {
      console.error('Error refreshing shortages:', error);
      toast({
        title: "Refresh Error",
        description: "Failed to refresh material shortages",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleViewDetails = (material: MaterialShortage) => {
    setSelectedMaterial(material);
    setShowDetails(true);
  };

  const totalShortages = materialShortages.length;
  const criticalShortages = materialShortages.filter(m => m.is_critical).length;
  const materialsWithPendingPO = materialShortages.filter(m => m.has_pending_po).length;
  const totalShortfallValue = materialShortages.reduce((sum, item) => sum + item.shortage_quantity, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading material shortages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Material Shortages</h2>
        <Button 
          onClick={handleRefreshShortages}
          disabled={isCalculating}
          className="gap-2"
        >
          {isCalculating ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="h-4 w-4" />
          )}
          Refresh Shortages
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <div className="text-2xl font-bold">{totalShortages}</div>
                <div className="text-sm text-muted-foreground">Total Shortages</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Package className="h-8 w-8 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">{criticalShortages}</div>
                <div className="text-sm text-muted-foreground">Critical Shortages</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{materialsWithPendingPO}</div>
                <div className="text-sm text-muted-foreground">POs Created</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calculator className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{totalShortfallValue.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Shortfall Units</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Material Shortages Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Material Shortages Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {materialShortages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Code</TableHead>
                  <TableHead>Part Name</TableHead>
                  <TableHead>Total Required</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Received Qty</TableHead>
                  <TableHead>Pending PO</TableHead>
                  <TableHead>Net Shortage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialShortages.map((shortage) => (
                  <TableRow key={shortage.raw_material_id}>
                    <TableCell 
                      className="font-medium font-mono cursor-pointer text-blue-600 hover:text-blue-800"
                      onClick={() => handleViewDetails(shortage)}
                    >
                      {shortage.material_code}
                    </TableCell>
                    <TableCell>{shortage.material_name}</TableCell>
                    <TableCell>{shortage.total_required.toLocaleString()}</TableCell>
                    <TableCell>{shortage.available_quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {shortage.received_quantity.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {shortage.pending_po_quantity > 0 ? (
                        <Badge variant="outline">{shortage.pending_po_quantity.toLocaleString()}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-red-600 font-bold">
                      {shortage.shortage_quantity.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {shortage.is_critical && (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                        {shortage.has_pending_po && (
                          <Badge variant="secondary">PO Created</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(shortage)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Material Shortages</h3>
              <p className="text-muted-foreground">
                All required materials are available in sufficient stock
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Material Details Modal */}
      <MaterialShortageDetails
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        materialData={selectedMaterial}
      />
    </div>
  );
};
