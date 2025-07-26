import { useState } from "react";
import { Plus, Container, Calendar, Package, Boxes } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useContainers } from "@/hooks/useContainers";
import ContainerGanttChart from "@/components/Container/ContainerGanttChart";
import ContainersList from "@/components/Container/ContainersList";
import ContainerModelsView from "@/components/Container/ContainerModelsView";
import CreateContainerDialog from "@/components/Container/CreateContainerDialog";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Container Tracking</h1>
            <p className="text-muted-foreground">
              Track import containers and material delivery schedules
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Container
          </Button>
        </div>

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

        {/* Main Content */}
        <Tabs defaultValue="models" className="space-y-4">
          <TabsList>
            <TabsTrigger value="models" className="flex items-center space-x-2">
              <Boxes className="h-4 w-4" />
              <span>Model View</span>
            </TabsTrigger>
            <TabsTrigger value="gantt" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Gantt View</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center space-x-2">
              <Container className="h-4 w-4" />
              <span>List View</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="models">
            <ContainerModelsView containers={containers} />
          </TabsContent>

          <TabsContent value="gantt">
            <Card>
              <CardHeader>
                <CardTitle>Container Timeline</CardTitle>
                <CardDescription>
                  Visual timeline of container status progression
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContainerGanttChart containers={containers} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list">
            <Card>
              <CardHeader>
                <CardTitle>Containers</CardTitle>
                <CardDescription>
                  Detailed list of all containers and their status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContainersList containers={containers} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CreateContainerDialog 
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
}