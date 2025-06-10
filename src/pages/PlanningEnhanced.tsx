
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
import { useBOMByProduct } from "@/hooks/useBOM";
import { useInventory } from "@/hooks/useInventory";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

const PlanningEnhanced: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedProjection, setSelectedProjection] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [selectedProductForBOM, setSelectedProductForBOM] = useState<string>("");
  const [shortageDialogOpen, setShortageDialogOpen] = useState(false);
  
  const { data: projections } = useProjections();
  const { data: schedules } = useProductionSchedules();
  const { data: bomData } = useBOMByProduct(selectedProductForBOM);
  const { data: inventory } = useInventory();
  const createSchedule = useCreateProductionSchedule();
  const { toast } = useToast();

  // Generate voucher number
  const generateVoucherNumber = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const existingVouchersForMonth = schedules?.filter(schedule => 
      new Date(schedule.scheduled_date).getMonth() + 1 === date.getMonth() + 1
    ) || [];
    const sequenceNumber = existingVouchersForMonth.length + 1;
    return `PROD_${month}_${String(sequenceNumber).padStart(2, '0')}`;
  };

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
      
      toast({
        title: "Success",
        description: `Production scheduled with voucher: ${generateVoucherNumber(selectedDate)}`,
      });
    } catch (error) {
      console.error('Error scheduling production:', error);
      toast({
        title: "Error",
        description: "Failed to schedule production",
        variant: "destructive",
      });
    }
  };

  // Calendar grid generation
  const currentMonth = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group schedules by date
  const schedulesByDate = schedules?.reduce((acc, schedule) => {
    const dateKey = schedule.scheduled_date;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(schedule);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const handleShowShortages = (schedule: any) => {
    setSelectedProductForBOM(schedule.projections?.product_id);
    setShortageDialogOpen(true);
  };

  // Organize BOM by sections
  const organizedBOM = bomData?.reduce((acc, item) => {
    const section = item.bom_type || 'main_assembly';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, any[]>) || {};

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

                  {selectedDate && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Selected Date:</strong> {format(selectedDate, 'PPP')}
                      </p>
                      <p className="text-sm text-blue-800">
                        <strong>Voucher Number:</strong> {generateVoucherNumber(selectedDate)}
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
                </CardContent>
              </Card>
            </div>

            {/* Production Calendar Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Production Calendar - {format(currentMonth, 'MMMM yyyy')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center font-semibold text-muted-foreground border-b">
                      {day}
                    </div>
                  ))}
                  
                  {monthDays.map(day => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const daySchedules = schedulesByDate[dateKey] || [];
                    
                    return (
                      <div key={dateKey} className="min-h-[100px] p-2 border rounded">
                        <div className="text-sm font-medium mb-1">
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {daySchedules.map((schedule, index) => (
                            <div key={index} className="text-xs bg-blue-100 p-1 rounded cursor-pointer hover:bg-blue-200">
                              <div className="font-medium truncate">
                                {schedule.projections?.products?.name}
                              </div>
                              <div className="text-muted-foreground">
                                Qty: {schedule.quantity}
                              </div>
                              <div className="text-muted-foreground">
                                {generateVoucherNumber(new Date(schedule.scheduled_date))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                        <TableHead>Voucher Number</TableHead>
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
                          <TableCell className="font-mono">
                            {generateVoucherNumber(new Date(schedule.scheduled_date))}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleShowShortages(schedule)}
                            >
                              <AlertTriangle className="h-4 w-4 mr-1" />
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

        {/* BOM Shortage Dialog */}
        <Dialog open={shortageDialogOpen} onOpenChange={setShortageDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Material Requirements & Shortages</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {Object.entries(organizedBOM).map(([section, items]) => (
                <div key={section}>
                  <h3 className="text-lg font-semibold mb-3 capitalize">
                    {section.replace('_', ' ')}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Part Code</TableHead>
                        <TableHead>Material Name</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>In Stock</TableHead>
                        <TableHead>Short</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => {
                        const stockItem = inventory?.find(inv => inv.raw_material_id === item.raw_material_id);
                        const inStock = stockItem?.quantity || 0;
                        const required = item.quantity;
                        const shortage = Math.max(0, required - inStock);
                        
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">
                              {item.raw_materials?.material_code}
                            </TableCell>
                            <TableCell>{item.raw_materials?.name}</TableCell>
                            <TableCell>{required}</TableCell>
                            <TableCell>{inStock}</TableCell>
                            <TableCell>
                              {shortage > 0 ? (
                                <span className="text-red-600 font-medium">{shortage}</span>
                              ) : (
                                <span className="text-green-600">✓</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PlanningEnhanced;
