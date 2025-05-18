
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Check, CalendarIcon, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlannedDate {
  overbooked?: boolean;
  productions?: Production[];
  materialStatus?: {
    available: boolean;
    shortages: RawMaterialShortage[];
  };
}

interface Production {
  id: string;
  customer: string;
  product: string;
  quantity: number;
  line: string;
}

interface RawMaterialShortage {
  partCode: string;
  description: string;
  required: number;
  available: number;
  shortage: number;
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

// Mock BOM data
const bom = {
  "Speaker A300": [
    { partCode: "PCB-123", description: "Main PCB", quantity: 1 },
    { partCode: "SPK-A44", description: "Speaker Driver", quantity: 2 },
    { partCode: "CAP-333", description: "Capacitor 10μF", quantity: 5 },
    { partCode: "RES-456", description: "Resistor Pack", quantity: 10 },
  ],
  "Subwoofer S200": [
    { partCode: "PCB-234", description: "Amplifier PCB", quantity: 1 },
    { partCode: "SPK-B66", description: "Woofer Driver", quantity: 1 },
    { partCode: "CAP-444", description: "Capacitor 1000μF", quantity: 3 },
    { partCode: "CON-789", description: "Speaker Connector", quantity: 1 },
  ],
  "Tweeter T100": [
    { partCode: "PCB-111", description: "Tweeter PCB", quantity: 1 },
    { partCode: "SPK-C22", description: "Tweeter Driver", quantity: 1 },
    { partCode: "RES-456", description: "Resistor Pack", quantity: 5 },
  ],
  "Speaker A100": [
    { partCode: "PCB-123", description: "Main PCB", quantity: 1 },
    { partCode: "SPK-A22", description: "Speaker Driver", quantity: 1 },
    { partCode: "CAP-333", description: "Capacitor 10μF", quantity: 3 },
    { partCode: "RES-456", description: "Resistor Pack", quantity: 5 },
  ]
};

// Mock inventory data
const inventory = {
  "PCB-123": 500,
  "PCB-234": 200,
  "PCB-111": 150,
  "SPK-A44": 800,
  "SPK-B66": 300,
  "SPK-C22": 100,
  "SPK-A22": 400,
  "CAP-333": 2000,
  "CAP-444": 1000,
  "RES-456": 3000,
  "CON-789": 800,
};

const PPC = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [plannedDates, setPlannedDates] = useState<PlannedDates>({});
  const [selectedProjection, setSelectedProjection] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [materialShortages, setMaterialShortages] = useState<RawMaterialShortage[]>([]);
  const [isMaterialsAvailable, setIsMaterialsAvailable] = useState<boolean>(true);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      checkMaterialAvailabilityForDate(formattedDate);
    }
  };

  // Check if materials are available for scheduled productions on a specific date
  const checkMaterialAvailabilityForDate = (formattedDate: string) => {
    const dateProductions = plannedDates[formattedDate]?.productions || [];
    const shortages: RawMaterialShortage[] = [];
    let allAvailable = true;
    
    // Create a copy of inventory to track remaining quantities after allocation
    const remainingInventory = { ...inventory };
    
    // Calculate total requirements for each part based on scheduled productions
    dateProductions.forEach(production => {
      const productBom = bom[production.product as keyof typeof bom] || [];
      
      productBom.forEach(part => {
        const requiredQty = part.quantity * production.quantity;
        const availableQty = remainingInventory[part.partCode as keyof typeof remainingInventory] || 0;
        
        if (availableQty < requiredQty) {
          const shortageQty = requiredQty - availableQty;
          const existingShortageIndex = shortages.findIndex(s => s.partCode === part.partCode);
          
          if (existingShortageIndex >= 0) {
            shortages[existingShortageIndex].required += requiredQty;
            shortages[existingShortageIndex].shortage += shortageQty;
          } else {
            shortages.push({
              partCode: part.partCode,
              description: part.description,
              required: requiredQty,
              available: availableQty,
              shortage: shortageQty
            });
          }
          
          allAvailable = false;
          remainingInventory[part.partCode as keyof typeof remainingInventory] = 0;
        } else {
          remainingInventory[part.partCode as keyof typeof remainingInventory] -= requiredQty;
        }
      });
    });
    
    setMaterialShortages(shortages);
    setIsMaterialsAvailable(allAvailable);
    
    // Update the plannedDates with material status
    setPlannedDates(prev => ({
      ...prev,
      [formattedDate]: {
        ...prev[formattedDate],
        materialStatus: {
          available: allAvailable,
          shortages: shortages
        }
      }
    }));
  };

  // Custom class for calendar days with planned production
  const getDayClass = (day: Date): string => {
    const formattedDate = format(day, 'yyyy-MM-dd');
    if (plannedDates[formattedDate]?.overbooked) {
      return "bg-red-100 text-red-800 font-bold";
    } else if (plannedDates[formattedDate]?.materialStatus?.available === false) {
      return "bg-amber-100 text-amber-800 font-bold";
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

  // Check material availability for a specific product and quantity
  const checkMaterialAvailability = (product: string, qty: number) => {
    const shortages: RawMaterialShortage[] = [];
    let allAvailable = true;
    
    const productBom = bom[product as keyof typeof bom] || [];
    
    productBom.forEach(part => {
      const requiredQty = part.quantity * qty;
      const availableQty = inventory[part.partCode as keyof typeof inventory] || 0;
      
      if (availableQty < requiredQty) {
        shortages.push({
          partCode: part.partCode,
          description: part.description,
          required: requiredQty,
          available: availableQty,
          shortage: requiredQty - availableQty
        });
        allAvailable = false;
      }
    });
    
    setMaterialShortages(shortages);
    setIsMaterialsAvailable(allAvailable);
    return { available: allAvailable, shortages };
  };

  // Schedule production
  const handleScheduleProduction = () => {
    if (date && selectedProjection && selectedLine && quantity) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const projectionDetails = getSelectedProjection();
      const lineDetails = getSelectedLine();
      
      if (!projectionDetails || !lineDetails) return;
      
      const qtyNum = parseInt(quantity);
      
      // Check material availability
      const materialCheck = checkMaterialAvailability(projectionDetails.product, qtyNum);
      
      const production: Production = {
        id: `PROD-${Math.floor(Math.random() * 10000)}`,
        customer: projectionDetails.customer,
        product: projectionDetails.product,
        quantity: qtyNum,
        line: lineDetails.name
      };
      
      // Check if date exists in plannedDates
      if (plannedDates[formattedDate]) {
        // Add to existing date
        const updatedProductions = [...(plannedDates[formattedDate].productions || []), production];
        
        // Calculate total quantity for the date to check if overbooked
        const totalQuantity = updatedProductions.reduce((sum, prod) => sum + prod.quantity, 0);
        const totalCapacity = productionLines.reduce((sum, line) => sum + line.capacity, 0);
        
        setPlannedDates(prev => ({
          ...prev,
          [formattedDate]: {
            ...prev[formattedDate],
            productions: updatedProductions,
            overbooked: totalQuantity > totalCapacity,
            materialStatus: {
              available: materialCheck.available,
              shortages: materialCheck.shortages
            }
          }
        }));
      } else {
        // Create new date entry
        setPlannedDates(prev => ({
          ...prev,
          [formattedDate]: {
            productions: [production],
            overbooked: qtyNum > lineDetails.capacity,
            materialStatus: {
              available: materialCheck.available,
              shortages: materialCheck.shortages
            }
          }
        }));
      }
      
      // Reset form
      setSelectedProjection(null);
      setSelectedLine("");
      setQuantity("");
    }
  };

  // Get productions for selected date
  const getProductionsForDate = () => {
    if (!date) return [];
    const formattedDate = format(date, 'yyyy-MM-dd');
    return plannedDates[formattedDate]?.productions || [];
  };

  // Check if we have material shortages for the selected date
  const getMaterialStatusForDate = () => {
    if (!date) return null;
    const formattedDate = format(date, 'yyyy-MM-dd');
    return plannedDates[formattedDate]?.materialStatus;
  };

  // When a new projection is selected, update the quantity field
  useEffect(() => {
    if (selectedProjection) {
      const projectionDetails = getSelectedProjection();
      if (projectionDetails) {
        setQuantity(projectionDetails.quantity.toString());
        checkMaterialAvailability(projectionDetails.product, projectionDetails.quantity);
      }
    } else {
      setMaterialShortages([]);
    }
  }, [selectedProjection]);

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
                  className="w-full pointer-events-auto"
                  modifiers={{
                    booked: Object.keys(plannedDates).map(date => new Date(date)),
                    overbooked: Object.entries(plannedDates)
                      .filter(([_, data]) => data.overbooked)
                      .map(([date]) => new Date(date)),
                    shortage: Object.entries(plannedDates)
                      .filter(([_, data]) => data.materialStatus?.available === false)
                      .map(([date]) => new Date(date))
                  }}
                  modifiersClassNames={{
                    booked: "bg-green-100 text-green-800 font-bold",
                    overbooked: "bg-red-100 text-red-800 font-bold",
                    shortage: "bg-amber-100 text-amber-800 font-bold"
                  }}
                />
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-100"></div>
                  <span className="text-sm">Production Scheduled</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-amber-100"></div>
                  <span className="text-sm">Material Shortage</span>
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
                        onChange={(e) => {
                          setQuantity(e.target.value);
                          if (selectedProjection) {
                            const projectionDetails = getSelectedProjection();
                            if (projectionDetails && e.target.value) {
                              checkMaterialAvailability(projectionDetails.product, parseInt(e.target.value));
                            }
                          }
                        }}
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
                    
                    {selectedProjection && materialShortages.length > 0 && (
                      <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
                        <h4 className="flex items-center text-sm font-medium text-amber-800 mb-2">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Material Shortage Detected
                        </h4>
                        <ul className="text-xs space-y-1 text-amber-800">
                          {materialShortages.map((shortage, index) => (
                            <li key={index}>
                              {shortage.partCode}: Need {shortage.required}, have {shortage.available} 
                              ({shortage.shortage} short)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="pt-6">
                      <Button 
                        onClick={handleScheduleProduction}
                        disabled={!date || !selectedProjection || !selectedLine || !quantity}
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
                  <TableHead>Material Status</TableHead>
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
                      <TableCell>
                        {getMaterialStatusForDate()?.available === false ? (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Shortage
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                            <Check className="h-3 w-3 mr-1" />
                            Available
                          </Badge>
                        )}
                      </TableCell>
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
            
            {getProductionsForDate().length > 0 && getMaterialStatusForDate()?.shortages.length ? (
              <div className="mt-4 bg-amber-50 p-4 rounded-lg border border-amber-200">
                <h3 className="text-sm font-medium text-amber-800 mb-2 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Raw Material Shortages for This Production Schedule
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-100/50">
                      <TableHead className="text-xs">Part Code</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Required</TableHead>
                      <TableHead className="text-xs">Available</TableHead>
                      <TableHead className="text-xs">Shortage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getMaterialStatusForDate()?.shortages.map((shortage, index) => (
                      <TableRow key={index} className="bg-amber-50/50">
                        <TableCell className="text-xs font-mono">{shortage.partCode}</TableCell>
                        <TableCell className="text-xs">{shortage.description}</TableCell>
                        <TableCell className="text-xs">{shortage.required}</TableCell>
                        <TableCell className="text-xs">{shortage.available}</TableCell>
                        <TableCell className="text-xs font-medium text-amber-800">{shortage.shortage}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PPC;
