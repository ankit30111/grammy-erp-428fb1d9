
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

export function StatCard({ 
  title, 
  value, 
  trend, 
  icon, 
  className,
  isLoading = false 
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden card-hover", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium">
          {isLoading ? (
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          ) : (
            title
          )}
        </h3>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          {isLoading ? (
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold">{value}</div>
          )}
          {trend && !isLoading && (
            <span
              className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
