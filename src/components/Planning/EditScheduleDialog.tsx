
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateProductionSchedule } from "@/hooks/useProductionSchedules";

interface EditScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: any;
  maxQuantity: number;
}

export const EditScheduleDialog = ({ isOpen, onClose, schedule, maxQuantity }: EditScheduleDialogProps) => {
  const [quantity, setQuantity] = useState(schedule?.quantity?.toString() || "");
  const updateSchedule = useUpdateProductionSchedule();

  const handleSave = async () => {
    const newQuantity = parseInt(quantity);
    if (newQuantity <= 0 || newQuantity > maxQuantity) {
      return;
    }

    try {
      await updateSchedule.mutateAsync({
        scheduleId: schedule.id,
        updates: { quantity: newQuantity }
      });
      onClose();
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Production Quantity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Product: {schedule?.projections?.products?.name}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Customer: {schedule?.projections?.customers?.name}
            </p>
          </div>
          
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={maxQuantity}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Maximum available: {maxQuantity} units
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!quantity || parseInt(quantity) <= 0 || parseInt(quantity) > maxQuantity || updateSchedule.isPending}
            >
              {updateSchedule.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
