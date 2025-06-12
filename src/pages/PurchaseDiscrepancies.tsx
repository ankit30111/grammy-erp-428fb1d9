
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Package } from "lucide-react";
import IQCDiscrepancies from "@/components/PurchaseDiscrepancies/IQCDiscrepancies";
import StoreDiscrepancies from "@/components/PurchaseDiscrepancies/StoreDiscrepancies";

const PurchaseDiscrepancies = () => {
  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Purchase Discrepancies</h1>
            <p className="text-muted-foreground">Monitor and resolve material receiving discrepancies</p>
          </div>
        </div>

        <Tabs defaultValue="iqc-discrepancy" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="iqc-discrepancy">
              <AlertTriangle className="h-4 w-4 mr-2" />
              IQC Discrepancy
            </TabsTrigger>
            <TabsTrigger value="store-discrepancy">
              <Package className="h-4 w-4 mr-2" />
              Store Discrepancy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="iqc-discrepancy" className="space-y-4">
            <IQCDiscrepancies />
          </TabsContent>

          <TabsContent value="store-discrepancy" className="space-y-4">
            <StoreDiscrepancies />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PurchaseDiscrepancies;
