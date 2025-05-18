
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/custom/StatusBadge";

interface Activity {
  id: string;
  action: string;
  subject: string;
  department: string;
  timestamp: string;
  status: "approved" | "pending" | "rejected" | "inProgress";
}

interface ActivityFeedProps {
  activities: Activity[];
  className?: string;
  isLoading?: boolean;
}

export function ActivityFeed({ 
  activities, 
  className,
  isLoading = false 
}: ActivityFeedProps) {
  const loadingItems = Array(5).fill(null);

  return (
    <div className={cn("space-y-4", className)}>
      <h2 className="text-lg font-semibold">Recent Activity</h2>
      
      <div className="space-y-3">
        {isLoading ? (
          loadingItems.map((_, index) => (
            <div key={index} className="bg-card p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))
        ) : activities.length === 0 ? (
          <div className="bg-accent p-4 rounded-lg text-center text-muted-foreground">
            No recent activity to display
          </div>
        ) : (
          activities.map((activity) => (
            <div 
              key={activity.id} 
              className="bg-card p-4 rounded-lg border flex items-center justify-between"
            >
              <div>
                <p className="font-medium">
                  <span className={`text-department-${activity.department.toLowerCase()}`}>
                    {activity.department}
                  </span>: {activity.action}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activity.subject} · {activity.timestamp}
                </p>
              </div>
              <StatusBadge status={activity.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
