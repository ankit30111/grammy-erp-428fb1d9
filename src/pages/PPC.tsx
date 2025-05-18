import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

interface PlannedDate {
  overbooked?: boolean;
}

interface PlannedDates {
  [date: string]: PlannedDate;
}

const PPC = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [plannedDates, setPlannedDates] = useState<PlannedDates>({});

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      setPlannedDates(prev => ({
        ...prev,
        [formattedDate]: { overbooked: Math.random() > 0.5 }
      }));
    }
  };

  // The function should return a string type, not a function type
  const getDayClass = (date: Date): string => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    if (plannedDates[formattedDate]?.overbooked) {
      return "bg-red-100 text-red-800 font-bold";
    } else if (plannedDates[formattedDate]) {
      return "bg-green-100 text-green-800 font-bold";
    }
    return "";
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Production Planning Calendar</CardTitle>
          </CardHeader>
          <CardContent className="pl-6">
            <div className="rounded-md border">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                className="w-full"
                getDayClass={getDayClass}
              />
            </div>
            {date ? (
              <p className="mt-4">
                Selected Date: {format(date, 'PPP')}
                {plannedDates[format(date, 'yyyy-MM-dd')]?.overbooked ? ' (Overbooked)' : ' (Available)'}
              </p>
            ) : (
              <p className="mt-4">Please select a date.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PPC;
