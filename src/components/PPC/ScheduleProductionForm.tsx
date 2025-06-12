
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, AlertTriangle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useProjections } from "@/hooks/useProjections";
import { useCreateProductionSchedule } from "@/hooks/useProductionSchedules";
import { useToast } from "@/hooks/use-toast";

interface ScheduleProductionFormProps {
  date: Date | undefined;
  selectedProjection: string | null;
  setSelectedProjection: (id: string | null) => void;
  selectedLine: string;
  setSelectedLine: (id: string) => void;
  quantity: string;
  setQuantity: (quantity: string) => void;
}

const ScheduleProductionForm = ({
  date,
  selectedProjection,
  setSelectedProjection,
  selectedLine,
  setSelectedLine,
  quantity,
  setQuantity,
}: ScheduleProductionFormProps) => {
  const { data: projections } = useProjections();
  const createSchedule = useCreateProductionSchedule();
  const { toast } = useToast();

  // Get selected projection details
  const getSelectedProjection = () => {
    return projections?.find(proj => proj.id === selectedProjection);
  };

  const handleScheduleProduction = async () => {
    if (!date || !selectedProjection || !quantity) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await createSchedule.mutateAsync({
        projection_id: selectedProjection,
        scheduled_date: format(date, 'yyyy-MM-dd'),
        quantity: parseInt(quantity),
        // Production line is now optional - can be assigned later
        production_line: selectedLine || null,
      });

      // Reset form
      setSelectedProjection(null);
      setSelectedLine("");
      setQuantity("");

      toast({
        title: "Production Scheduled",
        description: "Production has been scheduled successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to schedule production. Please try again.",
        variant: "destructive",
      });
    }
  };

  // When a new projection is selected, update the quantity field
  useEffect(() => {
    if (selectedProjection) {
      const projectionDetails = getSelectedProjection();
      if (projectionDetails) {
        setQuantity(projectionDetails.quantity.toString());
      }
    }
  }, [selectedProjection]);

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Schedule Production</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Selected Date</label>
                <div className="p-2 bg-accent rounded flex items-center">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPPP') : 'Select a date'}
                </div>
              </div>
              
              <div>
                <label htmlFor="projection" className="text-sm font-medium mb-1 block">Customer Projection</label>
                <Select value={selectedProjection || ""} onValueChange={setSelectedProjection}>
                  <SelectTrigger id="projection">
                    <SelectValue placeholder="Select projection" />
                  </SelectTrigger>
                  <SelectContent>
                    {projections?.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>
                        {proj.customers?.name} - {proj.products?.name} ({proj.quantity} pcs)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label htmlFor="quantity" className="text-sm font-medium mb-1 block">Quantity to Produce</label>
                <Input 
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                />
              </div>
            </div>
            
            {/* Right column */}
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Production Line Assignment</h4>
                <p className="text-sm text-blue-700">
                  Production line assignment is optional during scheduling. 
                  You can assign production lines later in the production management workflow.
                </p>
              </div>
              
              <div className="pt-6">
                <Button 
                  onClick={handleScheduleProduction}
                  disabled={!date || !selectedProjection || !quantity || createSchedule.isPending}
                  className="w-full"
                >
                  <Check className="mr-2 h-4 w-4" />
                  {createSchedule.isPending ? "Scheduling..." : "Schedule Production"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleProductionForm;
