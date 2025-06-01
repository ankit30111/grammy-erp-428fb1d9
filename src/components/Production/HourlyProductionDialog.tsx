
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Clock, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface HourlyProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionLine: string | null;
}

const HourlyProductionDialog = ({ open, onOpenChange, productionLine }: HourlyProductionDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hourlyData, setHourlyData] = useState({
    hour: "",
    production: "",
    downtime: "",
    efficiency: "",
    remarks: ""
  });

  // Get current production order for this line
  const { data: currentOrder } = useQuery({
    queryKey: ["current-production-order", productionLine],
    queryFn: async () => {
      if (!productionLine) return null;
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!inner(name),
          production_schedules!inner(production_line)
        `)
        .eq("status", "IN_PROGRESS")
        .eq("production_schedules.production_line", productionLine)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!productionLine && open,
  });

  // Get hourly production data for today
  const { data: hourlyProduction = [] } = useQuery({
    queryKey: ["hourly-production", currentOrder?.id],
    queryFn: async () => {
      if (!currentOrder?.id) return [];
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("hourly_production")
        .select("*")
        .eq("production_order_id", currentOrder.id)
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59`)
        .order("hour", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrder?.id && open,
  });

  // Calculate total produced today
  const totalProduced = hourlyProduction.reduce((sum, entry) => sum + entry.production_units, 0);

  // Save hourly production data
  const saveHourlyData = useMutation({
    mutationFn: async (data: typeof hourlyData) => {
      if (!currentOrder?.id) throw new Error("No active production order");
      
      const { error } = await supabase
        .from("hourly_production")
        .insert({
          production_order_id: currentOrder.id,
          hour: data.hour,
          production_units: parseInt(data.production),
          downtime_minutes: parseInt(data.downtime) || 0,
          efficiency_percentage: parseInt(data.efficiency) || 0,
          remarks: data.remarks || null
        });
      
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["hourly-production"] });
      queryClient.invalidateQueries({ queryKey: ["production-lines-orders"] });
      
      // Check if production is complete
      const newTotal = totalProduced + parseInt(hourlyData.production);
      if (newTotal >= currentOrder.quantity) {
        // Mark production as completed
        await supabase
          .from("production_orders")
          .update({ status: "COMPLETED" })
          .eq("id", currentOrder.id);
        
        queryClient.invalidateQueries({ queryKey: ["current-production-order"] });
        queryClient.invalidateQueries({ queryKey: ["scheduled-productions"] });
        
        toast({
          title: "Production Completed!",
          description: `Production target of ${currentOrder.quantity} units reached. Order moved to OQC queue.`,
        });
      } else {
        toast({
          title: "Success",
          description: "Hourly production data saved successfully",
        });
      }
      
      setHourlyData({
        hour: "",
        production: "",
        downtime: "",
        efficiency: "",
        remarks: ""
      });
    },
    onError: (error) => {
      console.error("Error saving hourly data:", error);
      toast({
        title: "Error",
        description: "Failed to save hourly production data",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hourlyData.hour || !hourlyData.production) {
      toast({
        title: "Error",
        description: "Please fill in hour and production data",
        variant: "destructive",
      });
      return;
    }

    saveHourlyData.mutate(hourlyData);
  };

  const getCurrentHour = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  if (!currentOrder) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Hourly Production Data - {productionLine}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 text-muted-foreground">
            No active production on this line
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Hourly Production Data - {productionLine}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Production</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Product:</span>
                  <div>{currentOrder.products?.name}</div>
                </div>
                <div>
                  <span className="font-medium">Voucher:</span>
                  <div>{currentOrder.voucher_number}</div>
                </div>
                <div>
                  <span className="font-medium">Target:</span>
                  <div>{currentOrder.quantity} units</div>
                </div>
                <div>
                  <span className="font-medium">Produced:</span>
                  <div className={totalProduced >= currentOrder.quantity ? "text-green-600 font-bold" : ""}>
                    {totalProduced} units
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add New Entry */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Hourly Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="hour">Hour</Label>
                    <Input
                      id="hour"
                      type="time"
                      value={hourlyData.hour}
                      onChange={(e) => setHourlyData(prev => ({ ...prev, hour: e.target.value }))}
                      placeholder={getCurrentHour()}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="production">Production (units)</Label>
                    <Input
                      id="production"
                      type="number"
                      value={hourlyData.production}
                      onChange={(e) => setHourlyData(prev => ({ ...prev, production: e.target.value }))}
                      placeholder="Enter units produced"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="downtime">Downtime (minutes)</Label>
                    <Input
                      id="downtime"
                      type="number"
                      value={hourlyData.downtime}
                      onChange={(e) => setHourlyData(prev => ({ ...prev, downtime: e.target.value }))}
                      placeholder="Enter downtime"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="efficiency">Efficiency (%)</Label>
                    <Input
                      id="efficiency"
                      type="number"
                      value={hourlyData.efficiency}
                      onChange={(e) => setHourlyData(prev => ({ ...prev, efficiency: e.target.value }))}
                      placeholder="Enter efficiency"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="remarks">Remarks</Label>
                    <Input
                      id="remarks"
                      value={hourlyData.remarks}
                      onChange={(e) => setHourlyData(prev => ({ ...prev, remarks: e.target.value }))}
                      placeholder="Optional remarks"
                    />
                  </div>
                </div>
                
                <Button type="submit" className="gap-2" disabled={saveHourlyData.isPending}>
                  <Save className="h-4 w-4" />
                  Save Entry
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Historical Data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today's Production Data</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hour</TableHead>
                    <TableHead>Production</TableHead>
                    <TableHead>Downtime (min)</TableHead>
                    <TableHead>Efficiency (%)</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hourlyProduction.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{entry.hour}</TableCell>
                      <TableCell>{entry.production_units}</TableCell>
                      <TableCell>{entry.downtime_minutes}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          entry.efficiency_percentage >= 90 ? 'text-green-600' : 
                          entry.efficiency_percentage >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {entry.efficiency_percentage}%
                        </span>
                      </TableCell>
                      <TableCell>{entry.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {hourlyProduction.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No hourly data recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HourlyProductionDialog;
