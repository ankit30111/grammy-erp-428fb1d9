
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Package2, AlertTriangle } from "lucide-react";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";
import { ScheduleProductionDialog } from "./ScheduleProductionDialog";
import { useState } from "react";

export const ProjectionsOverview = () => {
  const { data: projections = [] } = useProjections();
  const { data: schedules = [] } = useProductionSchedules();
  const [selectedProjection, setSelectedProjection] = useState<any>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Projections</CardTitle>
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
  );
};
