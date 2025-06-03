
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductionQueueDashboard from "./ProductionQueueDashboard";
import { Factory, BarChart, Clock } from "lucide-react";

const ProductionDashboard = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Factory className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Production Lines Dashboard</h1>
      </div>

      <Tabs defaultValue="lines" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lines">Production Lines</TabsTrigger>
          <TabsTrigger value="queue">Production Queue</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="space-y-4">
          <ProductionQueueDashboard />
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Detailed Production Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Detailed queue management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Production Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Production analytics dashboard coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionDashboard;
