import { useState } from "react";
import { format } from "date-fns";
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Container, useContainerMaterials, useDeleteContainerMaterial } from "@/hooks/useContainers";
import AddMaterialDialog from "./AddMaterialDialog";

interface ContainerDetailsDialogProps {
  container: Container;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function ContainerDetailsDialog({ container, open, onOpenChange }: ContainerDetailsDialogProps) {
  const [addMaterialDialogOpen, setAddMaterialDialogOpen] = useState(false);
  const { data: materials = [], isLoading } = useContainerMaterials(container.id);
  const deleteMaterial = useDeleteContainerMaterial();

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (confirm('Are you sure you want to delete this material?')) {
      await deleteMaterial.mutateAsync(materialId);
    }
  };

  const statusDates = [
    { label: 'Ordered', date: container.ordered_date, status: 'ORDERED' },
    { label: 'Loading', date: container.loading_date, status: 'LOADING' },
    { label: 'Loaded', date: container.loaded_date, status: 'LOADED' },
    { label: 'China Custom', date: container.china_custom_date, status: 'CHINA_CUSTOM' },
    { label: 'Shipped', date: container.shipped_date, status: 'SHIPPED' },
    { label: 'In Transit', date: container.in_transit_date, status: 'IN_TRANSIT' },
    { label: 'Indian Dock', date: container.indian_dock_date, status: 'INDIAN_DOCK' },
    { label: 'In Train', date: container.in_train_date, status: 'IN_TRAIN' },
    { label: 'India Custom', date: container.india_custom_date, status: 'INDIA_CUSTOM' },
    { label: 'Dispatched', date: container.dispatched_date, status: 'DISPATCHED' },
    { label: 'Arrived', date: container.arrived_date, status: 'ARRIVED' }
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Container {container.container_number}</span>
            </DialogTitle>
            <DialogDescription>
              Container details and material contents
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Container Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Current Status</h3>
                <Badge 
                  variant="outline" 
                  className={`text-white ${statusColors[container.current_status as keyof typeof statusColors] || 'bg-gray-500'}`}
                >
                  {container.current_status.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Supplier</h3>
                <p className="text-sm">{container.supplier_info || 'Not specified'}</p>
              </div>
            </div>

            {/* Status Timeline */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Status Timeline</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {statusDates.map((item) => (
                  <div 
                    key={item.status}
                    className={`p-3 rounded-lg border ${item.date ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(item.date)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Materials */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Materials</h3>
                <Button size="sm" onClick={() => setAddMaterialDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Material
                </Button>
              </div>

              {isLoading ? (
                <div className="text-center py-4">Loading materials...</div>
              ) : materials.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2" />
                  <p>No materials added yet</p>
                  <p className="text-sm">Click "Add Material" to start</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brand</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((material) => (
                        <TableRow key={material.id}>
                          <TableCell>{material.brand || '-'}</TableCell>
                          <TableCell className="font-medium">{material.model}</TableCell>
                          <TableCell>{material.material_description}</TableCell>
                          <TableCell>{material.quantity}</TableCell>
                          <TableCell>
                            <Badge variant={material.status === 'COMPLETE' ? 'default' : 'secondary'}>
                              {material.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteMaterial(material.id)}
                              disabled={deleteMaterial.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Notes */}
            {container.notes && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Notes</h3>
                <p className="text-sm bg-muted p-3 rounded-lg">{container.notes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddMaterialDialog
        containerId={container.id}
        open={addMaterialDialogOpen}
        onOpenChange={setAddMaterialDialogOpen}
      />
    </>
  );
}