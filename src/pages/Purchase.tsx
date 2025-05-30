
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Clock, Calculator, RefreshCw, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { useProjections } from "@/hooks/useProjections";
import { calculateMaterialShortages, MaterialShortage } from "@/utils/materialShortageCalculator";
import MaterialShortages from "@/components/PPC/MaterialShortages";
import PurchaseOrdersList from "@/components/PPC/PurchaseOrdersList";
import { useToast } from "@/hooks/use-toast";

const Purchase = () => {
  const [shortages, setShortages] = useState<MaterialShortage[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const { data: projections } = useProjections();
  const { toast } = useToast();

  const calculateShortages = async () => {
    if (!projections?.length) {
      toast({
        title: "No Projections",
        description: "Please add customer projections first to calculate material shortages",
        variant: "destructive",
      });
      return;
    }

    setIsCalculating(true);
    try {
      console.log('Starting shortage calculation for projections:', projections.map(p => p.id));
      const calculatedShortages = await calculateMaterialShortages(projections.map(p => p.id));
      setShortages(calculatedShortages);
      
      if (calculatedShortages.length > 0) {
        toast({
          title: "Material Shortages Calculated",
          description: `Found ${calculatedShortages.length} materials with shortages`,
        });
      } else {
        toast({
          title: "No Shortages Found",
          description: "All required materials are available in stock",
        });
      }
    } catch (error) {
      console.error('Error calculating shortages:', error);
      toast({
        title: "Calculation Error",
        description: "Failed to calculate material shortages",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  // Auto-calculate shortages when projections are available
  useEffect(() => {
    if (projections?.length && shortages.length === 0) {
      calculateShortages();
    }
  }, [projections]);

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Purchase Management</h1>
          <div className="flex items-center gap-4">
            <Button 
              onClick={calculateShortages}
              disabled={isCalculating}
              className="gap-2"
            >
              {isCalculating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Calculate Shortages
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Last updated:</span>
              <span className="text-sm font-medium">Today, 14:35</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <Tabs defaultValue="shortages" className="space-y-4">
          <TabsList>
            <TabsTrigger value="shortages">Material Shortages</TabsTrigger>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="shortages">
            <MaterialShortages 
              shortages={shortages}
              onCreatePO={() => {
                // Refresh shortages after creating PO
                calculateShortages();
              }}
            />
          </TabsContent>

          <TabsContent value="purchase-orders">
            <PurchaseOrdersList />
          </TabsContent>
        </Tabs>

        {!projections?.length && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No customer projections found. Material shortages will be calculated based on projections and BOM.
                </p>
                <p className="text-sm text-muted-foreground">
                  Add customer projections first, then return here to calculate material shortages and create purchase orders.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Purchase;
