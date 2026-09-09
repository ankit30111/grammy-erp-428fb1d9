
import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Calculator } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";
import { calculateMaterialShortages, MaterialShortage } from "@/utils/materialShortageCalculator";
import MaterialShortages from "@/components/PPC/MaterialShortages";
import UnscheduledProjections from "@/components/PPC/UnscheduledProjections";
import ProductionSchedule from "@/components/PPC/ProductionSchedule";
import ProductionScheduleManagement from "@/components/PPC/ProductionScheduleManagement";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Planning: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [activeTab, setActiveTab] = useState("schedule");
  const [shortages, setShortages] = useState<MaterialShortage[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const { data: projections } = useProjections();
  const { data: schedules } = useProductionSchedules();
  const { toast } = useToast();

  const calculateShortages = async () => {
    if (!projections?.length) {
      toast({
        title: "No Projections",
        description: "Please add customer projections first",
        variant: "destructive",
      });
      return;
    }

    setIsCalculating(true);
    try {
      const calculatedShortages = await calculateMaterialShortages(projections.map(p => p.id));
      setShortages(calculatedShortages);
      
      if (calculatedShortages.length > 0) {
        toast({
          title: "Material Shortages Identified",
          description: `Found ${calculatedShortages.length} materials with shortages`,
        });
      } else {
        toast({
          title: "No Shortages",
          description: "All required materials are available",
        });
      }
    } catch (error) {
      console.error('Error calculating shortages:', error);
      toast({
        title: "Error",
        description: "Failed to calculate material shortages",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleScheduleProduction = (projectionId: string) => {
    // This will be implemented when we add the scheduling modal
    console.log('Schedule production for projection:', projectionId);
  };

  // Auto-calculate shortages when projections change
  useEffect(() => {
    if (projections?.length) {
      calculateShortages();
    }
  }, [projections]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Production Planning"
        subtitle="Schedules, material requirements and shortages"
        actions={
          <Button onClick={calculateShortages} disabled={isCalculating} variant="outline" size="sm" className="gap-2">
            <Calculator className="h-4 w-4" />
            Recalculate Shortages
          </Button>
        }
      />
      <TabBar
        tabs={[
          { id: "schedule", label: "Production Schedule" },
          { id: "schedule-management", label: "Schedule Management" },
          { id: "materials", label: "Material Requirements" },
          { id: "shortages", label: "Material Shortages" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />
      <div className="grid gap-4 md:gap-6 pt-4">
        <div className="space-y-4">
          {activeTab === "schedule" && (
            <div className="space-y-6">
              <UnscheduledProjections onScheduleClick={handleScheduleProduction} />
              <ProductionSchedule date={selectedDate} />
            </div>
          )}

          {activeTab === "schedule-management" && <ProductionScheduleManagement />}

          {activeTab === "materials" && (

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Material Requirements Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {projections?.length ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{projections.length}</div>
                        <div className="text-sm text-muted-foreground">Active Projections</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{schedules?.length || 0}</div>
                        <div className="text-sm text-muted-foreground">Scheduled Productions</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{shortages.length}</div>
                        <div className="text-sm text-muted-foreground">Material Shortages</div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Material requirements are calculated based on product BOM and projection quantities
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No projections available</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add customer projections to see material requirements
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "shortages" && <MaterialShortages shortages={shortages} />}
        </div>
      </div>

    </DashboardLayout>
  );
};

export default Planning;
