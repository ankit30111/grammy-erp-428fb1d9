
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";

interface UnscheduledProjectionsProps {
  onScheduleClick?: (projectionId: string) => void;
}

const UnscheduledProjections = ({ 
  onScheduleClick 
}: UnscheduledProjectionsProps) => {
  const { data: projections, isLoading: projectionsLoading } = useProjections();
  const { data: schedules, isLoading: schedulesLoading } = useProductionSchedules();

  // Get unscheduled projections by checking which ones don't have production schedules
  const getUnscheduledProjections = () => {
    if (!projections || !schedules) return [];
    
    const scheduledProjectionIds = schedules.map(schedule => schedule.projection_id);
    return projections.filter(proj => !scheduledProjectionIds.includes(proj.id));
  };

  const unscheduledProjections = getUnscheduledProjections();

  if (projectionsLoading || schedulesLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Unscheduled Projections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading projections...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Unscheduled Projections</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Delivery Month</TableHead>
              {onScheduleClick && <TableHead>Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {unscheduledProjections.length > 0 ? (
              unscheduledProjections.map((proj) => (
                <TableRow key={proj.id}>
                  <TableCell className="font-medium">{proj.id.slice(0, 8)}</TableCell>
                  <TableCell>{proj.customers?.name}</TableCell>
                  <TableCell>{proj.products?.name}</TableCell>
                  <TableCell>{proj.quantity}</TableCell>
                  <TableCell>{proj.delivery_month}</TableCell>
                  {onScheduleClick && (
                    <TableCell>
                      <Button 
                        size="sm" 
                        onClick={() => onScheduleClick(proj.id)}
                        variant="outline"
                      >
                        Schedule
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={onScheduleClick ? 6 : 5} className="text-center py-4 text-muted-foreground">
                  All projections have been scheduled
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default UnscheduledProjections;
