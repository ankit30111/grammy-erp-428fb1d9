
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Factory, Clock, Package } from "lucide-react";
import { useProductionSchedules, useUpdateProductionSchedule } from "@/hooks/useProductionSchedules";
import { format } from "date-fns";
import { useBOM } from "@/hooks/useBOM";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const ProductionScheduleManagement = () => {
  const { data: schedules, isLoading } = useProductionSchedules();
  const updateSchedule = useUpdateProductionSchedule();
  const { data: bomData } = useBOM();
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'warning';
      case 'MATERIALS_BLOCKED': return 'default';
      case 'KIT_PREPARED': return 'default';
      case 'IN_PRODUCTION': return 'default';
      case 'COMPLETED': return 'default';
      default: return 'secondary';
    }
  };

  const handleBlockMaterials = async (scheduleId: string) => {
    // First, get the schedule details
    const schedule = schedules?.find(s => s.id === scheduleId);
    if (!schedule) return;

    // Get BOM for the product
    const productBOM = bomData?.filter(bom => 
      bom.product_id === schedule.projections?.products?.id
    );

    if (!productBOM?.length) {
      console.error('No BOM found for product');
      return;
    }

    // Block materials for this production schedule
    const materialBlocks = productBOM.map(bomItem => ({
      production_schedule_id: scheduleId,
      raw_material_id: bomItem.raw_material_id,
      quantity_blocked: bomItem.quantity * schedule.quantity,
      status: 'BLOCKED',
    }));

    try {
      const { error } = await supabase
        .from('material_blocking')
        .insert(materialBlocks);

      if (error) throw error;

      // Update schedule status
      updateSchedule.mutate({
        scheduleId,
        updates: { status: 'MATERIALS_BLOCKED' }
      });
    } catch (error) {
      console.error('Error blocking materials:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Production Schedule Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading production schedules...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Production Schedule Management ({schedules?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {schedules?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
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
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
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
                  <TableCell>{schedule.quantity}</TableCell>
                  <TableCell>{schedule.production_line}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(schedule.status) as any}>
                      {schedule.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {schedule.status === 'SCHEDULED' && (
                        <Button
                          size="sm"
                          onClick={() => handleBlockMaterials(schedule.id)}
                          className="gap-2"
                        >
                          <Package className="h-4 w-4" />
                          Block Materials
                        </Button>
                      )}
                      {schedule.status === 'MATERIALS_BLOCKED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSchedule.mutate({
                            scheduleId: schedule.id,
                            updates: { status: 'KIT_PREPARED' }
                          })}
                          className="gap-2"
                        >
                          <Factory className="h-4 w-4" />
                          Prepare Kit
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No production scheduled yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Schedule production from customer projections to see them here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductionScheduleManagement;
