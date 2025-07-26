import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Package, Calendar, Truck, Ship, Plane, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Container, useContainerMaterials } from "@/hooks/useContainers";
import { LDBService } from "@/utils/LDBService";
import { useToast } from "@/hooks/use-toast";

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

// Interface for flattened material data
interface MaterialRow {
  id: string;
  model: string;
  brand: string;
  quantity: number;
  containerId: string;
  containerNumber: string;
  status: string;
  location: string;
  expectedDelivery: string;
  supplier: string;
}

// Hook to get all materials flattened across containers
function useAllContainerMaterials(containers: Container[]) {
  const materialQueries = containers.map(container => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data: materials = [] } = useContainerMaterials(container.id);
    return { container, materials };
  });

  return useMemo(() => {
    const allMaterials: MaterialRow[] = [];
    
    materialQueries.forEach(({ container, materials }) => {
      materials.forEach(material => {
        allMaterials.push({
          id: material.id,
          model: material.model,
          brand: material.brand,
          quantity: material.quantity,
          containerId: container.id,
          containerNumber: container.container_number,
          status: container.current_status,
          location: getLocationFromStatus(container.current_status),
          expectedDelivery: getExpectedDeliveryDate(container),
          supplier: container.supplier_info || '-'
        });
      });
    });
    
    return allMaterials;
  }, [materialQueries]);
}

function getLocationFromStatus(status: string): string {
  switch (status) {
    case 'IN_TRANSIT': return 'At Sea';
    case 'INDIAN_DOCK': return 'Indian Port';
    case 'IN_TRAIN': return 'On Train to Factory';
    case 'ARRIVED': return 'At Factory';
    case 'DISPATCHED': return 'Dispatched from Port';
    default: return status.replace('_', ' ');
  }
}

export default function ContainerModelsView({ containers }: ContainerModelsViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("delivery_date");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  
  // Get all materials flattened across containers
  const allMaterials = useAllContainerMaterials(containers);

  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === 'TBD') return dateString || '-';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const filteredAndSortedMaterials = useMemo(() => {
    let filtered = allMaterials;
    
    if (statusFilter !== "all") {
      filtered = allMaterials.filter(material => material.status === statusFilter);
    }

    return filtered.sort((a, b) => {
      if (sortBy === "delivery_date") {
        const dateA = a.expectedDelivery;
        const dateB = b.expectedDelivery;
        if (dateA === 'TBD' && dateB === 'TBD') return 0;
        if (dateA === 'TBD') return 1;
        if (dateB === 'TBD') return -1;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      }
      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }
      if (sortBy === "model") {
        return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
      }
      return a.containerNumber.localeCompare(b.containerNumber);
    });
  }, [allMaterials, statusFilter, sortBy]);
  
  const handleRefreshLDBStatus = async () => {
    setIsRefreshing(true);
    
    try {
      const uniqueContainers = [...new Set(containers.map(c => c.container_number))];
      
      for (const containerNumber of uniqueContainers) {
        const result = await LDBService.fetchContainerStatus(containerNumber);
        if (!result.success) {
          console.warn(`Failed to fetch status for ${containerNumber}:`, result.error);
        }
      }
      
      toast({
        title: "LDB Status Check",
        description: "Please check individual containers manually at LDB website for now.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh container status from LDB",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get status counts for overview cards
  const statusCounts = containers.reduce((acc, container) => {
    acc[container.current_status] = (acc[container.current_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Get material counts
  const totalModels = allMaterials.length;
  const uniqueModels = new Set(allMaterials.map(m => `${m.brand} ${m.model}`)).size;

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
  
  if (!allMaterials.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Package className="h-12 w-12 mb-4" />
        <p className="text-lg">No models found</p>
        <p className="text-sm">Add materials to containers to track model deliveries</p>
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
              <Package className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Total Models</p>
                <p className="text-2xl font-bold">{uniqueModels}</p>
                <p className="text-xs text-muted-foreground">{totalModels} items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center gap-4">
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
              <SelectItem value="model">Model</SelectItem>
              <SelectItem value="container">Container Number</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshLDBStatus}
          disabled={isRefreshing}
          className="ml-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Sync with LDB
        </Button>
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
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{material.brand} {material.model}</div>
                        {material.brand !== material.model && (
                          <div className="text-xs text-muted-foreground">
                            {material.model}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">{material.quantity}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{material.containerNumber}</div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-muted-foreground"
                        onClick={() => window.open(LDBService.getLDBSearchUrl(material.containerNumber), '_blank')}
                      >
                        Check LDB Status →
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(material.status)}
                        <Badge 
                          variant="outline" 
                          className={`text-white ${statusColors[material.status as keyof typeof statusColors] || 'bg-gray-500'}`}
                        >
                          {material.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{material.location}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {formatDate(material.expectedDelivery)}
                      </div>
                      {material.status === 'ARRIVED' && (
                        <Badge variant="secondary" className="mt-1">
                          Delivered
                        </Badge>
                      )}
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