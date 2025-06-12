
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductionLinesOverview from "@/components/Production/ProductionLinesOverview";
import ScheduledProductions from "@/components/Production/ScheduledProductions";
import MaterialRequests from "@/components/Production/MaterialRequests";
import OQCRejections from "@/components/Production/OQCRejections";
import CompletedProduction from "@/components/Production/CompletedProduction";
import { Factory } from "lucide-react";

export default function Production() {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4 mb-6">
            <Factory className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">Production Management - Grammy Electronics</h1>
          </div>

          <Tabs defaultValue="production-lines" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 bg-white">
              <TabsTrigger value="production-lines">Production Lines</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled Productions</TabsTrigger>
              <TabsTrigger value="completed">Completed Production</TabsTrigger>
              <TabsTrigger value="material-requests">Material Requests</TabsTrigger>
              <TabsTrigger value="oqc-rejections">OQC Rejections</TabsTrigger>
            </TabsList>

            <TabsContent value="production-lines" className="space-y-4">
              <ProductionLinesOverview />
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-4">
              <ScheduledProductions />
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              <CompletedProduction />
            </TabsContent>

            <TabsContent value="material-requests" className="space-y-4">
              <MaterialRequests />
            </TabsContent>

            <TabsContent value="oqc-rejections" className="space-y-4">
              <OQCRejections />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
