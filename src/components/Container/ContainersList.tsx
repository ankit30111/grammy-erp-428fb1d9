import { useState } from "react";
import { format } from "date-fns";
import { Eye, Edit, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Container } from "@/hooks/useContainers";
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

export default function ContainersList({ containers }: ContainersListProps) {
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleViewDetails = (container: Container) => {
    setSelectedContainer(container);
    setDetailsDialogOpen(true);
  };

  const handleEditContainer = (container: Container) => {
    setSelectedContainer(container);
    setEditDialogOpen(true);
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
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Container Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ordered Date</TableHead>
              <TableHead>Current Location</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map((container) => (
              <TableRow key={container.id}>
                <TableCell>
                  <div className="font-medium">{container.container_number}</div>
                  {container.notes && (
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {container.notes}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`text-white ${statusColors[container.current_status as keyof typeof statusColors] || 'bg-gray-500'}`}
                  >
                    {container.current_status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(container.ordered_date)}</TableCell>
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
    </>
  );
}