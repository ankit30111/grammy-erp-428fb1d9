
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Package2, AlertTriangle, Clock, Package, CheckCircle } from "lucide-react";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";
import { ScheduleProductionDialog } from "@/components/Planning/ScheduleProductionDialog";
import { useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PlanningDashboard = () => {
  const { data: projections = [] } = useProjections();
  const { data: schedules = [] } = useProductionSchedules();
  const [selectedProjection, setSelectedProjection] = useState<any>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

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
  const getShortagesForVoucher = (voucherNumber: string, productId: string) => {
    return materialRequirements.filter(req => 
      req.shortage_quantity > 0 && 
      req.projection_id && 
      schedules.find(s => s.projection_id === req.projection_id && s.projections?.products?.id === productId)
    );
  };

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

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Package2 className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{projections.length}</div>
                  <div className="text-sm text-muted-foreground">Total Projections</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-8 w-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{schedules.length}</div>
                  <div className="text-sm text-muted-foreground">Scheduled Productions</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
                <div>
                  <div className="text-2xl font-bold">
                    {projections.filter(p => getRemainingQuantity(p) > 0).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Pending Scheduling</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Package className="h-8 w-8 text-red-600" />
                <div>
                  <div className="text-2xl font-bold">
                    {materialRequirements.filter(req => req.shortage_quantity > 0).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Material Shortages</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Projections Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package2 className="h-5 w-5" />
              Customer Projections
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

        {/* Production Schedule with Material Shortages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Production Schedule & Material Shortages
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
                  <TableHead>Material Shortages</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedulesWithVouchers.map((schedule) => {
                  const shortages = getShortagesForVoucher(
                    schedule.voucherNumber, 
                    schedule.projections?.products?.id
                  );
                  
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
                      <TableCell>{schedule.production_line}</TableCell>
                      <TableCell>
                        {shortages.length > 0 ? (
                          <div className="space-y-1">
                            {shortages.slice(0, 2).map((shortage, index) => (
                              <div key={index} className="text-xs">
                                <Badge variant="destructive" className="text-xs">
                                  {shortage.material_code}: -{shortage.shortage_quantity}
                                </Badge>
                              </div>
                            ))}
                            {shortages.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{shortages.length - 2} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            No Shortages
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {schedule.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ScheduleProductionDialog
          projection={selectedProjection}
          isOpen={isScheduleDialogOpen}
          onClose={() => {
            setIsScheduleDialogOpen(false);
            setSelectedProjection(null);
          }}
          maxQuantity={selectedProjection ? getRemainingQuantity(selectedProjection) : 0}
        />
      </div>
    </DashboardLayout>
  );
};

export default PlanningDashboard;
