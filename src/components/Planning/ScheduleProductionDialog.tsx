
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface ScheduleProductionDialogProps {
  projection: any;
  isOpen: boolean;
  onClose: () => void;
  maxQuantity: number;
}

export const ScheduleProductionDialog = ({
  projection,
  isOpen,
  onClose,
  maxQuantity
}: ScheduleProductionDialogProps) => {
  const [quantity, setQuantity] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSchedule = async () => {
    if (!projection || !scheduledDate || !quantity) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    const quantityNum = parseInt(quantity);
    if (quantityNum <= 0 || quantityNum > maxQuantity) {
      toast({
        title: "Invalid Quantity",
        description: `Quantity must be between 1 and ${maxQuantity}`,
        variant: "destructive"
      });
      return;
    }

    // Additional check against projection total
    if (maxQuantity === 0) {
      toast({
        title: "Cannot Schedule More Production",
        description: "Projected quantity for this product is already fully planned.",
        variant: "destructive"
      });
      return;
    }

    // Check if scheduling this quantity would exceed the projection total
    const currentScheduled = projection.scheduled_quantity || 0;
    if (currentScheduled + quantityNum > projection.quantity) {
      toast({
        title: "Cannot Over-Schedule",
        description: `This would exceed the projection quantity. Only ${projection.quantity - currentScheduled} units can be scheduled.`,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Insert production schedule
      const { data: schedule, error: scheduleError } = await supabase
        .from("production_schedules")
        .insert({
          projection_id: projection.id,
          quantity: quantityNum,
          scheduled_date: format(scheduledDate, "yyyy-MM-dd"),
          production_line: "Line 1", // Default line
          status: "SCHEDULED"
        })
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // Generate voucher number
      const voucherNumber = `PRD-${Date.now().toString().slice(-6)}`;

      // Insert production order
      const { error: orderError } = await supabase
        .from("production_orders")
        .insert({
          production_schedule_id: schedule.id,
          product_id: projection.product_id,
          quantity: quantityNum,
          scheduled_date: format(scheduledDate, "yyyy-MM-dd"),
          voucher_number: voucherNumber,
          status: "PENDING"
        });

      if (orderError) throw orderError;

      toast({
        title: "Production Scheduled",
        description: `${quantityNum} units scheduled for ${format(scheduledDate, "PPP")}`
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["projections"] });
      queryClient.invalidateQueries({ queryKey: ["production-schedules"] });
      
      // Reset form and close
      setQuantity("");
      setScheduledDate(undefined);
      onClose();
      
    } catch (error) {
      console.error('Error scheduling production:', error);
      toast({
        title: "Error",
        description: "Failed to schedule production",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Production</DialogTitle>
        </DialogHeader>
        
        {projection && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <div className="text-sm font-medium">{projection.customers?.name}</div>
            </div>
            
            <div className="space-y-2">
              <Label>Product</Label>
              <div className="text-sm font-medium">{projection.products?.name}</div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm">
                <div className="font-medium">Projection Summary:</div>
                <div>Total Quantity: {projection.quantity?.toLocaleString()}</div>
                <div>Already Scheduled: {(projection.scheduled_quantity || 0).toLocaleString()}</div>
                <div className="font-medium text-blue-600">
                  Available to Schedule: {maxQuantity.toLocaleString()}
                </div>
                {maxQuantity === 0 && (
                  <div className="text-red-600 font-medium mt-2">
                    ⚠️ This projection is fully scheduled
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity to Schedule (Max: {maxQuantity.toLocaleString()})</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                max={maxQuantity}
                min="1"
                placeholder="Enter quantity"
                disabled={maxQuantity === 0}
              />
              {maxQuantity === 0 ? (
                <p className="text-sm text-red-600">
                  Cannot schedule more production. Projected quantity for this product is already fully planned.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter quantity between 1 and {maxQuantity.toLocaleString()}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground"
                    )}
                    disabled={maxQuantity === 0}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSchedule} 
            disabled={isLoading || maxQuantity === 0}
          >
            {isLoading ? "Scheduling..." : "Schedule Production"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
