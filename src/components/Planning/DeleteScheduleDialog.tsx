
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteProductionSchedule } from "@/hooks/useProductionSchedules";
import { AlertTriangle } from "lucide-react";

interface DeleteScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: any;
}

export const DeleteScheduleDialog = ({ isOpen, onClose, schedule }: DeleteScheduleDialogProps) => {
  const deleteSchedule = useDeleteProductionSchedule();

  const handleDelete = async () => {
    try {
      await deleteSchedule.mutateAsync(schedule.id);
      onClose();
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Production Schedule
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Are you sure you want to delete this production schedule?
            </p>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium">{schedule?.projections?.products?.name}</p>
              <p className="text-sm text-muted-foreground">
                Customer: {schedule?.projections?.customers?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                Quantity: {schedule?.quantity} units
              </p>
            </div>
            <p className="text-sm text-destructive mt-3">
              This action cannot be undone and will also delete the associated production order.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteSchedule.isPending}
            >
              {deleteSchedule.isPending ? "Deleting..." : "Delete Schedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
