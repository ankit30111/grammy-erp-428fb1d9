
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Clock, Save } from "lucide-react";

interface HourlyProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionLine: string | null;
}

const HourlyProductionDialog = ({ open, onOpenChange, productionLine }: HourlyProductionDialogProps) => {
  const { toast } = useToast();
  const [hourlyData, setHourlyData] = useState({
    hour: "",
    production: "",
    downtime: "",
    efficiency: "",
    remarks: ""
  });

  // Mock hourly production data - this would come from database
  const mockHourlyProduction = [
    { hour: "08:00", production: 45, downtime: 0, efficiency: 90, remarks: "Good start" },
    { hour: "09:00", production: 48, downtime: 10, efficiency: 85, remarks: "Minor delay" },
    { hour: "10:00", production: 50, downtime: 0, efficiency: 95, remarks: "Excellent" },
  ];

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

    // Here you would save the data to the database
    toast({
      title: "Success",
      description: "Hourly production data saved successfully",
    });

    setHourlyData({
      hour: "",
      production: "",
      downtime: "",
      efficiency: "",
      remarks: ""
    });
  };

  const getCurrentHour = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Hourly Production Data - {productionLine}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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
                
                <Button type="submit" className="gap-2">
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
                  {mockHourlyProduction.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{entry.hour}</TableCell>
                      <TableCell>{entry.production}</TableCell>
                      <TableCell>{entry.downtime}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          entry.efficiency >= 90 ? 'text-green-600' : 
                          entry.efficiency >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {entry.efficiency}%
                        </span>
                      </TableCell>
                      <TableCell>{entry.remarks}</TableCell>
                    </TableRow>
                  ))}
                  {mockHourlyProduction.length === 0 && (
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
