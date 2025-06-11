
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckSquare, Clock, Package } from "lucide-react";
import PurchaseOrderApprovals from "@/components/Approvals/PurchaseOrderApprovals";

const Approvals = () => {
  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Approvals</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs defaultValue="purchase-orders" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="purchase-orders">
              <Package className="h-4 w-4 mr-2" />
              Purchase Orders
            </TabsTrigger>
            <TabsTrigger value="production-schedules" disabled>
              <Clock className="h-4 w-4 mr-2" />
              Production Schedules
            </TabsTrigger>
            <TabsTrigger value="quality-approvals" disabled>
              <CheckSquare className="h-4 w-4 mr-2" />
              Quality Approvals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase-orders" className="space-y-4">
            <PurchaseOrderApprovals />
          </TabsContent>

          <TabsContent value="production-schedules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Production Schedule Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4" />
                  <p>Production schedule approvals coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality-approvals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Quality Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4" />
                  <p>Quality approvals coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Approvals;
