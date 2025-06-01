
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductionDashboard from "@/components/Production/ProductionDashboard";
import ScheduledProductions from "@/components/Production/ScheduledProductions";
import KitVerification from "@/components/Production/KitVerification";
import MaterialRequests from "@/components/Production/MaterialRequests";
import OQCRejections from "@/components/Production/OQCRejections";
import CompletedProduction from "@/components/Production/CompletedProduction";
import { Factory } from "lucide-react";

export default function Production() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex items-center space-x-4 mb-6">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Production Management - Grammy Electronics</h1>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard">Production Lines</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled Productions</TabsTrigger>
            <TabsTrigger value="completed">Completed Production</TabsTrigger>
            <TabsTrigger value="kit-verification">Kit Verification</TabsTrigger>
            <TabsTrigger value="material-requests">Material Requests</TabsTrigger>
            <TabsTrigger value="oqc-rejections">OQC Rejections</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <ProductionDashboard />
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-4">
            <ScheduledProductions />
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <CompletedProduction />
          </TabsContent>

          <TabsContent value="kit-verification" className="space-y-4">
            <KitVerification />
          </TabsContent>

          <TabsContent value="material-requests" className="space-y-4">
            <MaterialRequests />
          </TabsContent>

          <TabsContent value="oqc-rejections" className="space-y-4">
            <OQCRejections />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
