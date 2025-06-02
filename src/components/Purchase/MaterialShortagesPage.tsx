
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, Calculator, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface MaterialShortage {
  raw_material_id: string;
  material_code: string;
  material_name: string;
  required_quantity: number;
  available_quantity: number;
  shortfall_quantity: number;
  is_critical: boolean;
}

export const MaterialShortagesPage = () => {
  const [isCalculating, setIsCalculating] = useState(false);
  const { toast } = useToast();

  // Fetch live material shortages based on projections
  const { data: materialShortages = [], refetch } = useQuery({
    queryKey: ["material-shortages-live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_requirements_view")
        .select("*")
        .gt("shortage_quantity", 0)
        .order("shortage_quantity", { ascending: false });
      
      if (error) throw error;
      
      return data.map(item => ({
        raw_material_id: item.raw_material_id,
        material_code: item.material_code,
        material_name: item.material_name,
        required_quantity: item.total_required || 0,
        available_quantity: item.available_quantity || 0,
        shortfall_quantity: item.shortage_quantity || 0,
        is_critical: item.is_critical || false
      })) as MaterialShortage[];
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

  const totalShortages = materialShortages.length;
  const criticalShortages = materialShortages.filter(m => m.is_critical).length;
  const totalShortfallValue = materialShortages.reduce((sum, item) => sum + item.shortfall_quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Live Material Shortages</h2>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Calculator className="h-8 w-8 text-blue-600" />
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
                  <TableHead>Description</TableHead>
                  <TableHead>Required Quantity</TableHead>
                  <TableHead>Available Stock</TableHead>
                  <TableHead>Shortfall Quantity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialShortages.map((shortage) => (
                  <TableRow key={shortage.raw_material_id}>
                    <TableCell className="font-medium font-mono">
                      {shortage.material_code}
                    </TableCell>
                    <TableCell>{shortage.material_name}</TableCell>
                    <TableCell>{shortage.required_quantity.toLocaleString()}</TableCell>
                    <TableCell>{shortage.available_quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-red-600 font-bold">
                      {shortage.shortfall_quantity.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {shortage.is_critical ? (
                        <Badge variant="destructive">Critical</Badge>
                      ) : (
                        <Badge variant="secondary">Standard</Badge>
                      )}
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
    </div>
  );
};
