import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Microscope, 
  AlertTriangle, 
  CheckCircle, 
  Package 
} from "lucide-react";

interface ComplaintStatusTimelineProps {
  currentStatus: string;
  progressPercentage: number;
}

export const ComplaintStatusTimeline = ({ currentStatus, progressPercentage }: ComplaintStatusTimelineProps) => {
  const stages = [
    {
      id: "open",
      label: "Open",
      icon: Package,
      description: "Complaint received"
    },
    {
      id: "iqc",
      label: "IQC Analysis",
      icon: Microscope,
      description: "Parts under analysis"
    },
    {
      id: "capa",
      label: "CAPA Required",
      icon: AlertTriangle,
      description: "Corrective action needed"
    },
    {
      id: "implemented",
      label: "CAPA Implemented",
      icon: FileText,
      description: "Actions completed"
    },
    {
      id: "closed",
      label: "Closed",
      icon: CheckCircle,
      description: "Complaint resolved"
    }
  ];

  const getStageIndex = (status: string) => {
    switch (status) {
      case "Open": return 0;
      case "IQC Analysis": return 1;
      case "CAPA Required": return 2;
      case "CAPA Implemented": return 3;
      case "Closed": return 4;
      default: return 0;
    }
  };

  const currentStageIndex = getStageIndex(currentStatus);

  const getStageStatus = (index: number) => {
    if (index < currentStageIndex) return "completed";
    if (index === currentStageIndex) return "current";
    return "pending";
  };

  const getStageColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-primary text-primary-foreground";
      case "current": return "bg-blue-500 text-white animate-pulse";
      case "pending": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getConnectorColor = (index: number) => {
    return index < currentStageIndex ? "bg-primary" : "bg-muted";
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className="text-muted-foreground">{progressPercentage}%</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const status = getStageStatus(index);
            
            return (
              <div key={stage.id} className="flex flex-col items-center relative">
                {/* Connector Line */}
                {index < stages.length - 1 && (
                  <div 
                    className={`absolute top-6 left-6 w-24 h-0.5 ${getConnectorColor(index)}`}
                    style={{ width: 'calc(100% + 1.5rem)' }}
                  />
                )}
                
                {/* Stage Circle */}
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center relative z-10
                  ${getStageColor(status)}
                  transition-all duration-300
                `}>
                  <Icon className="h-5 w-5" />
                </div>
                
                {/* Stage Label */}
                <div className="mt-2 text-center min-w-[80px]">
                  <div className="text-sm font-medium">{stage.label}</div>
                  <div className="text-xs text-muted-foreground">{stage.description}</div>
                  {status === "current" && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      Current
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};