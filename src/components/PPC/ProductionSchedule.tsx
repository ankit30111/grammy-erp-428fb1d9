
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";

interface ProductionScheduleProps {
  date: Date | undefined;
}

const ProductionSchedule = ({
  date,
}: ProductionScheduleProps) => {
  const { data: schedules, isLoading } = useProductionSchedules();

  const getProductionsForDate = () => {
    if (!schedules || !date) return [];
    const dateString = format(date, 'yyyy-MM-dd');
    return schedules.filter(schedule => schedule.scheduled_date === dateString);
  };

  const productionsForDate = getProductionsForDate();

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>
          {date ? `Production Schedule for ${format(date, 'PPP')}` : 'Select a date to view schedule'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Loading schedule...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Production Line</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productionsForDate.length > 0 ? (
                productionsForDate.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.id.slice(0, 8)}</TableCell>
                    <TableCell>{schedule.projections?.customers?.name}</TableCell>
                    <TableCell>{schedule.projections?.products?.name}</TableCell>
                    <TableCell>{schedule.quantity}</TableCell>
                    <TableCell>{schedule.production_line}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                        <Check className="h-3 w-3 mr-1" />
                        {schedule.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                    No production scheduled for this date
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductionSchedule;
