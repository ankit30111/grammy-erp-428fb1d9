import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Factory } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules, useCreateProductionSchedule, useDeleteProductionSchedule } from "@/hooks/useProductionSchedules";
import { useProductionOrders } from "@/hooks/useProductionOrders";
import { useInventory } from "@/hooks/useInventory";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PlanningDashboard = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedProjection, setSelectedProjection] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

  const { data: projections } = useProjections();
  const { data: schedules } = useProductionSchedules();
  const { data: productionOrders } = useProductionOrders();
  const { data: inventory } = useInventory();
  const createSchedule = useCreateProductionSchedule();
  const deleteSchedule = useDeleteProductionSchedule();
  const { toast } = useToast();

  // BOM query without vendor_id reference
  const { data: bomData } = useQuery({
    queryKey: ['bom'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bom')
        .select(`
          *,
          raw_materials (
            id,
            material_code,
            name
          )
        `);
      
      if (error) throw error;
      return data;
    },
  });

  // Filter projections that still have remaining quantity to schedule
  const unscheduledProjections = projections?.filter(projection => {
    const scheduledQty = projection.scheduled_quantity || 0;
    const remainingQty = projection.quantity - scheduledQty;
    return remainingQty > 0;
  }) || [];

  const selectedProjectionData = projections?.find(p => p.id === selectedProjection);
  const maxQuantity = selectedProjectionData ? 
    selectedProjectionData.quantity - (selectedProjectionData.scheduled_quantity || 0) : 0;

  const handleSchedule = async () => {
    if (!selectedDate || !selectedProjection || !quantity) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to schedule production.",
        variant: "destructive",
      });
      return;
    }

    const quantityNum = parseInt(quantity);
    
    if (quantityNum > maxQuantity) {
      toast({
        title: "Cannot Schedule More Production",
        description: `Projected quantity for this product is already fully planned. Only ${maxQuantity} units can be scheduled.`,
        variant: "destructive",
      });
      return;
    }

    if (maxQuantity === 0) {
      toast({
        title: "Cannot Schedule More Production",
        description: "Projected quantity for this product is already fully planned.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createSchedule.mutateAsync({
        projection_id: selectedProjection,
        scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
        quantity: quantityNum,
      });

      toast({
        title: "Production Scheduled",
        description: `Production of ${quantity} units scheduled for ${format(selectedDate, 'PPP')} with voucher number.`,
      });

      // Reset form
      setSelectedDate(undefined);
      setSelectedProjection("");
      setQuantity("");
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

  const getVoucherDetails = (schedule: any) => {
    if (!schedule || !bomData || !inventory) return [];
    
    const productBOM = bomData.filter(bom => bom.product_id === schedule.projections?.products?.id);
    
    const materialRequirements = productBOM.map(bomItem => {
      const inventoryItem = inventory.find(inv => inv.raw_material_id === bomItem.raw_material_id);
      const requiredQty = bomItem.quantity * schedule.quantity;
      const availableQty = inventoryItem?.quantity || 0;
      
      return {
        material_code: bomItem.raw_materials?.material_code || 'N/A',
        material_name: bomItem.raw_materials?.name || 'Unknown',
        required_quantity: requiredQty,
        available_quantity: availableQty,
        shortage: Math.max(0, requiredQty - availableQty)
      };
    });

    return materialRequirements;
  };

  // Get voucher number from production orders for each schedule
  const getVoucherNumber = (scheduleId: string) => {
    const order = productionOrders?.find(order => order.production_schedule_id === scheduleId);
    return order?.voucher_number || 'N/A';
  };

  const scheduledProductions = schedules?.map(schedule => {
    const projection = projections?.find(p => p.id === schedule.projection_id);
    return {
      ...schedule,
      customerName: projection?.customers?.name || 'Unknown Customer',
      productName: projection?.products?.name || 'Unknown Product',
      scheduledDateFormatted: format(new Date(schedule.scheduled_date), 'PPP'),
      voucherNumber: getVoucherNumber(schedule.id),
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projections">Customer Projections</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling Production</TabsTrigger>
            <TabsTrigger value="schedule">Production Schedule</TabsTrigger>
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
                        <TableHead>Total Quantity</TableHead>
                        <TableHead>Scheduled Quantity</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Delivery Month</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projections.map((projection) => {
                        const scheduledQty = projection.scheduled_quantity || 0;
                        const remainingQty = projection.quantity - scheduledQty;
                        
                        return (
                          <TableRow key={projection.id}>
                            <TableCell>{projection.customers?.name}</TableCell>
                            <TableCell>{projection.products?.name}</TableCell>
                            <TableCell>{projection.quantity}</TableCell>
                            <TableCell className="font-medium text-blue-600">
                              {scheduledQty}
                            </TableCell>
                            <TableCell className={remainingQty === 0 ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
                              {remainingQty}
                            </TableCell>
                            <TableCell>{projection.delivery_month}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                remainingQty === 0 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {remainingQty === 0 ? 'Fully Scheduled' : 'Pending'}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                            {unscheduledProjections.map((projection) => {
                              const remainingQty = projection.quantity - (projection.scheduled_quantity || 0);
                              return (
                                <SelectItem key={projection.id} value={projection.id}>
                                  {projection.customers?.name} - {projection.products?.name} ({remainingQty} units remaining)
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedProjectionData && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="text-sm">
                            <div><strong>Product:</strong> {selectedProjectionData.products?.name}</div>
                            <div><strong>Total Projection:</strong> {selectedProjectionData.quantity} units</div>
                            <div><strong>Already Scheduled:</strong> {selectedProjectionData.scheduled_quantity || 0} units</div>
                            <div className="font-medium text-blue-600">
                              <strong>Available to Schedule:</strong> {maxQuantity} units
                            </div>
                            {maxQuantity === 0 && (
                              <div className="text-red-600 font-medium mt-2">
                                ⚠️ This projection is fully scheduled
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedDate && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800">
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
                          disabled={maxQuantity === 0}
                        />
                        {selectedProjectionData && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Maximum available: {maxQuantity} units
                          </p>
                        )}
                        {maxQuantity === 0 && (
                          <p className="text-sm text-red-600 mt-1">
                            Cannot schedule more production. Projected quantity for this product is already fully planned.
                          </p>
                        )}
                      </div>

                      <Button
                        onClick={handleSchedule}
                        disabled={!selectedDate || !selectedProjection || !quantity || createSchedule.isPending || maxQuantity === 0}
                        className="w-full gap-2"
                      >
                        <Factory className="h-4 w-4" />
                        {createSchedule.isPending ? "Scheduling..." : "Schedule Production"}
                      </Button>

                      {unscheduledProjections.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground">
                          No projections available for scheduling. All projections are fully scheduled.
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
                        <TableHead>Voucher No.</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledProductions.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-mono">{schedule.voucherNumber}</TableCell>
                          <TableCell>{schedule.customerName}</TableCell>
                          <TableCell>{schedule.productName}</TableCell>
                          <TableCell>{schedule.scheduledDateFormatted}</TableCell>
                          <TableCell>{schedule.quantity}</TableCell>
                          <TableCell>{schedule.status}</TableCell>
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
        </Tabs>

        {/* ProductionVoucherDetails Modal */}
        <Dialog open={!!selectedVoucher} onOpenChange={() => setSelectedVoucher(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Production Voucher {selectedVoucher?.voucherNumber}</DialogTitle>
              <DialogDescription>
                Material requirements vs available stock for this production voucher.
              </DialogDescription>
            </DialogHeader>
            {selectedVoucher && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label>Voucher Number</Label>
                    <p className="font-mono font-medium">{selectedVoucher.voucherNumber}</p>
                  </div>
                  <div>
                    <Label>Customer</Label>
                    <p className="font-medium">{selectedVoucher.customerName}</p>
                  </div>
                  <div>
                    <Label>Product</Label>
                    <p className="font-medium">{selectedVoucher.productName}</p>
                  </div>
                  <div>
                    <Label>Scheduled Date</Label>
                    <p className="font-medium">{selectedVoucher.scheduledDateFormatted}</p>
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <p className="font-medium">{selectedVoucher.quantity}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <p className="font-medium">{selectedVoucher.status}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Material Requirements</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material Code</TableHead>
                        <TableHead>Material Name</TableHead>
                        <TableHead>Required Qty</TableHead>
                        <TableHead>Available Qty</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getVoucherDetails(selectedVoucher).length > 0 ? (
                        getVoucherDetails(selectedVoucher).map((material, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono">{material.material_code}</TableCell>
                            <TableCell>{material.material_name}</TableCell>
                            <TableCell>{material.required_quantity}</TableCell>
                            <TableCell>{material.available_quantity}</TableCell>
                            <TableCell>
                              {material.shortage > 0 ? (
                                <span className="text-red-600 font-medium">
                                  Short by {material.shortage}
                                </span>
                              ) : (
                                <span className="text-green-600 font-medium">Available</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                            No BOM data available for this product
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
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
