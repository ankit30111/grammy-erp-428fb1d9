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
import { Calendar as CalendarIcon, Factory, AlertTriangle, Package, Edit, Trash2, RefreshCw } from "lucide-react";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules, useCreateProductionSchedule } from "@/hooks/useProductionSchedules";
import { useInventory } from "@/hooks/useInventory";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from "date-fns";
import { EditScheduleDialog } from "@/components/Planning/EditScheduleDialog";
import { DeleteScheduleDialog } from "@/components/Planning/DeleteScheduleDialog";

const PlanningEnhanced: React.FC = () => {
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
        production_line: "TBD", // Will be assigned in production page
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

  // Enhanced BOM Production Voucher Analysis Component with product-specific BOM query
  const BOMProductionVoucherAnalysis = () => {
    const selectedSchedule = schedules?.find(s => s.id === selectedScheduleId);
    if (!selectedSchedule) return null;

    const productId = selectedSchedule.projections?.products?.id;
    
    console.log('🎯 BOM Analysis Debug:');
    console.log('- Selected Schedule:', selectedSchedule);
    console.log('- Product ID:', productId);
    console.log('- Schedule Quantity:', selectedSchedule.quantity);

    // Use product-specific BOM query instead of global useBOM
    const { data: productBOM = [], isLoading: bomLoading } = useQuery({
      queryKey: ["product-bom", productId],
      queryFn: async () => {
        if (!productId) return [];
        
        console.log('🔍 Fetching BOM for product:', productId);
        
        const { data, error } = await supabase
          .from("bom")
          .select(`
            *,
            raw_materials!inner(
              id,
              material_code,
              name,
              category
            )
          `)
          .eq("product_id", productId);
        
        if (error) {
          console.error('❌ BOM fetch error:', error);
          throw error;
        }
        
        console.log('✅ BOM data fetched:', data?.length, 'items');
        console.log('📊 BOM breakdown by type:');
        
        const breakdown = data?.reduce((acc, item) => {
          acc[item.bom_type] = (acc[item.bom_type] || 0) + 1;
          return acc;
        }, {});
        
        console.log(breakdown);
        
        return data || [];
      },
      enabled: !!productId && isOpen,
    });

    const getBOMWithInventory = () => {
      if (!productBOM.length || !inventory) {
        console.log('⚠️ Missing data - BOM items:', productBOM.length, 'Inventory loaded:', !!inventory);
        return [];
      }

      const bomWithInventory = productBOM.map(bomItem => {
        const inventoryItem = inventory?.find(inv => inv.raw_material_id === bomItem.raw_material_id);
        const requiredQty = bomItem.quantity * selectedSchedule.quantity;
        const availableQty = inventoryItem?.quantity || 0;
        const shortQty = Math.max(0, requiredQty - availableQty); // Only show positive shortage or 0

        return {
          ...bomItem,
          requiredQuantity: requiredQty,
          availableQuantity: availableQty,
          shortQuantity: shortQty,
          status: shortQty > 0 ? 'SHORT' : 'AVAILABLE'
        };
      });

      console.log('📋 Final BOM with inventory:', bomWithInventory.length, 'items processed');
      
      // Log breakdown by category
      const finalBreakdown = bomWithInventory.reduce((acc, item) => {
        acc[item.bom_type] = (acc[item.bom_type] || 0) + 1;
        return acc;
      }, {});
      
      console.log('📊 Final breakdown:', finalBreakdown);
      
      return bomWithInventory;
    };

    const bomWithInventory = getBOMWithInventory();
    
    // Categorize BOM items based on actual database enum values
    const mainAssembly = bomWithInventory.filter(item => item.bom_type === 'main_assembly');
    const subAssembly = bomWithInventory.filter(item => item.bom_type === 'sub_assembly');
    const accessories = bomWithInventory.filter(item => item.bom_type === 'accessory');

    console.log('🏗️ Category distribution:');
    console.log('- Main Assembly:', mainAssembly.length);
    console.log('- Sub Assembly:', subAssembly.length);
    console.log('- Accessories:', accessories.length);
    console.log('- Total:', mainAssembly.length + subAssembly.length + accessories.length);

    if (bomLoading) {
      return (
        <div className="space-y-4">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading BOM data...</p>
          </div>
        </div>
      );
    }

    if (!productBOM.length) {
      return (
        <div className="space-y-4">
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No BOM data found for this product</p>
            <p className="text-sm text-muted-foreground mt-1">Product ID: {productId}</p>
          </div>
        </div>
      );
    }

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
                <TableHead>Required</TableHead>
                <TableHead>In Stock</TableHead>
                <TableHead>Short</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {item.raw_materials?.material_code || 'N/A'}
                  </TableCell>
                  <TableCell>{item.raw_materials?.name || 'N/A'}</TableCell>
                  <TableCell className="font-medium">{item.requiredQuantity}</TableCell>
                  <TableCell className="font-medium">{item.availableQuantity}</TableCell>
                  <TableCell>
                    {item.shortQuantity > 0 ? (
                      <Badge variant="destructive">{item.shortQuantity}</Badge>
                    ) : (
                      <Badge variant="secondary">0</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'AVAILABLE' ? 'default' : 'destructive'}>
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );

    // Get actual voucher number from production_orders
    const voucherNumber = selectedSchedule.production_orders?.[0]?.voucher_number || 'Generating...';

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <h3 className="text-xl font-bold">
              {selectedSchedule.projections?.products?.name}
            </h3>
            <p className="text-muted-foreground">
              Voucher: {voucherNumber} | Scheduled Quantity: {selectedSchedule.quantity} units
            </p>
            <p className="text-sm text-muted-foreground">
              Total BOM Items: {bomWithInventory.length} | 
              Main: {mainAssembly.length} | 
              Sub: {subAssembly.length} | 
              Acc: {accessories.length}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchInventory()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Inventory
          </Button>
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
                              {schedule.projections?.products?.name}
                            </TableCell>
                            <TableCell>
                              {schedule.projections?.customers?.name}
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
          </TabsContent>
        </Tabs>

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

</edits_to_apply>
