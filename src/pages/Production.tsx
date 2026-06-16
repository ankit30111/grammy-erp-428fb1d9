
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductionLinesOverview from "@/components/Production/ProductionLinesOverview";
import ScheduledProductions from "@/components/Production/ScheduledProductions";
import MaterialRequests from "@/components/Production/MaterialRequests";
import OQCRejections from "@/components/Production/OQCRejections";
import CompletedProduction from "@/components/Production/CompletedProduction";
import { Factory } from "lucide-react";

const tabListCls =
  "flex h-10 items-center gap-1 rounded-xl bg-muted p-1 text-sm w-full";
const tabTriggerCls =
  "flex-1 px-3 py-1.5 rounded-lg text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-colors text-center";

export default function Production() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Production Management"
        description="Grammy Electronics — production lines, schedules, materials and rejections"
      />
      <div className="page-card p-5">
        <Tabs defaultValue="production-lines" className="space-y-4">
          <TabsList className={tabListCls}>
            <TabsTrigger value="production-lines" className={tabTriggerCls}>Production Lines</TabsTrigger>
            <TabsTrigger value="scheduled" className={tabTriggerCls}>Scheduled Productions</TabsTrigger>
            <TabsTrigger value="completed" className={tabTriggerCls}>Completed Production</TabsTrigger>
            <TabsTrigger value="material-requests" className={tabTriggerCls}>Material Requests</TabsTrigger>
            <TabsTrigger value="oqc-rejections" className={tabTriggerCls}>OQC Rejections</TabsTrigger>
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
    </DashboardLayout>
  );
}
