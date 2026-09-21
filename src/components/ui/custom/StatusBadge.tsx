
import { cn } from "@/lib/utils";

type StatusType = "approved" | "pending" | "rejected" | "inProgress";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  withDot?: boolean;
  children?: React.ReactNode;
}

export function StatusBadge({ status, className, withDot = true, children }: StatusBadgeProps) {
  const statusConfig = {
    approved: {
      bgColor: "bg-success-wash",
      textColor: "text-success",
      dotColor: "bg-status-approved"
    },
    pending: {
      bgColor: "bg-warning-wash",
      textColor: "text-warning", 
      dotColor: "bg-status-pending"
    },
    rejected: {
      bgColor: "bg-destructive-wash",
      textColor: "text-destructive",
      dotColor: "bg-status-rejected"
    },
    inProgress: {
      bgColor: "bg-accent",
      textColor: "text-primary",
      dotColor: "bg-status-inProgress"
    }
  };

  const config = statusConfig[status];
  
  return (
    <span className={cn(
      "status-badge", 
      config.bgColor, 
      config.textColor, 
      className
    )}>
      {withDot && (
        <span className={cn(
          "w-2 h-2 mr-1.5 rounded-full", 
          config.dotColor,
          status === "inProgress" && "animate-pulse-slow"
        )} />
      )}
      {children || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
