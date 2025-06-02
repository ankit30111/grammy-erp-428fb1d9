
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useProjectionValidation } from "./ProjectionValidation";

interface ProjectionProgressIndicatorProps {
  projectionId: string;
  showDetails?: boolean;
}

export const ProjectionProgressIndicator = ({ 
  projectionId, 
  showDetails = false 
}: ProjectionProgressIndicatorProps) => {
  const { getProjectionStatus } = useProjectionValidation();
  const status = getProjectionStatus(projectionId);

  if (!status) return null;

  const { totalProjected, totalScheduled, remaining, percentageScheduled, isFullyScheduled } = status;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Progress 
          value={percentageScheduled} 
          className="flex-1 h-2"
        />
        <Badge variant={isFullyScheduled ? "default" : "secondary"} className="text-xs">
          {Math.round(percentageScheduled)}%
        </Badge>
      </div>
      
      {showDetails && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Total Projected:</span>
            <span className="font-medium">{totalProjected.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Scheduled:</span>
            <span className="font-medium text-blue-600">{totalScheduled.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Remaining:</span>
            <span className={`font-medium ${remaining === 0 ? 'text-red-600' : 'text-green-600'}`}>
              {remaining.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
