
import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarIcon, Factory, AlertTriangle, Package } from "lucide-react";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules, useCreateProductionSchedule } from "@/hooks/useProductionSchedules";
import { useBOM } from "@/hooks/useBOM";
import { useInventory } from "@/hooks/useInventory";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from "date-fns";

const PlanningEnhanced: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedProjection, setSelectedProjection] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [shortageDialogOpen, setShortageDialogOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  
  const { data: projections } = useProjections();
  const { data: schedules } = useProductionSchedules();
  const { data: bomData } = useBOM();
  const { data: inventory } = useInventory();
  const createSchedule = useCreateProductionSchedule();
  const { toast } = useToast();

  // Get unscheduled projections
  const unscheduledProjections = projections?.filter(projection => {
    const balanceQuantity = projection.quantity - (projection.scheduled_quantity || 0);
    return balanceQuantity > 0;
  }) || [];

  // Get scheduled but not sent to production
  const scheduledNotSentToProduction = schedules?.filter(schedule => 
    schedule.status === 'SCHEDULED'
  ) || [];

  const selectedProjectionData = projections?.find(p => p.id === selectedProjection);
  const maxQuantity = selectedProjectionData ? 
    selectedProjectionData.quantity - (selectedProjectionData.scheduled_quantity || 0) : 0;

  const handleSchedule = async () => {
    if (!selectedDate || !selectedProjection || !quantity) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    if (parseInt(quantity) > maxQuantity) {
      toast({
        title: "Invalid Quantity",
        description: `Quantity cannot exceed balance of ${maxQuantity}`,
        variant: "destructive",
      });
      return;
    }

    try {
      await createSchedule.mutateAsync({
        projection_id: selectedProjection,
        scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
        quantity: parseInt(quantity),
        production_line: "TBD", // Will be assigned later
      });

      // Reset form
      setSelectedDate(undefined);
      setSelectedProjection("");
      setQuantity("");
      
    } catch (error) {
      console.error('Error scheduling production:', error);
      toast({
        title: "Error",
        description: "Failed to schedule production",
        variant: "destructive",
      });
    }
  };

  // Calendar grid component
  const CalendarGrid = () => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Pad with previous month days to align week start
    const startDay = getDay(monthStart);
    const paddedDays = [];
    for (let i = 0; i < startDay; i++) {
      paddedDays.push(null);
    }
    paddedDays.push(...daysInMonth);

    const getSchedulesForDate = (date: Date) => {
      return schedules?.filter(schedule => 
        isSameDay(new Date(schedule.scheduled_date), date)
      ) || [];
    };

    return (
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center font-semibold text-muted-foreground border-b">
            {day}
          </div>
        ))}
        {paddedDays.map((date, index) => {
          if (!date) {
            return <div key={index} className="h-24 border border-muted"></div>;
          }
          
          const daySchedules = getSchedulesForDate(date);
          
          return (
            <div key={index} className="h-24 border border-muted p-1 overflow-y-auto">
              <div className="font-medium text-sm mb-1">
                {format(date, 'd')}
              </div>
              {daySchedules.map((schedule, scheduleIndex) => (
                <div 
                  key={scheduleIndex} 
                  className="text-xs bg-blue-100 rounded p-1 mb-1 cursor-pointer hover:bg-blue-200"
                  onClick={() => {
                    setSelectedScheduleId(schedule.id);
                    setShortageDialogOpen(true);
                  }}
                >
                  <div className="font-medium truncate">
                    {schedule.projections?.products?.name}
                  </div>
                  <div className="text-muted-foreground">
                    {schedule.quantity} units
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  // BOM Shortage Analysis Component with real-time inventory data
  const BOMShortageAnalysis = () => {
    const selectedSchedule = schedules?.find(s => s.id === selectedScheduleId);
    if (!selectedSchedule) return null;

    const productBOM = bomData?.filter(bom => 
      bom.product_id === selectedSchedule.projections?.products?.id
    ) || [];

    const getBOMWithInventory = () => {
      return productBOM.map(bomItem => {
        const inventoryItem = inventory?.find(inv => inv.raw_material_id === bomItem.raw_material_id);
        const requiredQty = bomItem.quantity * selectedSchedule.quantity;
        const availableQty = inventoryItem?.quantity || 0;
        const shortQty = Math.max(0, requiredQty - availableQty);

        return {
          ...bomItem,
          requiredQuantity: requiredQty,
          availableQuantity: availableQty,
          shortQuantity: shortQty,
        };
      });
    };

    const bomWithInventory = getBOMWithInventory();
    
    // Categorize BOM items based on actual database enum values
    const mainAssembly = bomWithInventory.filter(item => item.bom_type === 'main_assembly');
    const subAssembly = bomWithInventory.filter(item => item.bom_type === 'sub_assembly');
    const accessories = bomWithInventory.filter(item => item.bom_type === 'accessory');

    const BOMSection = ({ title, items }: { title: string; items: any[] }) => (
      <div className="mb-6">
        <h4 className="font-semibold text-lg mb-3 text-blue-600">{title}</h4>
        {items.length === 0 ? (
          <p className="text-muted-foreground">No items in this category</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Code</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Required Quantity</TableHead>
                <TableHead>In Stock</TableHead>
                <TableHead>Short</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {item.raw_materials?.material_code || 'N/A'}
                  </TableCell>
                  <TableCell>{item.raw_materials?.name || 'N/A'}</TableCell>
                  <TableCell>{item.requiredQuantity}</TableCell>
                  <TableCell>{item.availableQuantity}</TableCell>
                  <TableCell>
                    {item.shortQuantity > 0 ? (
                      <Badge variant="destructive">{item.shortQuantity}</Badge>
                    ) : (
                      <Badge variant="secondary">0</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );

    return (
      <div className="space-y-4">
        <div className="text-center pb-4 border-b">
          <h3 className="text-xl font-bold">
            {selectedSchedule.projections?.products?.name}
          </h3>
          <p className="text-muted-foreground">
            Scheduled Quantity: {selectedSchedule.quantity} units
          </p>
        </div>
        
        <BOMSection title="Main Assembly" items={mainAssembly} />
        <BOMSection title="Sub Assembly" items={subAssembly} />
        <BOMSection title="Accessories" items={accessories} />
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Production Planning</h1>
        </div>

        <Tabs defaultValue="planning" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="planning">Production Planning</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled Production</TabsTrigger>
          </TabsList>

          <TabsContent value="planning" className="space-y-6">
            {/* Unscheduled Projections */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Unscheduled Projections
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unscheduledProjections.length > 0 ? (
                  <div className="space-y-3">
                    {unscheduledProjections.map((projection) => {
                      const balanceQuantity = projection.quantity - (projection.scheduled_quantity || 0);
                      return (
                        <div key={projection.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">
                              {projection.customers?.name} - {projection.products?.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Total: {projection.quantity} | Scheduled: {projection.scheduled_quantity || 0} | 
                              Balance: {balanceQuantity}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {balanceQuantity} remaining
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    All projections have been scheduled
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedule Production */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        {unscheduledProjections.map((projection) => {
                          const balanceQuantity = projection.quantity - (projection.scheduled_quantity || 0);
                          return (
                            <SelectItem key={projection.id} value={projection.id}>
                              {projection.customers?.name} - {projection.products?.name} 
                              ({balanceQuantity} units remaining)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

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
                </CardContent>
              </Card>
            </div>

            {/* Production Calendar Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Production Calendar - {format(new Date(), 'MMMM yyyy')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CalendarGrid />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Production</CardTitle>
              </CardHeader>
              <CardContent>
                {scheduledNotSentToProduction.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledNotSentToProduction.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-medium">
                            {schedule.projections?.products?.name}
                          </TableCell>
                          <TableCell>{schedule.quantity}</TableCell>
                          <TableCell>{format(new Date(schedule.scheduled_date), 'PPP')}</TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedScheduleId(schedule.id);
                                setShortageDialogOpen(true);
                              }}
                              className="gap-2"
                            >
                              <AlertTriangle className="h-4 w-4" />
                              Shortages
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No scheduled productions pending
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Shortage Analysis Dialog */}
        <Dialog open={shortageDialogOpen} onOpenChange={setShortageDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Material Requirements & Shortages</DialogTitle>
            </DialogHeader>
            <BOMShortageAnalysis />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PlanningEnhanced;
