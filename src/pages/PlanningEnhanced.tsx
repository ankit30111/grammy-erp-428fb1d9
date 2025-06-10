
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
import { Calendar as CalendarIcon, Factory, AlertTriangle, Package } from "lucide-react";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules, useCreateProductionSchedule } from "@/hooks/useProductionSchedules";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const PlanningEnhanced: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedProjection, setSelectedProjection] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [productionLine, setProductionLine] = useState<string>("");
  const [shortageDetails, setShortageDetails] = useState<any>(null);
  
  const { data: projections } = useProjections();
  const { data: schedules } = useProductionSchedules();
  const createSchedule = useCreateProductionSchedule();
  const { toast } = useToast();

  const productionLines = ["Line 1", "Line 2", "Sub Assembly 1", "Sub Assembly 2"];

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
    if (!selectedDate || !selectedProjection || !quantity || !productionLine) {
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
        production_line: productionLine,
      });

      // Reset form
      setSelectedDate(undefined);
      setSelectedProjection("");
      setQuantity("");
      setProductionLine("");
      
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

  // Calendar data for display
  const calendarData = schedules?.reduce((acc, schedule) => {
    const dateKey = schedule.scheduled_date;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push({
      ...schedule,
      voucherNumber: generateVoucherNumber(new Date(schedule.scheduled_date))
    });
    return acc;
  }, {} as Record<string, any[]>) || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Production Planning</h1>
        </div>

        <Tabs defaultValue="planning" className="space-y-4">
          <TabsList>
            <TabsTrigger value="planning">Production Planning</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled Productions</TabsTrigger>
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

                  <div>
                    <Label htmlFor="production-line">Production Line</Label>
                    <Select value={productionLine} onValueChange={setProductionLine}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select production line" />
                      </SelectTrigger>
                      <SelectContent>
                        {productionLines.map((line) => (
                          <SelectItem key={line} value={line}>
                            {line}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleSchedule}
                    disabled={!selectedDate || !selectedProjection || !quantity || !productionLine || createSchedule.isPending}
                    className="w-full gap-2"
                  >
                    <Factory className="h-4 w-4" />
                    {createSchedule.isPending ? "Scheduling..." : "Schedule Production"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Calendar View */}
            <Card>
              <CardHeader>
                <CardTitle>Production Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center font-semibold text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>
                
                {Object.keys(calendarData).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(calendarData).map(([date, productions]) => (
                      <div key={date} className="border rounded-lg p-3">
                        <div className="font-semibold mb-2">{format(new Date(date), 'PPP')}</div>
                        <div className="space-y-1">
                          {productions.map((production, index) => (
                            <div key={index} className="text-sm bg-blue-50 p-2 rounded">
                              <div className="font-medium">
                                {production.projections?.products?.name} - {production.quantity} units
                              </div>
                              <div className="text-muted-foreground">
                                Voucher: {production.voucherNumber} | Line: {production.production_line}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No productions scheduled yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Productions</CardTitle>
              </CardHeader>
              <CardContent>
                {scheduledNotSentToProduction.length > 0 ? (
                  <div className="space-y-3">
                    {scheduledNotSentToProduction.map((schedule) => (
                      <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">
                            {schedule.projections?.products?.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Quantity: {schedule.quantity} | 
                            Date: {format(new Date(schedule.scheduled_date), 'PPP')} | 
                            Voucher: {generateVoucherNumber(new Date(schedule.scheduled_date))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                Shortages
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Material Requirements & Shortages</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Material requirements and availability for {schedule.projections?.products?.name}
                                </p>
                                {/* This would contain BOM breakdown and shortage calculations */}
                                <div className="text-center py-8 text-muted-foreground">
                                  Material shortage calculation will be implemented based on BOM data
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Badge variant="secondary">
                            {schedule.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No scheduled productions pending
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PlanningEnhanced;
