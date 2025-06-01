
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Factory } from "lucide-react";
import { useProjections } from "@/hooks/useProjections";
import { useCreateProductionSchedule } from "@/hooks/useProductionSchedules";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const SchedulingProduction = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedProjection, setSelectedProjection] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");

  const { data: projections } = useProjections();
  const createSchedule = useCreateProductionSchedule();
  const { toast } = useToast();

  const unscheduledProjections = projections?.filter(projection => {
    return projection.quantity > 0;
  }) || [];

  const selectedProjectionData = projections?.find(p => p.id === selectedProjection);
  const maxQuantity = selectedProjectionData?.quantity || 0;

  const handleSchedule = async () => {
    if (!selectedDate || !selectedProjection || !quantity) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to schedule production.",
        variant: "destructive",
      });
      return;
    }

    if (parseInt(quantity) > maxQuantity) {
      toast({
        title: "Invalid Quantity",
        description: `Quantity exceeds the maximum available for this projection (${maxQuantity} units).`,
        variant: "destructive",
      });
      return;
    }

    try {
      await createSchedule.mutateAsync({
        projection_id: selectedProjection,
        scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
        quantity: parseInt(quantity),
      });

      // Reset form
      setSelectedDate(undefined);
      setSelectedProjection("");
      setQuantity("");
    } catch (error) {
      console.error('Error scheduling production:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Select Production Date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={(date) => date < new Date()}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      {/* Scheduling Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Schedule Production
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="projection">Customer Projection</Label>
            <Select value={selectedProjection} onValueChange={setSelectedProjection}>
              <SelectTrigger>
                <SelectValue placeholder="Select projection" />
              </SelectTrigger>
              <SelectContent>
                {unscheduledProjections.map((projection) => (
                  <SelectItem key={projection.id} value={projection.id}>
                    {projection.customers?.name} - {projection.products?.name} ({projection.quantity} units)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedDate && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Selected Date:</strong> {format(selectedDate, 'PPP')}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="quantity">Quantity to Produce</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={maxQuantity}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
            {selectedProjectionData && (
              <p className="text-sm text-muted-foreground mt-1">
                Maximum available: {maxQuantity} units
              </p>
            )}
          </div>

          <Button 
            onClick={handleSchedule}
            disabled={!selectedDate || !selectedProjection || !quantity || createSchedule.isPending}
            className="w-full gap-2"
          >
            <Factory className="h-4 w-4" />
            {createSchedule.isPending ? "Scheduling..." : "Schedule Production"}
          </Button>

          {unscheduledProjections.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              No unscheduled projections available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SchedulingProduction;
