import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Package, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";

interface ImportedMaterialAlert {
  id: string;
  name: string;
  material_code: string;
  currency: string;
  unit_price: number;
  supplier_country: string;
  projections_count: number;
  required_quantity: number;
}

const ImportedMaterialsAlert = () => {
  const { data: alertMaterials = [], isLoading } = useQuery({
    queryKey: ["imported-materials-alerts"],
    queryFn: async () => {
      try {
        // Query to find imported materials that are used in projections
        const { data: materialsData, error: materialsError } = await supabase
          .from("raw_materials")
          .select(`
            id,
            name,
            material_code,
            currency,
            unit_price,
            supplier_country,
            bom!inner(
              id,
              quantity,
              product_id,
              products!inner(
                id,
                name,
                projections!inner(
                  id,
                  quantity,
                  delivery_month
                )
              )
            )
          `)
          .eq("sourcing_type", "IMPORTED");
        
        if (materialsError) throw materialsError;
        
        // Process the data to calculate required quantities
        const processedData: ImportedMaterialAlert[] = [];
        
        materialsData?.forEach((material: any) => {
          let totalRequired = 0;
          let projectionsCount = 0;
          
          material.bom?.forEach((bomItem: any) => {
            bomItem.products?.projections?.forEach((projection: any) => {
              totalRequired += bomItem.quantity * projection.quantity;
              projectionsCount++;
            });
          });
          
          if (totalRequired > 0) {
            processedData.push({
              id: material.id,
              name: material.name,
              material_code: material.material_code,
              currency: material.currency || 'USD',
              unit_price: material.unit_price || 0,
              supplier_country: material.supplier_country || '',
              projections_count: projectionsCount,
              required_quantity: totalRequired,
            });
          }
        });
        
        return processedData;
      } catch (error) {
        console.error("Error fetching imported materials alerts:", error);
        return [];
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Imported Materials Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading alerts...</div>
        </CardContent>
      </Card>
    );
  }

  if (alertMaterials.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-green-500" />
            Imported Materials Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-green-600">
            ✅ All imported materials in projections have corresponding purchase orders
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Imported Materials Requiring Purchase Orders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            {alertMaterials.length} imported material(s) are used in active projections but don't have purchase orders.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-3">
          {Array.isArray(alertMaterials) && alertMaterials.slice(0, 5).map((material) => (
            <div key={material.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{material.material_code}</span>
                  <Badge variant="outline">{material.currency}</Badge>
                  {material.supplier_country && (
                    <Badge variant="secondary" className="text-xs">
                      {material.supplier_country}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{material.name}</div>
                <div className="text-xs text-orange-600">
                  Required: {material.required_quantity} units • Used in {material.projections_count} projection(s)
                  {material.unit_price && (
                    <span> • Unit Price: {material.currency} {material.unit_price}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/purchase">
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Create PO
                  </Link>
                </Button>
              </div>
            </div>
          ))}
          
          {alertMaterials.length > 5 && (
            <div className="text-center">
              <Button variant="outline" size="sm" asChild>
                <Link to="/purchase">
                  View All {alertMaterials.length} Materials
                </Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ImportedMaterialsAlert;