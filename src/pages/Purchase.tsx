
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Purchase = () => {
  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Purchase Management</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, 14:35</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Material Shortages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No material shortages to purchase yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Material shortages will appear here when productions are planned
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendor-wise Material Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">No requirements yet</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending">
                <TabsList className="mb-4">
                  <TabsTrigger value="pending">Pending (0)</TabsTrigger>
                  <TabsTrigger value="sent">Sent (0)</TabsTrigger>
                </TabsList>
                
                <TabsContent value="pending" className="space-y-4">
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No pending purchase orders</p>
                  </div>
                </TabsContent>
                
                <TabsContent value="sent">
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No sent purchase orders</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Purchase;
