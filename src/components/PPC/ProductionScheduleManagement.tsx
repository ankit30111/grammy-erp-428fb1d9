
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Factory, Clock, Play, CheckCircle } from "lucide-react";
import { useProductionSchedules, useUpdateProductionSchedule } from "@/hooks/useProductionSchedules";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useProductionLinesList } from "@/hooks/useProductionLinesList";

const ProductionScheduleManagement = () => {
  const { data: schedules, isLoading } = useProductionSchedules();
  const updateSchedule = useUpdateProductionSchedule();
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);
  const [productionLines, setProductionLines] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Production lines are plant assets — pick one and store its id.
  const { rows: productionLineOptions } = useProductionLinesList();
  const lineNameById = (lineId: string) =>
    productionLineOptions.find((line) => line.id === lineId)?.name ?? lineId;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'warning';
      case 'KIT_PREPARED': return 'default';
      case 'IN_PRODUCTION': return 'default';
      case 'COMPLETED': return 'default';
      default: return 'secondary';
    }
  };

  const handleStartProduction = async (scheduleId: string) => {
    const selectedLine = productionLines[scheduleId];
    if (!selectedLine) {
      toast({
        title: "Production Line Required",
        description: "Please select a production line before starting production",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update schedule status and production line
      updateSchedule.mutate({
        scheduleId,
        updates: {
          status: 'IN_PRODUCTION',
          production_line_id: selectedLine
        }
      });

      toast({
        title: "Production Started",
        description: `Production started on ${lineNameById(selectedLine)}`,
      });
    } catch (error) {
      console.error('Error starting production:', error);
      toast({
        title: "Error",
        description: "Failed to start production",
        variant: "destructive",
      });
    }
  };

  const handleCompleteProduction = async (scheduleId: string) => {
    try {
      // Update schedule status to completed
      updateSchedule.mutate({
        scheduleId,
        updates: { status: 'COMPLETED' }
      });

      // Find the production order for this schedule and update it
      const { data: productionOrder } = await supabase
        .from('production_orders')
        .select('id')
        .eq('production_schedule_id', scheduleId)
        .single();

      if (productionOrder) {
        await supabase
          .from('production_orders')
          // schedule_status has no PENDING_OQC member; a finished order is
          // COMPLETED and that is what the OQC queue reads.
          .update({ status: 'COMPLETED' })
          .eq('id', productionOrder.id);
      }

      toast({
        title: "Production Completed",
        description: "Production completed and moved to OQC queue",
      });
    } catch (error) {
      console.error('Error completing production:', error);
      toast({
        title: "Error",
        description: "Failed to complete production",
        variant: "destructive",
      });
    }
  };

  const handleProductionLineChange = (scheduleId: string, line: string) => {
    setProductionLines(prev => ({
      ...prev,
      [scheduleId]: line
    }));
  };

  const handleAssignProductionLine = async (scheduleId: string) => {
    const selectedLine = productionLines[scheduleId];
    if (!selectedLine) {
      toast({
        title: "Production Line Required",
        description: "Please select a production line to assign",
        variant: "destructive",
      });
      return;
    }

    try {
      updateSchedule.mutate({
        scheduleId,
        updates: { production_line_id: selectedLine }
      });

      toast({
        title: "Production Line Assigned",
        description: `Production line ${lineNameById(selectedLine)} assigned successfully`,
      });
    } catch (error) {
      console.error('Error assigning production line:', error);
      toast({
        title: "Error",
        description: "Failed to assign production line",
        variant: "destructive",
      });
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
                      <div className="font-medium">{(schedule.projections?.parts ?? schedule.parts)?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {(schedule.projections?.parts ?? schedule.parts)?.part_code}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(schedule.scheduled_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{schedule.quantity}</TableCell>
                  <TableCell>
                    {schedule.production_line_id ? (
                      <span className="font-medium">{schedule.production_lines?.name}</span>
                    ) : schedule.status === 'PLANNED' ? (
                      <div className="flex gap-2">
                        <Select
                          value={productionLines[schedule.id] || ""}
                          onValueChange={(value) => handleProductionLineChange(schedule.id, value)}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Select Line" />
                          </SelectTrigger>
                          <SelectContent>
                            {productionLineOptions.map((line) => (
                              <SelectItem key={line.id} value={line.id}>
                                {line.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignProductionLine(schedule.id)}
                          disabled={!productionLines[schedule.id]}
                        >
                          Assign
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not assigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(schedule.status) as any}>
                      {schedule.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {/*
                        "Block Materials" is gone. Holding material is not something
                        anyone should have to remember to press: the voucher's own
                        holds are now created and maintained by the database from the
                        BOM the moment the voucher exists, and released when the kit
                        is issued or the voucher is cancelled.

                        The button also never worked. It inserted a hold with
                        source = 'VOUCHER' and no production_order_id, which the
                        hold_voucher_needs_order check constraint refuses, so every
                        press failed into a toast and stock_holds stayed empty - which
                        is why every voucher saw the whole warehouse as free.
                      */}
                      {schedule.status === 'PLANNED' && (
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
                      {schedule.status === 'KIT_PREPARED' && (
                        <Button
                          size="sm"
                          onClick={() => handleStartProduction(schedule.id)}
                          className="gap-2"
                          disabled={!schedule.production_line_id}
                        >
                          <Play className="h-4 w-4" />
                          Start Production
                        </Button>
                      )}
                      {schedule.status === 'IN_PRODUCTION' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCompleteProduction(schedule.id)}
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Complete Production
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
