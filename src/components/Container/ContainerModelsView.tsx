import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Package, Calendar, Truck, Ship, Plane } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Container, useContainerMaterials } from "@/hooks/useContainers";

interface ContainerModelsViewProps {
  containers: Container[];
}

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

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'SHIPPED':
    case 'IN_TRANSIT':
      return <Ship className="h-4 w-4" />;
    case 'IN_TRAIN':
      return <Truck className="h-4 w-4" />;
    case 'ARRIVED':
    case 'DISPATCHED':
      return <Package className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
};

const getExpectedDeliveryDate = (container: Container): string => {
  // Calculate expected delivery based on current status and dates
  const statusOrder = ['ORDERED', 'LOADING', 'LOADED', 'CHINA_CUSTOM', 'SHIPPED', 'IN_TRANSIT', 'INDIAN_DOCK', 'IN_TRAIN', 'INDIA_CUSTOM', 'DISPATCHED', 'ARRIVED'];
  
  if (container.arrived_date) return container.arrived_date;
  if (container.dispatched_date) return container.dispatched_date;
  if (container.indian_dock_date) {
    // Estimate 7 days from dock to arrival
    const dockDate = new Date(container.indian_dock_date);
    dockDate.setDate(dockDate.getDate() + 7);
    return dockDate.toISOString().split('T')[0];
  }
  if (container.shipped_date) {
    // Estimate 21 days from shipped to dock
    const shipDate = new Date(container.shipped_date);
    shipDate.setDate(shipDate.getDate() + 21);
    return shipDate.toISOString().split('T')[0];
  }
  
  return 'TBD';
};

function ContainerMaterialsData({ containerId }: { containerId: string }) {
  const { data: materials = [] } = useContainerMaterials(containerId);
  
  if (materials.length === 0) {
    return <span className="text-muted-foreground">No materials added</span>;
  }

  return (
    <div className="space-y-1">
      {materials.map((material, index) => (
        <div key={material.id} className="text-sm">
          <span className="font-medium">{material.brand}</span> {material.model}
          {index < materials.length - 1 && <br />}
        </div>
      ))}
    </div>
  );
}

export default function ContainerModelsView({ containers }: ContainerModelsViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("delivery_date");

  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === 'TBD') return dateString || '-';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const filteredAndSortedContainers = useMemo(() => {
    let filtered = containers;
    
    if (statusFilter !== "all") {
      filtered = containers.filter(container => container.current_status === statusFilter);
    }

    return filtered.sort((a, b) => {
      if (sortBy === "delivery_date") {
        const dateA = getExpectedDeliveryDate(a);
        const dateB = getExpectedDeliveryDate(b);
        if (dateA === 'TBD' && dateB === 'TBD') return 0;
        if (dateA === 'TBD') return 1;
        if (dateB === 'TBD') return -1;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      }
      if (sortBy === "status") {
        return a.current_status.localeCompare(b.current_status);
      }
      return a.container_number.localeCompare(b.container_number);
    });
  }, [containers, statusFilter, sortBy]);

  // Get status counts for overview cards
  const statusCounts = containers.reduce((acc, container) => {
    acc[container.current_status] = (acc[container.current_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const criticalStatuses = ['IN_TRANSIT', 'INDIAN_DOCK', 'IN_TRAIN', 'DISPATCHED'];
  const inTransitCount = criticalStatuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);

  if (!containers.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Package className="h-12 w-12 mb-4" />
        <p className="text-lg">No containers found</p>
        <p className="text-sm">Add containers to track model deliveries</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Ship className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">In Transit</p>
                <p className="text-2xl font-bold">{inTransitCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Arrived</p>
                <p className="text-2xl font-bold">{statusCounts.ARRIVED || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold">{(statusCounts.ORDERED || 0) + (statusCounts.LOADING || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Truck className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Total Containers</p>
                <p className="text-2xl font-bold">{containers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Filter by Status:</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
              <SelectItem value="INDIAN_DOCK">At Indian Dock</SelectItem>
              <SelectItem value="IN_TRAIN">In Train</SelectItem>
              <SelectItem value="DISPATCHED">Dispatched</SelectItem>
              <SelectItem value="ARRIVED">Arrived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Sort by:</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="delivery_date">Expected Delivery</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="container">Container Number</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Models Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Model Delivery Tracking</span>
          </CardTitle>
          <CardDescription>
            Track which models are arriving at the factory and their expected delivery dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container</TableHead>
                  <TableHead>Models & Brands</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Current Location</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead>Supplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedContainers.map((container) => (
                  <TableRow key={container.id}>
                    <TableCell>
                      <div className="font-medium">{container.container_number}</div>
                      {container.notes && (
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {container.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <ContainerMaterialsData containerId={container.id} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(container.current_status)}
                        <Badge 
                          variant="outline" 
                          className={`text-white ${statusColors[container.current_status as keyof typeof statusColors] || 'bg-gray-500'}`}
                        >
                          {container.current_status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {container.current_status === 'IN_TRANSIT' && 'At Sea'}
                        {container.current_status === 'INDIAN_DOCK' && 'Indian Port'}
                        {container.current_status === 'IN_TRAIN' && 'On Train to Factory'}
                        {container.current_status === 'ARRIVED' && 'At Factory'}
                        {container.current_status === 'DISPATCHED' && 'Dispatched from Port'}
                        {!['IN_TRANSIT', 'INDIAN_DOCK', 'IN_TRAIN', 'ARRIVED', 'DISPATCHED'].includes(container.current_status) && 
                          container.current_status.replace('_', ' ')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {formatDate(getExpectedDeliveryDate(container))}
                      </div>
                      {container.current_status === 'ARRIVED' && (
                        <Badge variant="secondary" className="mt-1">
                          Delivered
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {container.supplier_info || '-'}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}