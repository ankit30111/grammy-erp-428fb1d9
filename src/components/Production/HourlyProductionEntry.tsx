import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface HourlyProductionEntryProps {
  voucherId: string;
  voucherNumber: string;
}

const HourlyProductionEntry = ({ voucherId, voucherNumber }: HourlyProductionEntryProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hourlyData, setHourlyData] = useState({
    hour: "",
    production_units: "",
    downtime_minutes: "",
    efficiency_percentage: "",
    remarks: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing hourly production data
  const { data: existingData = [] } = useQuery({
    queryKey: ["hourly-production-detail", voucherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hourly_production")
        .select("*")
        .eq("production_order_id", voucherId)
        .order("hour", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  // Add hourly production entry
  const addHourlyEntry = useMutation({
    mutationFn: async (entryData: any) => {
      const { error } = await supabase
        .from("hourly_production")
        .insert({
          production_order_id: voucherId,
          hour: entryData.hour,
          production_units: parseInt(entryData.production_units),
          downtime_minutes: parseInt(entryData.downtime_minutes) || 0,
          efficiency_percentage: parseInt(entryData.efficiency_percentage) || 100,
          remarks: entryData.remarks || null
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Hourly Entry Added",
        description: "Production data has been recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["hourly-production-detail"] });
      queryClient.invalidateQueries({ queryKey: ["line-production"] });
      setHourlyData({
        hour: "",
        production_units: "",
        downtime_minutes: "",
        efficiency_percentage: "",
        remarks: ""
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hourlyData.hour || !hourlyData.production_units) {
      toast({
        title: "Missing Information",
        description: "Please fill in the hour and production units",
        variant: "destructive",
      });
      return;
    }
    addHourlyEntry.mutate(hourlyData);
  };

  const totalProduced = existingData.reduce((sum, entry) => sum + entry.production_units, 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Clock className="h-4 w-4" />
          Hourly Production Entry
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Hourly Production Entry - {voucherNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Entry Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Add New Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Hour</label>
                <Input
                  type="time"
                  value={hourlyData.hour}
                  onChange={(e) => setHourlyData(prev => ({ ...prev, hour: e.target.value }))}
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Production Units</label>
                <Input
                  type="number"
                  min="0"
                  value={hourlyData.production_units}
                  onChange={(e) => setHourlyData(prev => ({ ...prev, production_units: e.target.value }))}
                  placeholder="Enter units produced"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Downtime (minutes)</label>
                <Input
                  type="number"
                  min="0"
                  max="60"
                  value={hourlyData.downtime_minutes}
                  onChange={(e) => setHourlyData(prev => ({ ...prev, downtime_minutes: e.target.value }))}
                  placeholder="0"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Efficiency (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={hourlyData.efficiency_percentage}
                  onChange={(e) => setHourlyData(prev => ({ ...prev, efficiency_percentage: e.target.value }))}
                  placeholder="100"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Remarks</label>
                <Input
                  value={hourlyData.remarks}
                  onChange={(e) => setHourlyData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Optional remarks"
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={addHourlyEntry.isPending}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Entry
              </Button>
            </form>
          </div>

          {/* Existing Entries */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Hourly Production Log</h3>
              <div className="text-sm text-muted-foreground">
                Total Produced: <span className="font-medium">{totalProduced}</span>
              </div>
            </div>
            
            {existingData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hourly entries recorded yet
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hour</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Efficiency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {existingData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.hour}</TableCell>
                        <TableCell>{entry.production_units}</TableCell>
                        <TableCell>{entry.efficiency_percentage}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HourlyProductionEntry;
