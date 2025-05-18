
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Mock data for projections
const unscheduledProjections = [
  { id: "1", customer: "AudioTech Inc", product: "Speaker A300", quantity: 5000, deliveryDate: "2025-06-15" },
  { id: "2", customer: "SoundMaster", product: "Subwoofer S200", quantity: 2000, deliveryDate: "2025-06-30" },
  { id: "3", customer: "EchoSystems", product: "Tweeter T100", quantity: 10000, deliveryDate: "2025-07-10" },
];

// Mock data for production lines
const productionLines = [
  { id: "L1", name: "Line 1", capacity: 1000 },
  { id: "L2", name: "Line 2", capacity: 1500 },
  { id: "L3", name: "Line 3", capacity: 2000 },
];

// Mock data for scheduled production
const scheduledProduction = [
  { id: "SP1", date: "2025-06-10", line: "Line 1", product: "Speaker A300", quantity: 1000, status: "Scheduled", shortages: false },
  { id: "SP2", date: "2025-06-11", line: "Line 1", product: "Speaker A300", quantity: 1000, status: "Scheduled", shortages: true },
  { id: "SP3", date: "2025-06-10", line: "Line 2", product: "Subwoofer S200", quantity: 500, status: "In Progress", shortages: false },
];

// Mock data for material shortages
const shortages = {
  "SP2": [
    { partCode: "PCB-123", description: "Main PCB", required: 1000, available: 600, shortage: 400 },
    { partCode: "SPK-A44", description: "Speaker Driver", required: 1000, available: 800, shortage: 200 },
  ]
};

const PPC = () => {
  const [selectedProjection, setSelectedProjection] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedLine, setSelectedLine] = useState<string>("");
  const { toast } = useToast();

  const handleScheduleProduction = () => {
    if (!selectedProjection || !selectedDate || !selectedLine) {
      toast({
        title: "Missing information",
        description: "Please select a projection, date and production line",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Production scheduled",
      description: `Production has been scheduled for ${selectedDate} on ${selectedLine}`,
    });

    // Reset selections
    setSelectedProjection(null);
    setSelectedDate("");
    setSelectedLine("");
  };

  // Get today's date in YYYY-MM-DD format for the date input min
  const today = new Date().toISOString().split("T")[0];

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Production Planning & Control</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, 14:35</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Unscheduled Projections</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Delivery Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unscheduledProjections.map((projection) => (
                    <TableRow key={projection.id} className={selectedProjection === projection.id ? "bg-accent" : ""}>
                      <TableCell>
                        <input 
                          type="radio" 
                          name="projection" 
                          checked={selectedProjection === projection.id}
                          onChange={() => setSelectedProjection(projection.id)} 
                        />
                      </TableCell>
                      <TableCell className="font-medium">{projection.customer}</TableCell>
                      <TableCell>{projection.product}</TableCell>
                      <TableCell>{projection.quantity.toLocaleString()}</TableCell>
                      <TableCell>{new Date(projection.deliveryDate).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule Production</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedProjection ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Selected Product</p>
                    <p className="text-sm bg-accent p-2 rounded">
                      {unscheduledProjections.find(p => p.id === selectedProjection)?.product} - 
                      {unscheduledProjections.find(p => p.id === selectedProjection)?.quantity.toLocaleString()} units
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="productionDate" className="text-sm font-medium mb-1 block">
                      Production Date
                    </label>
                    <div className="relative">
                      <input
                        id="productionDate"
                        type="date"
                        min={today}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                      <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="productionLine" className="text-sm font-medium mb-1 block">
                      Production Line
                    </label>
                    <Select value={selectedLine} onValueChange={setSelectedLine}>
                      <SelectTrigger id="productionLine">
                        <SelectValue placeholder="Select production line" />
                      </SelectTrigger>
                      <SelectContent>
                        {productionLines.map((line) => (
                          <SelectItem key={line.id} value={line.name}>
                            {line.name} (Capacity: {line.capacity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    className="w-full mt-4" 
                    onClick={handleScheduleProduction}
                  >
                    Schedule Production
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Select a projection from the list to schedule</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scheduled Production</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Material Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledProduction.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>{new Date(schedule.date).toLocaleDateString()}</TableCell>
                    <TableCell>{schedule.line}</TableCell>
                    <TableCell className="font-medium">{schedule.product}</TableCell>
                    <TableCell>{schedule.quantity.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={schedule.status === "In Progress" ? "secondary" : "outline"}>
                        {schedule.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {schedule.shortages ? (
                        <Badge variant="destructive">Shortages</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Available</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">View Details</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Material Shortage Details */}
            {selectedProjection && (
              <div className="mt-6 border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Material Shortage Analysis</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Shortage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shortages["SP2"]?.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">{item.partCode}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.required}</TableCell>
                        <TableCell>{item.available}</TableCell>
                        <TableCell className="text-red-600 font-medium">{item.shortage}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PPC;
