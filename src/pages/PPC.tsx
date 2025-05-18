
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Check, CalendarIcon, Clock } from "lucide-react";

interface PlannedDate {
  overbooked?: boolean;
  productions?: Production[];
}

interface Production {
  id: string;
  customer: string;
  product: string;
  quantity: number;
  line: string;
  shift: string;
}

interface PlannedDates {
  [date: string]: PlannedDate;
}

// Mock data for projections
const projections = [
  { id: "PRJ001", customer: "AudioTech Inc", product: "Speaker A300", quantity: 1000, dueDate: "2025-05-25" },
  { id: "PRJ002", customer: "SoundMaster", product: "Subwoofer S200", quantity: 500, dueDate: "2025-05-27" },
  { id: "PRJ003", customer: "EchoSystems", product: "Tweeter T100", quantity: 300, dueDate: "2025-05-28" },
  { id: "PRJ004", customer: "AudioTech Inc", product: "Speaker A100", quantity: 800, dueDate: "2025-06-02" }
];

// Mock data for production lines
const productionLines = [
  { id: "L1", name: "Line 1", capacity: 300 },
  { id: "L2", name: "Line 2", capacity: 400 },
  { id: "L3", name: "Line 3", capacity: 250 }
];

const shifts = ["Morning", "Afternoon", "Night"];

const PPC = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [plannedDates, setPlannedDates] = useState<PlannedDates>({});
  const [selectedProjection, setSelectedProjection] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
  };

  // Custom class for calendar days with planned production
  const getDayClass = (day: Date): string => {
    const formattedDate = format(day, 'yyyy-MM-dd');
    if (plannedDates[formattedDate]?.overbooked) {
      return "bg-red-100 text-red-800 font-bold";
    } else if (plannedDates[formattedDate]) {
      return "bg-green-100 text-green-800 font-bold";
    }
    return "";
  };

  // Get selected projection details
  const getSelectedProjection = () => {
    return projections.find(proj => proj.id === selectedProjection);
  };

  // Get selected production line details
  const getSelectedLine = () => {
    return productionLines.find(line => line.id === selectedLine);
  };

  // Schedule production
  const handleScheduleProduction = () => {
    if (date && selectedProjection && selectedLine && selectedShift && quantity) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const projectionDetails = getSelectedProjection();
      const lineDetails = getSelectedLine();
      
      if (!projectionDetails || !lineDetails) return;
      
      const qtyNum = parseInt(quantity);
      const production: Production = {
        id: `PROD-${Math.floor(Math.random() * 10000)}`,
        customer: projectionDetails.customer,
        product: projectionDetails.product,
        quantity: qtyNum,
        line: lineDetails.name,
        shift: selectedShift
      };
      
      // Check if date exists in plannedDates
      if (plannedDates[formattedDate]) {
        // Add to existing date
        const updatedProductions = [...(plannedDates[formattedDate].productions || []), production];
        
        // Calculate total quantity for the date to check if overbooked
        const totalQuantity = updatedProductions.reduce((sum, prod) => sum + prod.quantity, 0);
        const totalCapacity = productionLines.reduce((sum, line) => sum + line.capacity, 0) * shifts.length;
        
        setPlannedDates(prev => ({
          ...prev,
          [formattedDate]: {
            ...prev[formattedDate],
            productions: updatedProductions,
            overbooked: totalQuantity > totalCapacity
          }
        }));
      } else {
        // Create new date entry
        setPlannedDates(prev => ({
          ...prev,
          [formattedDate]: {
            productions: [production],
            overbooked: qtyNum > lineDetails.capacity
          }
        }));
      }
      
      // Reset form
      setSelectedProjection(null);
      setSelectedLine("");
      setSelectedShift("");
      setQuantity("");
    }
  };

  // Get productions for selected date
  const getProductionsForDate = () => {
    if (!date) return [];
    const formattedDate = format(date, 'yyyy-MM-dd');
    return plannedDates[formattedDate]?.productions || [];
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Production Planning Calendar</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Calendar Card */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Production Calendar</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="rounded-md border">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                  className="w-full"
                  modifiers={{
                    booked: Object.keys(plannedDates).map(date => new Date(date)),
                    overbooked: Object.entries(plannedDates)
                      .filter(([_, data]) => data.overbooked)
                      .map(([date]) => new Date(date))
                  }}
                  modifiersClassNames={{
                    booked: "bg-green-100 text-green-800 font-bold",
                    overbooked: "bg-red-100 text-red-800 font-bold"
                  }}
                />
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-100"></div>
                  <span className="text-sm">Production Scheduled</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-100"></div>
                  <span className="text-sm">Capacity Overbooked</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Production Card */}
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
                          {projections.map((proj) => (
                            <SelectItem key={proj.id} value={proj.id}>
                              {proj.customer} - {proj.product} ({proj.quantity} pcs)
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
                    <div>
                      <label htmlFor="line" className="text-sm font-medium mb-1 block">Production Line</label>
                      <Select value={selectedLine} onValueChange={setSelectedLine}>
                        <SelectTrigger id="line">
                          <SelectValue placeholder="Select production line" />
                        </SelectTrigger>
                        <SelectContent>
                          {productionLines.map((line) => (
                            <SelectItem key={line.id} value={line.id}>
                              {line.name} (Capacity: {line.capacity} pcs/day)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label htmlFor="shift" className="text-sm font-medium mb-1 block">Production Shift</label>
                      <Select value={selectedShift} onValueChange={setSelectedShift}>
                        <SelectTrigger id="shift">
                          <SelectValue placeholder="Select shift" />
                        </SelectTrigger>
                        <SelectContent>
                          {shifts.map((shift) => (
                            <SelectItem key={shift} value={shift}>{shift}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="pt-6">
                      <Button 
                        onClick={handleScheduleProduction}
                        disabled={!date || !selectedProjection || !selectedLine || !selectedShift || !quantity}
                        className="w-full"
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Schedule Production
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Production Schedule Table */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {date ? `Production Schedule for ${format(date, 'PPP')}` : 'Select a date to view schedule'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Production Line</TableHead>
                  <TableHead>Shift</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getProductionsForDate().length > 0 ? (
                  getProductionsForDate().map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell className="font-medium">{prod.id}</TableCell>
                      <TableCell>{prod.customer}</TableCell>
                      <TableCell>{prod.product}</TableCell>
                      <TableCell>{prod.quantity}</TableCell>
                      <TableCell>{prod.line}</TableCell>
                      <TableCell>{prod.shift}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No production scheduled for this date
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PPC;
