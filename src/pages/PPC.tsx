
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Factory, Package, TrendingUp } from "lucide-react";
import ProductionSchedule from "@/components/PPC/ProductionSchedule";
import ProductionCalendar from "@/components/PPC/ProductionCalendar";
import MaterialShortages from "@/components/PPC/MaterialShortages";
import UnscheduledProjections from "@/components/PPC/UnscheduledProjections";
import { useState } from "react";

const PPC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Production Planning & Control</h1>
        </div>

        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule">Production Schedule</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="materials">Material Management</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            <div className="space-y-6">
              <UnscheduledProjections />
              <ProductionSchedule date={selectedDate} />
            </div>
          </TabsContent>

          <TabsContent value="calendar">
            <ProductionCalendar onDateSelect={setSelectedDate} selectedDate={selectedDate} />
          </TabsContent>

          <TabsContent value="materials">
            <MaterialShortages shortages={[]} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PPC;
