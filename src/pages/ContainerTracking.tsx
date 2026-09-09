import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useContainers } from "@/hooks/useContainers";
import ContainerGanttChart from "@/components/Container/ContainerGanttChart";
import ContainersList from "@/components/Container/ContainersList";
import ContainerModelsView from "@/components/Container/ContainerModelsView";
import CreateContainerDialog from "@/components/Container/CreateContainerDialog";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";

const containerTabs = [
  { id: "gantt", label: "Gantt View" },
  { id: "list", label: "List View" },
  { id: "models", label: "Model View" },
];


const statusColors = {
  ORDERED: "bg-yellow-500",
  LOADING: "bg-orange-500", 
  LOADED: "bg-blue-500",
  CHINA_CUSTOM: "bg-purple-500",
  SHIPPED: "bg-cyan-500",
  IN_TRANSIT: "bg-indigo-500",
  INDIAN_DOCK: "bg-green-500",
  IN_TRAIN: "bg-teal-500",
  INDIA_CUSTOM: "bg-amber-500",
  DISPATCHED: "bg-lime-500",
  ARRIVED: "bg-emerald-500"
};

export default function ContainerTracking() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("gantt");
  const { data: containers = [], isLoading } = useContainers();


  const getStatusCounts = () => {
    const counts = containers.reduce((acc, container) => {
      acc[container.current_status] = (acc[container.current_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading containers...</div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Container Tracking"
        subtitle="Import containers and material delivery schedules"
        actions={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Container
          </Button>
        }
      />
      <TabBar tabs={containerTabs} value={activeTab} onChange={setActiveTab} />
      <div className="space-y-6 pt-4">
        {/* Status Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${statusColors[status as keyof typeof statusColors] || 'bg-gray-500'}`}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {status.replace('_', ' ')}
                    </p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {activeTab === "gantt" && <ContainerGanttChart containers={containers} />}

        {activeTab === "list" && <ContainersList containers={containers} />}

        {activeTab === "models" && <ContainerModelsView containers={containers} />}

        <CreateContainerDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
}
