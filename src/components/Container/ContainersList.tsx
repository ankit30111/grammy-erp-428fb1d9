import { useState } from "react";
import { format } from "date-fns";
import { Eye, Edit, Package, RefreshCw, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Container, useUpdateContainer } from "@/hooks/useContainers";
import { LDBService } from "@/utils/LDBService";
import { useToast } from "@/hooks/use-toast";
import ContainerDetailsDialog from "./ContainerDetailsDialog";
import EditContainerDialog from "./EditContainerDialog";

interface ContainersListProps {
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

const statusOptions = [
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'LOADING', label: 'Loading' },
  { value: 'LOADED', label: 'Loaded' },
  { value: 'CHINA_CUSTOM', label: 'China Custom' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'INDIAN_DOCK', label: 'Indian Dock' },
  { value: 'IN_TRAIN', label: 'In Train' },
  { value: 'INDIA_CUSTOM', label: 'India Custom' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'ARRIVED', label: 'Arrived' },
];

export default function ContainersList({ containers }: ContainersListProps) {
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const updateContainer = useUpdateContainer();
  const { toast } = useToast();

  const handleViewDetails = (container: Container) => {
    setSelectedContainer(container);
    setDetailsDialogOpen(true);
  };

  const handleEditContainer = (container: Container) => {
    setSelectedContainer(container);
    setEditDialogOpen(true);
  };

  const handleStatusChange = async (containerId: string, newStatus: string) => {
    try {
      await updateContainer.mutateAsync({
        id: containerId,
        current_status: newStatus,
      });
      toast({
        title: "Status Updated",
        description: "Container status has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update container status.",
        variant: "destructive",
      });
    }
  };

  const handleSyncLDB = async () => {
    setIsRefreshing(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const container of containers) {
        const result = await LDBService.fetchContainerStatus(container.container_number);
        if (result.success) {
          console.log(`LDB Status for ${container.container_number}:`, result);
          successCount++;
        } else {
          console.warn(`Failed to fetch status for ${container.container_number}:`, result.error);
          errorCount++;
        }
      }
      
      toast({
        title: "LDB Status Update",
        description: `Successfully fetched ${successCount} containers. ${errorCount} failed.`,
        variant: successCount > 0 ? "default" : "destructive",
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  if (!containers.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Package className="h-12 w-12 mb-4" />
        <p className="text-lg">No containers found</p>
        <p className="text-sm">Add your first container to start tracking</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={handleSyncLDB}
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Sync with LDB
        </Button>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Container Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Loading Date</TableHead>
              <TableHead>Current Location</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Quick Status Change</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map((container) => (
              <TableRow key={container.id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{container.container_number}</div>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-muted-foreground"
                      onClick={() => window.open(LDBService.getLDBSearchUrl(container.container_number), '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Check LDB Status
                    </Button>
                    {container.notes && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {container.notes}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`text-white ${statusColors[container.current_status as keyof typeof statusColors] || 'bg-gray-500'}`}
                  >
                    {container.current_status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(container.loading_date)}</TableCell>
                <TableCell>
                  {container.current_status === 'IN_TRANSIT' && 'At Sea'}
                  {container.current_status === 'INDIAN_DOCK' && 'Indian Port'}
                  {container.current_status === 'IN_TRAIN' && 'On Train'}
                  {container.current_status === 'ARRIVED' && 'Delivered'}
                  {!['IN_TRANSIT', 'INDIAN_DOCK', 'IN_TRAIN', 'ARRIVED'].includes(container.current_status) && 
                    container.current_status.replace('_', ' ')}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {container.supplier_info || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={container.current_status}
                    onValueChange={(newStatus) => handleStatusChange(container.id, newStatus)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(container)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditContainer(container)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedContainer && (
        <ContainerDetailsDialog
          container={selectedContainer}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
        />
      )}

      <EditContainerDialog
        container={selectedContainer}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}