
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Clock } from "lucide-react";
import { format } from "date-fns";

// Import refactored components
import UnscheduledProjections from "@/components/PPC/UnscheduledProjections";
import ProductionCalendar from "@/components/PPC/ProductionCalendar";
import ScheduleProductionForm from "@/components/PPC/ScheduleProductionForm";
import ProductionSchedule from "@/components/PPC/ProductionSchedule";
import ProductionDetailsModal from "@/components/PPC/ProductionDetailsModal";

// Import types and mock data
import { 
  PlannedDates, 
  projections, 
  productionLines,
  Production,
  RawMaterialShortage
} from "@/types/ppc";

// Import utility functions
import { 
  checkMaterialAvailability, 
  checkMaterialAvailabilityForDate 
} from "@/utils/materialUtils";

const PPC = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [plannedDates, setPlannedDates] = useState<PlannedDates>({});
  const [selectedProjection, setSelectedProjection] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [materialShortages, setMaterialShortages] = useState<RawMaterialShortage[]>([]);
  const [isMaterialsAvailable, setIsMaterialsAvailable] = useState<boolean>(true);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedDateDetails, setSelectedDateDetails] = useState<string | null>(null);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const materialStatus = checkMaterialAvailabilityForDate(formattedDate, plannedDates);
      setMaterialShortages(materialStatus.shortages);
      setIsMaterialsAvailable(materialStatus.available);
      setSelectedDateDetails(formattedDate);
      setIsDetailModalOpen(true);
    }
  };

  // Get selected projection details
  const getSelectedProjection = () => {
    return projections.find(proj => proj.id === selectedProjection);
  };

  // Get selected production line details
  const getSelectedLine = () => {
    return productionLines.find(line => line.id === selectedLine);
  };

  // Schedule production
  const handleScheduleProduction = () => {
    if (date && selectedProjection && selectedLine && quantity) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const projectionDetails = getSelectedProjection();
      const lineDetails = getSelectedLine();
      
      if (!projectionDetails || !lineDetails) return;
      
      const qtyNum = parseInt(quantity);
      
      // Check material availability
      const materialCheck = checkMaterialAvailability(projectionDetails.product, qtyNum);
      setMaterialShortages(materialCheck.shortages);
      setIsMaterialsAvailable(materialCheck.available);
      
      const production: Production = {
        id: `PROD-${Math.floor(Math.random() * 10000)}`,
        customer: projectionDetails.customer,
        product: projectionDetails.product,
        quantity: qtyNum,
        line: lineDetails.name
      };
      
      // Check if date exists in plannedDates
      if (plannedDates[formattedDate]) {
        // Add to existing date
        const updatedProductions = [...(plannedDates[formattedDate].productions || []), production];
        
        // Calculate total quantity for the date to check if overbooked
        const totalQuantity = updatedProductions.reduce((sum, prod) => sum + prod.quantity, 0);
        const totalCapacity = productionLines.reduce((sum, line) => sum + line.capacity, 0);
        
        setPlannedDates(prev => ({
          ...prev,
          [formattedDate]: {
            ...prev[formattedDate],
            productions: updatedProductions,
            overbooked: totalQuantity > totalCapacity,
            materialStatus: {
              available: materialCheck.available,
              shortages: materialCheck.shortages
            }
          }
        }));
      } else {
        // Create new date entry
        setPlannedDates(prev => ({
          ...prev,
          [formattedDate]: {
            productions: [production],
            overbooked: qtyNum > lineDetails.capacity,
            materialStatus: {
              available: materialCheck.available,
              shortages: materialCheck.shortages
            }
          }
        }));
      }
      
      // Reset form
      setSelectedProjection(null);
      setSelectedLine("");
      setQuantity("");
    }
  };

  // Get productions for selected date
  const getProductionsForDate = (specificDate?: string) => {
    const dateToUse = specificDate || (date ? format(date, 'yyyy-MM-dd') : null);
    if (!dateToUse) return [];
    return plannedDates[dateToUse]?.productions || [];
  };

  // Check if we have material shortages for the selected date
  const getMaterialStatusForDate = (specificDate?: string) => {
    const dateToUse = specificDate || (date ? format(date, 'yyyy-MM-dd') : null);
    if (!dateToUse) return null;
    return plannedDates[dateToUse]?.materialStatus;
  };

  // When a new projection is selected, update the quantity field
  useEffect(() => {
    if (selectedProjection) {
      const projectionDetails = getSelectedProjection();
      if (projectionDetails) {
        setQuantity(projectionDetails.quantity.toString());
        const materialCheck = checkMaterialAvailability(projectionDetails.product, projectionDetails.quantity);
        setMaterialShortages(materialCheck.shortages);
        setIsMaterialsAvailable(materialCheck.available);
      }
    } else {
      setMaterialShortages([]);
    }
  }, [selectedProjection]);

  const getUnscheduledProjections = () => {
    // A projection is considered scheduled if its product appears in any of the planned productions
    const scheduledProducts = Object.values(plannedDates)
      .flatMap(date => date.productions || [])
      .map(prod => prod.product);
    
    // Return projections that aren't in the scheduled products list
    return projections.filter(proj => !scheduledProducts.includes(proj.product));
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
          getUnscheduledProjections={getUnscheduledProjections} 
          onScheduleClick={setSelectedProjection} 
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Production Calendar Component */}
          <ProductionCalendar 
            date={date} 
            plannedDates={plannedDates} 
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
            materialShortages={materialShortages}
            handleScheduleProduction={handleScheduleProduction}
            getSelectedProjection={getSelectedProjection}
            checkMaterialAvailability={(product, qty) => {
              const result = checkMaterialAvailability(product, qty);
              setMaterialShortages(result.shortages);
              setIsMaterialsAvailable(result.available);
            }}
          />
        </div>

        {/* Production Schedule Component */}
        <ProductionSchedule
          date={date}
          getProductionsForDate={getProductionsForDate}
          getMaterialStatusForDate={getMaterialStatusForDate}
        />

        {/* Production Details Modal Component */}
        <ProductionDetailsModal
          isOpen={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          selectedDateDetails={selectedDateDetails}
          getProductionsForDate={getProductionsForDate}
          getMaterialStatusForDate={getMaterialStatusForDate}
        />
      </div>
    </DashboardLayout>
  );
};

export default PPC;
