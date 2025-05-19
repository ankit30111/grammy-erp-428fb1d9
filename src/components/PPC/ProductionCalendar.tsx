
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { PlannedDates } from "@/types/ppc";
import { format } from "date-fns";

interface ProductionCalendarProps {
  date: Date | undefined;
  plannedDates: PlannedDates;
  onSelectDate: (date: Date | undefined) => void;
}

const ProductionCalendar = ({ 
  date, 
  plannedDates, 
  onSelectDate 
}: ProductionCalendarProps) => {
  return (
    <Card className="md:col-span-1">
      <CardHeader>
        <CardTitle>Production Calendar</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="rounded-md border">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onSelectDate}
            className="w-full pointer-events-auto"
            modifiers={{
              booked: Object.keys(plannedDates).map(date => new Date(date)),
              overbooked: Object.entries(plannedDates)
                .filter(([_, data]) => data.overbooked)
                .map(([date]) => new Date(date)),
              shortage: Object.entries(plannedDates)
                .filter(([_, data]) => data.materialStatus?.available === false)
                .map(([date]) => new Date(date))
            }}
            modifiersClassNames={{
              booked: "bg-green-100 text-green-800 font-bold",
              overbooked: "bg-red-100 text-red-800 font-bold",
              shortage: "bg-amber-100 text-amber-800 font-bold"
            }}
          />
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100"></div>
            <span className="text-sm">Production Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-100"></div>
            <span className="text-sm">Material Shortage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100"></div>
            <span className="text-sm">Capacity Overbooked</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductionCalendar;
