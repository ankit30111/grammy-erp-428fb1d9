
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Clock } from "lucide-react";
import { format } from "date-fns";

// Import refactored components
import UnscheduledProjections from "@/components/PPC/UnscheduledProjections";
import ProductionCalendar from "@/components/PPC/ProductionCalendar";
import ScheduleProductionForm from "@/components/PPC/ScheduleProductionForm";
import ProductionSchedule from "@/components/PPC/ProductionSchedule";
import ProductionDetailsModal from "@/components/PPC/ProductionDetailsModal";

const PPC = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedProjection, setSelectedProjection] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedDateDetails, setSelectedDateDetails] = useState<string | null>(null);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      setSelectedDateDetails(formattedDate);
      setIsDetailModalOpen(true);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Production Planning Calendar</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Unscheduled Projections Component */}
        <UnscheduledProjections 
          onScheduleClick={setSelectedProjection} 
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Production Calendar Component */}
          <ProductionCalendar 
            date={date} 
            plannedDates={{}} 
            onSelectDate={handleDateSelect} 
          />

          {/* Schedule Production Form Component */}
          <ScheduleProductionForm
            date={date}
            selectedProjection={selectedProjection}
            setSelectedProjection={setSelectedProjection}
            selectedLine={selectedLine}
            setSelectedLine={setSelectedLine}
            quantity={quantity}
            setQuantity={setQuantity}
          />
        </div>

        {/* Production Schedule Component */}
        <ProductionSchedule
          date={date}
        />

        {/* Production Details Modal Component */}
        <ProductionDetailsModal
          isOpen={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          selectedDateDetails={selectedDateDetails}
          getProductionsForDate={() => []}
          getMaterialStatusForDate={() => null}
        />
      </div>
    </DashboardLayout>
  );
};

export default PPC;
