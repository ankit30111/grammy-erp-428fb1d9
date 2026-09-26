
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
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
  const [date, setDate] = useState<string>(schedule?.scheduled_date || "");
  const updateSchedule = useUpdateProductionSchedule();

  useEffect(() => {
    setQuantity(schedule?.quantity?.toString() || "");
    setDate(schedule?.scheduled_date || "");
  }, [schedule?.id, isOpen]);

  const handleSave = async () => {
    const newQuantity = parseInt(quantity);
    if (newQuantity <= 0 || newQuantity > maxQuantity) {
      return;
    }

    try {
      await updateSchedule.mutateAsync({
        scheduleId: schedule.id,
        updates: { quantity: newQuantity, ...(date && date !== schedule.scheduled_date ? { scheduled_date: date } : {}) }
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
          <DialogTitle>Edit Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Product: {(schedule?.projections?.parts ?? schedule?.parts)?.name}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              For: {schedule?.projections?.customers?.name
                ?? (schedule?.production_orders?.[0]?.parent?.voucher_number
                  ? `${schedule.production_orders[0].parent.voucher_number} (${schedule.production_orders[0].parent.part_code})`
                  : "Stock build")}
            </p>
          </div>
          
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={Number.isFinite(maxQuantity) ? maxQuantity : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
            <p className="text-sm text-muted-foreground mt-1">
              {Number.isFinite(maxQuantity) ? `Maximum available: ${maxQuantity} units` : "Stock build: no projection limit"}
            </p>
          </div>

          <div>
            <Label>Production date</Label>
            <DatePicker value={date} min={format(new Date(), "yyyy-MM-dd")} onChange={setDate} />
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
