
import { useProjections } from "@/hooks/useProjections";
import { useProductionSchedules } from "@/hooks/useProductionSchedules";

interface ProjectionValidationResult {
  isValid: boolean;
  error?: string;
  totalProjected: number;
  totalScheduled: number;
  remaining: number;
}

export const useProjectionValidation = () => {
  const { data: projections = [] } = useProjections();
  const { data: schedules = [] } = useProductionSchedules();

  const validateScheduling = (
    projectionId: string,
    newQuantity: number,
    excludeScheduleId?: string
  ): ProjectionValidationResult => {
    const projection = projections.find(p => p.id === projectionId);
    
    if (!projection) {
      return {
        isValid: false,
        error: "Projection not found",
        totalProjected: 0,
        totalScheduled: 0,
        remaining: 0
      };
    }

    // Calculate currently scheduled quantity for this projection
    const currentScheduled = schedules
      .filter(s => s.projection_id === projectionId && s.id !== excludeScheduleId)
      .reduce((sum, schedule) => sum + schedule.quantity, 0);

    const totalProjected = projection.quantity;
    const totalScheduled = currentScheduled;
    const remaining = totalProjected - totalScheduled;

    const isValid = newQuantity <= remaining;
    
    let error = undefined;
    if (!isValid) {
      if (remaining === 0) {
        error = "Cannot schedule more production. Projected quantity for this product is already fully planned.";
      } else {
        error = `Cannot schedule ${newQuantity} units. Only ${remaining} units remaining from projection of ${totalProjected}.`;
      }
    }

    return {
      isValid,
      error,
      totalProjected,
      totalScheduled,
      remaining
    };
  };

  const getProjectionStatus = (projectionId: string) => {
    const projection = projections.find(p => p.id === projectionId);
    if (!projection) return null;

    const scheduled = projection.scheduled_quantity || 0;
    const remaining = projection.quantity - scheduled;
    const percentageScheduled = (scheduled / projection.quantity) * 100;

    return {
      totalProjected: projection.quantity,
      totalScheduled: scheduled,
      remaining,
      percentageScheduled,
      isFullyScheduled: remaining === 0
    };
  };

  return {
    validateScheduling,
    getProjectionStatus
  };
};
