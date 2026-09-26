
import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabBar } from "@/components/shell/TabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarIcon, Factory, AlertTriangle, Package, Edit, Trash2, RefreshCw } from "lucide-react";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules, useCreateProductionSchedule } from "@/hooks/useProductionSchedules";
import { useInventory } from "@/hooks/useInventory";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VoucherMaterials } from "@/components/Production/VoucherMaterials";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from "date-fns";
import { EditScheduleDialog } from "@/components/Planning/EditScheduleDialog";
import { DeleteScheduleDialog } from "@/components/Planning/DeleteScheduleDialog";
import { ScheduleSubAssemblyDialog } from "@/components/Planning/ScheduleSubAssemblyDialog";

const planningTabs = [
  { id: "planning", label: "Production Planning" },
  { id: "scheduled", label: "Scheduled Production" },
];

const PlanningEnhanced: React.FC = () => {
  const [activeTab, setActiveTab] = useState("planning");
  // Sub-assemblies built for stock, without a customer projection.
  const [stockBuildOpen, setStockBuildOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();

  const [selectedProjection, setSelectedProjection] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [shortageDialogOpen, setShortageDialogOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  
  const { data: projections } = useProjections();
  const { data: schedules, refetch: refetchSchedules } = useProductionSchedules();
  const { data: inventory, refetch: refetchInventory } = useInventory();
  const createSchedule = useCreateProductionSchedule();
  const { toast } = useToast();

  // Get unscheduled projections
  const unscheduledProjections = projections?.filter(projection => {
    const balanceQuantity = projection.quantity - (projection.scheduled_quantity || 0);
    return balanceQuantity > 0;
  }) || [];

  // Get scheduled but not sent to production
  const scheduledNotSentToProduction = schedules?.filter(schedule => 
    schedule.status === 'PLANNED'
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
        // Line is assigned later, in the production page (production_order_lines).
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

  const handleEditSchedule = (schedule: any) => {
    setSelectedSchedule(schedule);
    setEditDialogOpen(true);
  };

  const handleDeleteSchedule = (schedule: any) => {
    setSelectedSchedule(schedule);
    setDeleteDialogOpen(true);
  };

  const getMaxQuantityForEdit = (schedule: any) => {
    // A stock build has no projection to stay within.
    if (!schedule.projection_id) return Infinity;
    const projection = projections?.find(p => p.id === schedule.projection_id);
    if (!projection) return 0;
    
    const currentScheduled = projection.scheduled_quantity || 0;
    const currentScheduleQuantity = schedule.quantity || 0;
    const remainingQuantity = projection.quantity - currentScheduled + currentScheduleQuantity;
    
    return remainingQuantity;
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
                  className="text-xs bg-accent rounded p-1 mb-1 cursor-pointer hover:bg-accent"
                  onClick={() => {
                    setSelectedScheduleId(schedule.id);
                    setShortageDialogOpen(true);
                  }}
                >
                  <div className="font-medium truncate">
                    {(schedule.projections?.parts ?? schedule.parts)?.name}
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

  /**
   * Material requirements for the selected voucher.
   *
   * Replaced ~200 lines that grouped by bom.bom_type - a column that no longer
   * exists, so every section rendered "No items in this category" while the header
   * counted 54 items. Now uses the shared VoucherMaterials table, which is the same
   * component the Store voucher tab renders, so the two screens cannot drift apart
   * in either numbers or appearance.
   */
  const BOMProductionVoucherAnalysis = () => {
    const selectedSchedule = schedules?.find(s => s.id === selectedScheduleId);
    if (!selectedSchedule) return null;

    const productId = (selectedSchedule.projections?.parts ?? selectedSchedule.parts)?.id;
    const voucher = selectedSchedule.production_orders?.[0];

    return (
      <div className="space-y-4">
        <div className="pb-4 border-b">
          <h3 className="text-xl font-bold">
            {(selectedSchedule.projections?.parts ?? selectedSchedule.parts)?.name}
          </h3>
          <p className="text-muted-foreground">
            Voucher: {voucher?.voucher_number || "Generating…"} · Scheduled quantity:{" "}
            {selectedSchedule.quantity} units
          </p>
        </div>

        <VoucherMaterials
          partId={productId}
          quantity={Number(selectedSchedule.quantity) || 0}
          plantId={selectedSchedule.plant_id}
          productionOrderId={voucher?.id}
        />
      </div>
    );
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Planning"
        actions={
          <Button onClick={() => setStockBuildOpen(true)}>
            <Package /> Schedule Sub-assembly
          </Button>
        }
      />
      <ScheduleSubAssemblyDialog open={stockBuildOpen} onOpenChange={setStockBuildOpen} />
      <TabBar tabs={planningTabs} value={activeTab} onChange={setActiveTab} />
      <div className="space-y-6 pt-4">
          {activeTab === "planning" && (
            <div className="space-y-6">

            {/* Unscheduled Projections */}
            <Card>
              <CardHeader>
                <CardTitle>
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
                              {projection.customers?.name} - {projection.parts?.name}
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
                  <CardTitle>
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
                  <CardTitle>
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
                              {projection.customers?.name} - {projection.parts?.name} 
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

                  <div className="text-sm text-muted-foreground mt-2">
                    <p>Note: Production line assignment will be done in the Production page</p>
                  </div>
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
            </div>
          )}

          {activeTab === "scheduled" && (

            <Card>
              <CardHeader>
                <CardTitle>Scheduled Production</CardTitle>
              </CardHeader>
              <CardContent>
                {scheduledNotSentToProduction.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Voucher Number</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledNotSentToProduction.map((schedule) => {
                        const voucherNumber = schedule.production_orders?.[0]?.voucher_number || 'Generating...';
                        return (
                          <TableRow key={schedule.id}>
                            <TableCell className="font-medium font-mono">
                              {voucherNumber}
                            </TableCell>
                            <TableCell className="font-medium">
                              {(schedule.projections?.parts ?? schedule.parts)?.name}
                            </TableCell>
                            <TableCell>
                              {schedule.projections?.customers?.name ?? "Stock build"}
                            </TableCell>
                            <TableCell>{schedule.quantity}</TableCell>
                            <TableCell>{format(new Date(schedule.scheduled_date), 'PPP')}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEditSchedule(schedule)}
                                  className="gap-2"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDeleteSchedule(schedule)}
                                  className="gap-2 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
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
                                  Production Voucher
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No scheduled productions pending
                  </div>
                )}
              </CardContent>
            </Card>
          )}


        {/* Edit Schedule Dialog */}
        {selectedSchedule && (
          <EditScheduleDialog
            isOpen={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedSchedule(null);
            }}
            schedule={selectedSchedule}
            maxQuantity={getMaxQuantityForEdit(selectedSchedule)}
          />
        )}

        {/* Delete Schedule Dialog */}
        {selectedSchedule && (
          <DeleteScheduleDialog
            isOpen={deleteDialogOpen}
            onClose={() => {
              setDeleteDialogOpen(false);
              setSelectedSchedule(null);
            }}
            schedule={selectedSchedule}
          />
        )}

        {/* Enhanced Production Voucher Analysis Dialog */}
        <Dialog open={shortageDialogOpen} onOpenChange={setShortageDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Production Voucher - Material Requirements & Real-time Inventory Status</DialogTitle>
            </DialogHeader>
            <BOMProductionVoucherAnalysis />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PlanningEnhanced;
