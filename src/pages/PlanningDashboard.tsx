
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { ProjectionsOverview } from "@/components/Planning/ProjectionsOverview";
import { ProductionCalendarView } from "@/components/Planning/ProductionCalendarView";
import { MaterialShortagesView } from "@/components/Planning/MaterialShortagesView";
import { Clock } from "lucide-react";
import { format } from "date-fns";

const PlanningDashboard = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Production Planning Dashboard</h1>
            <p className="text-muted-foreground">Manage projections, schedules, and material requirements</p>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Last updated: {format(new Date(), "PPp")}</span>
          </div>
        </div>

        <Tabs defaultValue="projections" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projections">Customer Projections</TabsTrigger>
            <TabsTrigger value="calendar">Production Calendar</TabsTrigger>
            <TabsTrigger value="materials">Material Shortages</TabsTrigger>
          </TabsList>
          
          <TabsContent value="projections">
            <ProjectionsOverview />
          </TabsContent>
          
          <TabsContent value="calendar">
            <ProductionCalendarView selectedDate={selectedDate} onDateSelect={setSelectedDate} />
          </TabsContent>
          
          <TabsContent value="materials">
            <MaterialShortagesView />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PlanningDashboard;
