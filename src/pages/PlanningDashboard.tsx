
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Factory, Package } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules, useCreateProductionSchedule, useDeleteProductionSchedule } from "@/hooks/useProductionSchedules";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const PlanningDashboard = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedProjection, setSelectedProjection] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [productionLine, setProductionLine] = useState<string>("");
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

  const { data: projections } = useProjections();
  const { data: schedules } = useProductionSchedules();
  const { data: purchaseOrders } = usePurchaseOrders();
  const createSchedule = useCreateProductionSchedule();
  const deleteSchedule = useDeleteProductionSchedule();
  const { toast } = useToast();

  const productionLines = ["Line 1", "Line 2", "Line 3", "Line 4"];

  const unscheduledProjections = projections?.filter(projection => {
    // Filter projections that still have remaining quantity to schedule
    return projection.quantity > 0; // This would need proper calculation
  }) || [];

  const selectedProjectionData = projections?.find(p => p.id === selectedProjection);
  const maxQuantity = selectedProjectionData?.quantity || 0;

  const handleSchedule = async () => {
    if (!selectedDate || !selectedProjection || !quantity || !productionLine) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to schedule production.",
        variant: "destructive",
      });
      return;
    }

    if (parseInt(quantity) > maxQuantity) {
      toast({
        title: "Invalid Quantity",
        description: `Quantity exceeds the maximum available for this projection (${maxQuantity} units).`,
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

      toast({
        title: "Production Scheduled",
        description: `Production of ${quantity} units scheduled for ${format(selectedDate, 'PPP')} on ${productionLine}.`,
      });

      // Reset form
      setSelectedDate(undefined);
      setSelectedProjection("");
      setQuantity("");
      setProductionLine("");
    } catch (error) {
      console.error('Error scheduling production:', error);
      toast({
        title: "Scheduling Error",
        description: "Failed to schedule production. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteSchedule.mutateAsync(scheduleId);
      toast({
        title: "Schedule Deleted",
        description: "Production schedule deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Deletion Error",
        description: "Failed to delete production schedule. Please try again.",
        variant: "destructive",
      });
    }
  };

  const scheduledProductions = schedules?.map(schedule => {
    const projection = projections?.find(p => p.id === schedule.projection_id);
    return {
      ...schedule,
      customerName: projection?.customers?.name || 'Unknown Customer',
      productName: projection?.products?.name || 'Unknown Product',
      scheduledDateFormatted: format(new Date(schedule.scheduled_date), 'PPP'),
    };
  }) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Production Planning Dashboard</h1>
            <p className="text-muted-foreground">Manage customer projections, scheduling, and material status</p>
          </div>
        </div>

        <Tabs defaultValue="projections" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="projections">Customer Projections</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling Production</TabsTrigger>
            <TabsTrigger value="schedule">Production Schedule</TabsTrigger>
            <TabsTrigger value="materials">Raw Material Status</TabsTrigger>
          </TabsList>

          <TabsContent value="projections">
            <Card>
              <CardHeader>
                <CardTitle>Customer Projections</CardTitle>
                <CardDescription>View and manage customer demand projections</CardDescription>
              </CardHeader>
              <CardContent>
                {projections && projections.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Delivery Month</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projections.map((projection) => (
                        <TableRow key={projection.id}>
                          <TableCell>{projection.customers?.name}</TableCell>
                          <TableCell>{projection.products?.name}</TableCell>
                          <TableCell>{projection.quantity}</TableCell>
                          <TableCell>{projection.delivery_month}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No customer projections available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduling">
            <Card>
              <CardHeader>
                <CardTitle>Schedule Production</CardTitle>
                <CardDescription>Plan production based on customer projections</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Calendar */}
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

                  {/* Scheduling Form */}
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
                            {unscheduledProjections.map((projection) => (
                              <SelectItem key={projection.id} value={projection.id}>
                                {projection.customers?.name} - {projection.products?.name} ({projection.quantity} units)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedDate && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Selected Date:</strong> {format(selectedDate, 'PPP')}
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

                      {unscheduledProjections.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground">
                          No unscheduled projections available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Production Schedule</CardTitle>
                <CardDescription>View and manage scheduled production</CardDescription>
              </CardHeader>
              <CardContent>
                {scheduledProductions && scheduledProductions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledProductions.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell>{schedule.customerName}</TableCell>
                          <TableCell>{schedule.productName}</TableCell>
                          <TableCell>{schedule.scheduledDateFormatted}</TableCell>
                          <TableCell>{schedule.production_line}</TableCell>
                          <TableCell>{schedule.quantity}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedVoucher(schedule)}
                            >
                              View Voucher
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSchedule(schedule.id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No production schedules available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materials">
            <Card>
              <CardHeader>
                <CardTitle>Raw Material Status</CardTitle>
                <CardDescription>Track raw material availability and shortages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4 text-muted-foreground">
                  Raw material status will be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ProductionVoucherDetails Modal */}
        <Dialog open={!!selectedVoucher} onOpenChange={() => setSelectedVoucher(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Production Voucher Details</DialogTitle>
              <DialogDescription>
                View details for the selected production schedule.
              </DialogDescription>
            </DialogHeader>
            {selectedVoucher && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Customer</Label>
                    <Input type="text" value={selectedVoucher.customerName} readOnly />
                  </div>
                  <div>
                    <Label>Product</Label>
                    <Input type="text" value={selectedVoucher.productName} readOnly />
                  </div>
                  <div>
                    <Label>Scheduled Date</Label>
                    <Input type="text" value={selectedVoucher.scheduledDateFormatted} readOnly />
                  </div>
                  <div>
                    <Label>Production Line</Label>
                    <Input type="text" value={selectedVoucher.production_line} readOnly />
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input type="text" value={selectedVoucher.quantity} readOnly />
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PlanningDashboard;
