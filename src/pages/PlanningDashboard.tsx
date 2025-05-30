
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Package2, AlertTriangle, Clock, Package, CheckCircle, Edit, Trash2 } from "lucide-react";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules, useUpdateProductionSchedule } from "@/hooks/useProductionSchedules";
import { ScheduleProductionDialog } from "@/components/Planning/ScheduleProductionDialog";
import { useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SchedulingProduction from "@/components/Planning/SchedulingProduction";
import ProductionVoucherDetails from "@/components/Planning/ProductionVoucherDetails";
import GRNForm from "@/components/PPC/GRNForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PlanningDashboard = () => {
  const { data: projections = [] } = useProjections();
  const { data: schedules = [] } = useProductionSchedules();
  const updateSchedule = useUpdateProductionSchedule();
  const { toast } = useToast();
  
  const [selectedProjection, setSelectedProjection] = useState<any>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [selectedVoucherDetails, setSelectedVoucherDetails] = useState<{
    scheduleId: string;
    voucherNumber: string;
  } | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    scheduled_date: "",
    quantity: "",
    production_line: ""
  });

  // Generate production voucher numbers for scheduled productions
  const generateVoucherNumber = (scheduledDate: string, scheduleIndex: number) => {
    const date = new Date(scheduledDate);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const voucherNum = String(scheduleIndex + 1).padStart(2, '0');
    return `${month}-${voucherNum}`;
  };

  // Fetch material requirements and shortages
  const { data: materialRequirements = [] } = useQuery({
    queryKey: ["material-requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_requirements_view")
        .select("*");
      
      if (error) throw error;
      return data;
    }
  });

  // Calculate scheduled quantities for each projection
  const getScheduledQuantity = (projectionId: string) => {
    return schedules
      .filter(schedule => schedule.projection_id === projectionId)
      .reduce((total, schedule) => total + schedule.quantity, 0);
  };

  const getRemainingQuantity = (projection: any) => {
    const scheduled = getScheduledQuantity(projection.id);
    return projection.quantity - scheduled;
  };

  const handleScheduleProduction = (projection: any) => {
    setSelectedProjection(projection);
    setIsScheduleDialogOpen(true);
  };

  // Group schedules by date and assign voucher numbers
  const schedulesWithVouchers = schedules.map((schedule, index) => ({
    ...schedule,
    voucherNumber: generateVoucherNumber(schedule.scheduled_date, index)
  }));

  // Get material shortages for each production voucher
  const getShortagesForVoucher = (scheduleId: string) => {
    return materialRequirements.filter(req => 
      req.shortage_quantity > 0 && 
      req.projection_id === scheduleId
    );
  };

  const handleEditSchedule = (schedule: any) => {
    setEditingSchedule(schedule.id);
    setEditForm({
      scheduled_date: schedule.scheduled_date,
      quantity: schedule.quantity.toString(),
      production_line: schedule.production_line
    });
  };

  const handleSaveEdit = async (scheduleId: string) => {
    try {
      await updateSchedule.mutateAsync({
        scheduleId,
        updates: {
          scheduled_date: editForm.scheduled_date,
          quantity: parseInt(editForm.quantity),
          production_line: editForm.production_line
        }
      });
      setEditingSchedule(null);
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('production_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;

      toast({
        title: "Schedule Deleted",
        description: "Production schedule has been deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Error",
        description: "Failed to delete production schedule",
        variant: "destructive",
      });
    }
  };

  const productionLines = ["Line 1", "Line 2", "Line 3", "Line 4"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Production Planning Dashboard</h1>
            <p className="text-muted-foreground">Manage projections, schedules, and material requirements</p>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Last updated: {format(new Date(), "PPp")}</span>
          </div>
        </div>

        <Tabs defaultValue="projections" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="projections">Customer Projections</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling Production</TabsTrigger>
            <TabsTrigger value="schedule">Production Schedule</TabsTrigger>
            <TabsTrigger value="materials">Raw Material Status</TabsTrigger>
            <TabsTrigger value="grn">GRN Management</TabsTrigger>
          </TabsList>

          <TabsContent value="projections">
            {/* Customer Projections Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package2 className="h-5 w-5" />
                  Customer Projections ({projections.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Delivery Month</TableHead>
                      <TableHead>Total Quantity</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projections.map((projection) => {
                      const scheduled = getScheduledQuantity(projection.id);
                      const remaining = getRemainingQuantity(projection);
                      
                      return (
                        <TableRow key={projection.id}>
                          <TableCell className="font-medium">
                            {projection.customers?.name}
                          </TableCell>
                          <TableCell>{projection.products?.name}</TableCell>
                          <TableCell>{projection.delivery_month}</TableCell>
                          <TableCell>{projection.quantity.toLocaleString()}</TableCell>
                          <TableCell>{scheduled.toLocaleString()}</TableCell>
                          <TableCell>{remaining.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={remaining === 0 ? "secondary" : "destructive"}>
                              {remaining === 0 ? "Fully Scheduled" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {remaining > 0 && (
                              <Button
                                size="sm"
                                onClick={() => handleScheduleProduction(projection)}
                              >
                                Schedule Production
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduling">
            <SchedulingProduction />
          </TabsContent>

          <TabsContent value="schedule">
            {/* Production Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Production Schedule ({schedulesWithVouchers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voucher #</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Production Line</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedulesWithVouchers.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-bold text-primary">
                          {schedule.voucherNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{schedule.projections?.products?.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {schedule.projections?.products?.product_code}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{schedule.projections?.customers?.name}</TableCell>
                        <TableCell>
                          {editingSchedule === schedule.id ? (
                            <Input
                              type="date"
                              value={editForm.scheduled_date}
                              onChange={(e) => setEditForm({...editForm, scheduled_date: e.target.value})}
                              className="w-32"
                            />
                          ) : (
                            format(new Date(schedule.scheduled_date), 'MMM dd, yyyy')
                          )}
                        </TableCell>
                        <TableCell>
                          {editingSchedule === schedule.id ? (
                            <Input
                              type="number"
                              value={editForm.quantity}
                              onChange={(e) => setEditForm({...editForm, quantity: e.target.value})}
                              className="w-20"
                            />
                          ) : (
                            schedule.quantity.toLocaleString()
                          )}
                        </TableCell>
                        <TableCell>
                          {editingSchedule === schedule.id ? (
                            <Select 
                              value={editForm.production_line} 
                              onValueChange={(value) => setEditForm({...editForm, production_line: value})}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {productionLines.map((line) => (
                                  <SelectItem key={line} value={line}>
                                    {line}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            schedule.production_line
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {schedule.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {editingSchedule === schedule.id ? (
                              <>
                                <Button size="sm" onClick={() => handleSaveEdit(schedule.id)}>
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingSchedule(null)}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditSchedule(schedule)}
                                  className="gap-1"
                                >
                                  <Edit className="h-3 w-3" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteSchedule(schedule.id)}
                                  className="gap-1"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materials">
            {/* Raw Material Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Raw Material Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voucher #</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Material Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedulesWithVouchers.map((schedule) => {
                      const shortages = getShortagesForVoucher(schedule.projection_id);
                      const hasShortages = shortages.length > 0;
                      
                      return (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-bold text-primary">
                            {schedule.voucherNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{schedule.projections?.products?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {schedule.projections?.products?.product_code}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{schedule.projections?.customers?.name}</TableCell>
                          <TableCell>{format(new Date(schedule.scheduled_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>{schedule.quantity.toLocaleString()}</TableCell>
                          <TableCell>
                            <Button
                              variant={hasShortages ? "destructive" : "secondary"}
                              size="sm"
                              onClick={() => setSelectedVoucherDetails({
                                scheduleId: schedule.projection_id,
                                voucherNumber: schedule.voucherNumber
                              })}
                              className="gap-2"
                            >
                              {hasShortages ? (
                                <>
                                  <AlertTriangle className="h-3 w-3" />
                                  Short ({shortages.length})
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3" />
                                  Available
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grn">
            <GRNForm />
          </TabsContent>
        </Tabs>

        <ScheduleProductionDialog
          projection={selectedProjection}
          isOpen={isScheduleDialogOpen}
          onClose={() => {
            setIsScheduleDialogOpen(false);
            setSelectedProjection(null);
          }}
          maxQuantity={selectedProjection ? getRemainingQuantity(selectedProjection) : 0}
        />

        <ProductionVoucherDetails
          scheduleId={selectedVoucherDetails?.scheduleId || null}
          voucherNumber={selectedVoucherDetails?.voucherNumber || ""}
          isOpen={!!selectedVoucherDetails}
          onClose={() => setSelectedVoucherDetails(null)}
        />
      </div>
    </DashboardLayout>
  );
};

export default PlanningDashboard;
