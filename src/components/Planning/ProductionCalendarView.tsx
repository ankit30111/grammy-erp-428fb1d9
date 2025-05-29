
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";
import { format, isSameDay } from "date-fns";
import { CalendarDays, Package } from "lucide-react";

interface ProductionCalendarViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export const ProductionCalendarView = ({ selectedDate, onDateSelect }: ProductionCalendarViewProps) => {
  const { data: schedules = [] } = useProductionSchedules();

  // Get schedules for selected date
  const selectedDateSchedules = schedules.filter(schedule => 
    isSameDay(new Date(schedule.scheduled_date), selectedDate)
  );

  // Get all scheduled dates for calendar highlighting
  const scheduledDates = schedules.map(schedule => new Date(schedule.scheduled_date));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Production Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onDateSelect(date)}
            className="rounded-md border"
            modifiers={{
              scheduled: scheduledDates
            }}
            modifiersStyles={{
              scheduled: {
                backgroundColor: 'var(--primary)',
                color: 'white'
              }
            }}
          />
          <div className="mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded"></div>
              <span>Scheduled Production Days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Scheduled Productions for {format(selectedDate, "PPP")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDateSchedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No productions scheduled for this date
            </div>
          ) : (
            <div className="space-y-4">
              {selectedDateSchedules.map((schedule) => (
                <div key={schedule.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">
                        {schedule.projections?.products?.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Customer: {schedule.projections?.customers?.name}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {schedule.status}
                    </Badge>
                  </div>
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span>Quantity:</span>
                      <span className="font-medium">{schedule.quantity.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Production Line:</span>
                      <span className="font-medium">{schedule.production_line}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
