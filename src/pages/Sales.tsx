
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign } from "lucide-react";
import SpareDispatch from "./sales/SpareDispatch";
import RegularDispatch from "./sales/RegularDispatch";

const Sales = () => {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex items-center space-x-4 mb-6">
          <DollarSign className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Sales Management - Grammy Electronics</h1>
        </div>

        <Tabs defaultValue="spare-dispatch" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="spare-dispatch">Spare Dispatch</TabsTrigger>
            <TabsTrigger value="regular-dispatch">Regular Dispatch</TabsTrigger>
          </TabsList>

          <TabsContent value="spare-dispatch" className="space-y-4">
            <SpareDispatch />
          </TabsContent>

          <TabsContent value="regular-dispatch" className="space-y-4">
            <RegularDispatch />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Sales;
