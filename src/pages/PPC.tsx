
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarIcon, Check, Clock, FileCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
const initialScheduledProduction = [
  { 
    id: "SP1", 
    date: "2025-06-10", 
    line: "Line 1", 
    product: "Speaker A300", 
    customer: "AudioTech Inc",
    quantity: 1000, 
    status: "Scheduled", 
    shortages: false,
    originalProjection: "1"
  },
  { 
    id: "SP2", 
    date: "2025-06-11", 
    line: "Line 1", 
    product: "Speaker A300", 
    customer: "AudioTech Inc",
    quantity: 1000, 
    status: "Scheduled", 
    shortages: true,
    originalProjection: "1" 
  },
  { 
    id: "SP3", 
    date: "2025-06-10", 
    line: "Line 2", 
    product: "Subwoofer S200", 
    customer: "SoundMaster",
    quantity: 500, 
    status: "In Progress", 
    shortages: false,
    originalProjection: "2"
  },
];

// Mock data for material shortages
const shortages = {
  "SP2": [
    { partCode: "PCB-123", description: "Main PCB", required: 1000, available: 600, shortage: 400 },
    { partCode: "SPK-A44", description: "Speaker Driver", required: 1000, available: 800, shortage: 200 },
  ]
};

// Organize production by date for calendar view
const getProductionByDate = (scheduledProduction) => {
  const productionByDate = {};
  
  scheduledProduction.forEach(schedule => {
    const date = schedule.date;
    if (!productionByDate[date]) {
      productionByDate[date] = [];
    }
    productionByDate[date].push(schedule);
  });
  
  return productionByDate;
};

const PPC = () => {
  const [selectedProjection, setSelectedProjection] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [partialQuantity, setPartialQuantity] = useState<string>("");
  const [scheduledProduction, setScheduledProduction] = useState(initialScheduledProduction);
  const [selectedTab, setSelectedTab] = useState("planning");
  const [calendarView, setCalendarView] = useState<{ [key: string]: any }>(
    getProductionByDate(initialScheduledProduction)
  );
  
  const { toast } = useToast();

  // Get today's date in YYYY-MM-DD format for the date input min
  const today = new Date();
  const todayString = today.toISOString().split("T")[0];
  
  // Find the projection details
  const selectedProjectionDetails = unscheduledProjections.find(p => p.id === selectedProjection);
  
  // Function to handle production scheduling
  const handleScheduleProduction = () => {
    if (!selectedProjection || !selectedDate || !selectedLine) {
      toast({
        title: "Missing information",
        description: "Please select a projection, date and production line",
        variant: "destructive",
      });
      return;
    }

    // Check if partial quantity is valid
    let quantity = selectedProjectionDetails ? selectedProjectionDetails.quantity : 0;
    if (partialQuantity) {
      const partialQty = parseInt(partialQuantity, 10);
      if (isNaN(partialQty) || partialQty <= 0 || partialQty > quantity) {
        toast({
          title: "Invalid quantity",
          description: "Please enter a valid quantity (greater than 0 and not exceeding the total projection quantity)",
          variant: "destructive",
        });
        return;
      }
      quantity = partialQty;
    }

    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    
    // Create new scheduled production entry
    const newProduction = {
      id: `SP${scheduledProduction.length + 1}`,
      date: formattedDate,
      line: productionLines.find(l => l.id === selectedLine)?.name || selectedLine,
      product: selectedProjectionDetails?.product || "",
      customer: selectedProjectionDetails?.customer || "",
      quantity: quantity,
      status: "Scheduled",
      shortages: Math.random() > 0.7, // Random shortages for demo
      originalProjection: selectedProjection
    };

    // Update scheduled production
    const updatedScheduledProduction = [...scheduledProduction, newProduction];
    setScheduledProduction(updatedScheduledProduction);
    
    // Update calendar view
    setCalendarView(getProductionByDate(updatedScheduledProduction));

    toast({
      title: "Production scheduled",
      description: `Production has been scheduled for ${format(selectedDate, "PP")} on ${newProduction.line}`,
    });

    // Reset selections
    setSelectedProjection(null);
    setSelectedDate(undefined);
    setSelectedLine("");
    setPartialQuantity("");
  };

  // Function to determine the CSS classes for calendar days with scheduled production
  const getDayClass = (date: Date) => {
    const formattedDate = format(date, "yyyy-MM-dd");
    const dayProduction = calendarView[formattedDate];
    
    if (!dayProduction) return "";
    
    if (dayProduction.some(p => p.shortages)) {
      return "bg-red-100 text-red-800 font-bold";
    }
    
    return "bg-green-100 text-green-800 font-bold";
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Production Planning & Control</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="planning">Production Planning</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="planning" className="space-y-4">
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
                          {selectedProjectionDetails?.product} - 
                          {selectedProjectionDetails?.quantity.toLocaleString()} units
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="partialQuantity" className="text-sm font-medium mb-1 block">
                          Quantity to Produce (Optional)
                        </label>
                        <Input
                          id="partialQuantity"
                          type="number"
                          min="1"
                          max={selectedProjectionDetails?.quantity.toString()}
                          value={partialQuantity}
                          onChange={(e) => setPartialQuantity(e.target.value)}
                          placeholder={`Up to ${selectedProjectionDetails?.quantity.toLocaleString()} units`}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Leave empty to schedule the entire quantity
                        </p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Production Date
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !selectedDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? format(selectedDate, "PPP") : <span>Select date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={setSelectedDate}
                              disabled={(date) => date < today}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
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
                              <SelectItem key={line.id} value={line.id}>
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
          </TabsContent>
          
          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Production Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-6">
                  <div>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md border pointer-events-auto"
                      classNames={{
                        day: (date) => getDayClass(date)
                      }}
                      components={{
                        DayContent: (props) => {
                          const formattedDate = format(props.date, "yyyy-MM-dd");
                          const hasProduction = calendarView[formattedDate];
                          return (
                            <div className="relative h-9 w-9 p-0 font-normal flex items-center justify-center">
                              {props.date.getDate()}
                              {hasProduction && (
                                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 h-1 w-1 rounded-full bg-current"></div>
                              )}
                            </div>
                          );
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex-1">
                    {selectedDate ? (
                      <div>
                        <h3 className="text-lg font-medium mb-4">
                          Production on {format(selectedDate, "MMMM d, yyyy")}
                        </h3>
                        
                        {calendarView[format(selectedDate, "yyyy-MM-dd")] ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Line</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {calendarView[format(selectedDate, "yyyy-MM-dd")].map((schedule) => (
                                <TableRow key={schedule.id}>
                                  <TableCell>{schedule.line}</TableCell>
                                  <TableCell className="font-medium">{schedule.product}</TableCell>
                                  <TableCell>{schedule.customer}</TableCell>
                                  <TableCell>{schedule.quantity.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Badge variant={schedule.status === "In Progress" ? "secondary" : "outline"}>
                                      {schedule.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="text-center py-8 bg-gray-50 rounded-lg">
                            <p className="text-muted-foreground">No production scheduled for this date</p>
                            <Button 
                              variant="outline" 
                              className="mt-2"
                              onClick={() => setSelectedTab("planning")}
                            >
                              Schedule Production
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg h-full flex items-center justify-center">
                        <p className="text-muted-foreground">Select a date to view scheduled production</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
            {selectedProjection && shortages["SP2"] && (
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
